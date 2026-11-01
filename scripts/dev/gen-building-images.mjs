/**
 * 给建筑弹窗生成配图：用高德卫星影像按建筑轮廓裁一张 2:1 的图（800×400 JPEG）。
 *
 * 为什么不用网图：
 *   1. Wikimedia / Unsplash 站点 / Openverse 在本机网络下都超时（只有 Pexels CDN 能连，但没法按主题搜）；
 *   2. 更要紧的是——拿别的楼的网图当"本校 6 号教学楼照片"，面试一问就穿。
 * 所以这里用项目自己在用的同一套底图（高德卫星，与数据同基准）按建筑范围裁切：
 * 真实、可复现、和空间数据一一对应。
 *
 * 产物：frontend/public/buildings/{表名}-{id}.jpg（命名规则见该目录 README）
 *
 * 用法：node scripts/dev/gen-building-images.mjs
 * 前置：后端 :8080 在跑（取 /api/spatial/geojson/{table} 的几何）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const OUT_DIR = path.join(root, 'frontend', 'public', 'buildings')
const APP = process.env.APP_API || 'http://localhost:8080'
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const ZOOM = 18
const OUT_W = 800
const OUT_H = 400

const TABLES = ['teaching_building', 'dormitory', 'other_buildings']

/* ------------------------- 几何 → bbox ------------------------- */
const ringsOf = (geom) =>
  geom.type === 'MultiPolygon' ? geom.coordinates.flat() : geom.type === 'Polygon' ? geom.coordinates : []

function bboxOf(geom) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
  for (const ring of ringsOf(geom)) {
    for (const [x, y] of ring) {
      if (x < minx) minx = x
      if (x > maxx) maxx = x
      if (y < miny) miny = y
      if (y > maxy) maxy = y
    }
  }
  return [minx, miny, maxx, maxy]
}

/* ------------------------- 经纬度 ↔ 瓦片像素 ------------------------- */
const lon2px = (lon, z) => ((lon + 180) / 360) * 256 * 2 ** z
function lat2px(lat, z) {
  const rad = (lat * Math.PI) / 180
  const y = Math.log(Math.tan(Math.PI / 4 + rad / 2))
  return ((1 - y / Math.PI) / 2) * 256 * 2 ** z
}

/* ------------------------- 主流程 ------------------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`)
  const j = await r.json()
  return j.data ?? j
}

async function fetchTileBase64(z, x, y) {
  const host = 1 + ((x + y) % 4)
  const url = `https://webst0${host}.is.autonavi.com/appmaptile?style=6&x=${x}&y=${y}&z=${z}`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url)
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const buf = Buffer.from(await r.arrayBuffer())
      return 'data:image/png;base64,' + buf.toString('base64')
    } catch (e) {
      if (attempt === 2) throw e
      await sleep(300)
    }
  }
}

const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script>
window.__DONE__ = false; window.__OUT__ = null;
window.renderAll = async (jobs) => {
  const out = {};
  for (const job of jobs) {
    const { name, z, tiles, crop, outW, outH } = job;
    // 先把所有瓦片画到一张大画布上（绝对像素坐标）
    const maxX = Math.max(...tiles.map(t => t.px + 256));
    const maxY = Math.max(...tiles.map(t => t.py + 256));
    const minX = Math.min(...tiles.map(t => t.px));
    const minY = Math.min(...tiles.map(t => t.py));
    const big = document.createElement('canvas');
    big.width = maxX - minX; big.height = maxY - minY;
    const bctx = big.getContext('2d');
    bctx.fillStyle = '#1b2430'; bctx.fillRect(0, 0, big.width, big.height);
    for (const t of tiles) {
      const img = new Image();
      img.src = t.url;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      bctx.drawImage(img, t.px - minX, t.py - minY);
    }
    // 再按建筑范围裁一块 2:1 的图（crop 用“大画布”坐标系）
    const c = document.createElement('canvas');
    c.width = outW; c.height = outH;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(big, crop.x - minX, crop.y - minY, crop.w, crop.h, 0, 0, outW, outH);
    out[name] = c.toDataURL('image/jpeg', 0.84);
  }
  return out;
};
</script></body></html>`

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  // 1) 取几何
  const jobs = []
  const meta = []
  for (const table of TABLES) {
    const rows = await fetchJson(`${APP}/api/spatial/geojson/${table}`)
    const idField = 'id'
    for (const row of rows) {
      const geom = typeof row.geom === 'string' ? JSON.parse(row.geom) : row.geom
      if (!geom) continue
      const [minx, miny, maxx, maxy] = bboxOf(geom)
      if (!isFinite(minx)) continue

      // 2) 按像素口径取景：2:1，建筑至少占画面约 1/3
      //    （高德卫星影像在本区域最高只到 z=18，z=19 会返回"此区域暂无卫星图"占位图）
      const px0 = lon2px(minx, ZOOM)
      const px1 = lon2px(maxx, ZOOM)
      const py0 = lat2px(maxy, ZOOM)
      const py1 = lat2px(miny, ZOOM)
      const bw = Math.max(px1 - px0, 1)
      const bh = Math.max(py1 - py0, 1)
      let cw = Math.max(bw * 1.4, 420)
      let ch = cw / 2
      if (ch < bh * 1.4) {
        ch = bh * 1.4
        cw = ch * 2
      }
      const cropMinX = (px0 + px1) / 2 - cw / 2
      const cropMinY = (py0 + py1) / 2 - ch / 2
      const cropMaxX = cropMinX + cw
      const cropMaxY = cropMinY + ch

      const tx0 = Math.floor(cropMinX / 256)
      const tx1 = Math.floor(cropMaxX / 256)
      const ty0 = Math.floor(cropMinY / 256)
      const ty1 = Math.floor(cropMaxY / 256)

      const tiles = []
      for (let tx = tx0; tx <= tx1; tx++) {
        for (let ty = ty0; ty <= ty1; ty++) {
          const url = await fetchTileBase64(ZOOM, tx, ty)
          tiles.push({ url, px: tx * 256, py: ty * 256 })
        }
      }

      const name = `${table}-${row[idField]}.jpg`
      jobs.push({
        name,
        z: ZOOM,
        tiles,
        crop: { x: cropMinX, y: cropMinY, w: cropMaxX - cropMinX, h: cropMaxY - cropMinY },
        outW: OUT_W,
        outH: OUT_H,
      })
      meta.push({ table, id: row[idField], name: row.name || '', file: name, tiles: tiles.length })
      console.log(`  prep ${name} (${row.name || table}) tiles=${tiles.length}`)
    }
  }

  console.log(`共 ${jobs.length} 张，开始渲染…`)

  // 3) 用浏览器 canvas 拼图 + 裁切 + 导 JPEG
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(PAGE)
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-img-'))
  const dbg = 9700 + Math.floor(Math.random() * 200)
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })

  try {
    for (let i = 0; i < 120; i++) {
      try { const r = await fetch(`http://127.0.0.1:${dbg}/json/version`); if (r.ok) break } catch { /* wait */ }
      await sleep(150)
    }
    const t = await (await fetch(`http://127.0.0.1:${dbg}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(t.webSocketDebuggerUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true })
      ws.addEventListener('error', rej, { once: true })
    })
    let id = 0
    const pending = new Map()
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    })
    const send = (method, params = {}) =>
      new Promise((res) => { pending.set(++id, res); ws.send(JSON.stringify({ id, method, params })) })
    await send('Runtime.enable')
    await send('Page.enable')
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/` })
    await sleep(800)

    // 分批送，避免一次生成的 dataURL 太大
    const result = {}
    const BATCH = 4
    for (let i = 0; i < jobs.length; i += BATCH) {
      const batch = jobs.slice(i, i + BATCH)
      const r = await send('Runtime.evaluate', {
        expression: `window.renderAll(${JSON.stringify(batch)})`,
        awaitPromise: true,
        returnByValue: true,
        timeout: 120000,
      })
      const val = r.result?.result?.value
      if (!val) throw new Error('渲染失败: ' + JSON.stringify(r.result?.exceptionDetails || r.result).slice(0, 300))
      Object.assign(result, val)
      console.log(`  rendered ${Object.keys(result).length}/${jobs.length}`)
    }

    for (const [name, dataUrl] of Object.entries(result)) {
      const b64 = dataUrl.split(',')[1]
      const file = path.join(OUT_DIR, name)
      fs.writeFileSync(file, Buffer.from(b64, 'base64'))
    }
    console.log(`写出 ${Object.keys(result).length} 张 → ${path.relative(root, OUT_DIR)}`)

    // 4) 记录来源，便于随时重生成
    const lines = [
      '# 配图来源与生成方式',
      '',
      '本目录的 `*.jpg` **不是实景照片**，而是用项目底图（高德卫星影像，与空间数据同基准）',
      '按每栋建筑的轮廓裁切的 2:1 影像图，代表"这栋楼在这个位置"的实拍影像。',
      '',
      '- 生成脚本：`scripts/dev/gen-building-images.mjs`（`node scripts/dev/gen-building-images.mjs`）',
      `- 瓦片：高德卫星影像 style=6，缩放级别 z=${ZOOM}，与本项目 Cesium 底图同源`,
      '- 输出：' + OUT_W + '×' + OUT_H + ' JPEG（q=0.84），弹窗内 288×132 object-fit: cover',
      '- 重新生成需要：后端 :8080 在跑（取建筑几何）+ 本机装有 Edge（无头渲染）',
      '',
      '## 为什么不用网图',
      '',
      '拿其它学校的楼照片当"本校 6 号教学楼"，面试时一句"这是你们学校的楼吗"就问穿了；',
      '而且网图还有版权问题。用自己底图裁切的影像，既真实可核对，也和项目的空间数据一一对应。',
      '',
      '## 清单',
      '',
      '| 表 | id | 建筑 | 文件 |',
      '|---|---|---|---|',
    ]
    for (const m of meta) lines.push(`| ${m.table} | ${m.id} | ${m.name} | \`${m.file}\` |`)
    fs.writeFileSync(path.join(OUT_DIR, 'SOURCES.md'), lines.join('\n') + '\n', 'utf8')
    console.log('SOURCES.md 已写出')
    ws.close()
  } finally {
    edge.kill()
    server.close()
  }
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1) })
