/**
 * 用 Edge headless + CDP 给运行中的前端拍照（作品集/README 截图的可复现来源）。
 *
 * 为什么不用 Playwright / Puppeteer：两者都要额外下载浏览器或 ES 依赖；
 * 本项目 Node 18+ 自带全局 WebSocket，Edge 又一定在机器上，所以直接用 CDP。
 *
 * 用法：
 *   node scripts/dev/screenshot.mjs                 # 拍全部场景
 *   node scripts/dev/screenshot.mjs 3d-view map2d   # 只拍指定场景
 *   node scripts/dev/screenshot.mjs --list          # 列出场景
 *
 * 前置：后端 :8080 与前端 :5173 都在跑（后端需可用的 PostGIS 数据）。
 * 产物：.temp-portfolio/shots/<id>.png（1600×1000）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const outDir = path.join(root, '.temp-portfolio', 'shots')
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const BASE = process.env.APP_BASE || 'http://localhost:5173'
const FORMAT = process.env.SHOT_FORMAT || 'png'
const QUALITY = Number(process.env.SHOT_QUALITY || 90)
const WIDTH = Number(process.env.SHOT_WIDTH || 1600)
const HEIGHT = Number(process.env.SHOT_HEIGHT || 1000)

/* ------------------------------------------------------------------ *
 * 场景定义：url 只用深链，不在截图脚本里模拟点击
 * —— 任何一个场景都能被人工复现：把 url 贴进浏览器就能看到同一画面。
 * ------------------------------------------------------------------ */
export const SCENES = [
  {
    id: '3d-view',
    title: '三维数字孪生场景 + 图层控制',
    url: '/?present=1',
    ready: () => window.__APP_READY__ === true,
  },
  {
    id: 'map2d-mvt',
    title: '二维一张图（OpenLayers + ST_AsMVT 矢量瓦片）',
    url: '/?present=1&view=analysis',
    ready: () => !!document.querySelector('[data-map-ready]'),
  },
  {
    id: 'map2d-cluster',
    title: '订单点位聚合 + ST_DWithin 缓冲区查询',
    url: '/?present=1&view=analysis&demo=buffer',
    ready: () => !!document.querySelector('[data-shot="buffer-result"]'),
  },
  {
    id: 'map2d-route',
    title: 'A* 航线对照（直线 vs 规划路线）',
    url: '/?present=1&view=analysis&demo=route',
    ready: () => !!document.querySelector('[data-shot="route-result"]'),
  },
  {
    id: 'dashboard',
    title: '配送统计可视化大屏（ECharts）',
    url: '/?present=1&view=dashboard',
    ready: () => !!document.querySelector('[data-shot="dashboard-ready"]'),
  },
]

/* ---------------------------- CDP 客户端 ---------------------------- */
class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      }
    })
  }

  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`CDP timeout: ${method}`))
        }
      }, 60000)
    })
  }

  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (r.exceptionDetails) throw new Error(`eval failed: ${JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails)}`)
    return r.result?.value
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForEndpoint(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) return await res.json()
    } catch {
      /* not up yet */
    }
    await sleep(200)
  }
  throw new Error('Edge 调试端口未就绪')
}

async function newTarget(port, url) {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })
  if (!res.ok) throw new Error(`创建 target 失败: ${res.status}`)
  const target = await res.json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  return { ws, target, cdp: new Cdp(ws) }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--list')) {
    SCENES.forEach((s) => console.log(`${s.id}\t${s.title}\t${BASE}${s.url}`))
    return
  }
  const only = args.filter((a) => !a.startsWith('--'))
  const scenes = only.length ? SCENES.filter((s) => only.includes(s.id)) : SCENES
  if (!scenes.length) {
    console.error('没有匹配的场景，用 --list 查看可用 id')
    process.exit(1)
  }

  fs.mkdirSync(outDir, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-shot-'))
  const port = 9300 + Math.floor(Math.random() * 400)
  const edge = spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${WIDTH},${HEIGHT}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  )

  try {
    await waitForEndpoint(port)
    for (const scene of scenes) {
      const { ws, cdp, target } = await newTarget(port, BASE)
      try {
        await cdp.send('Page.enable')
        await cdp.send('Runtime.enable')
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: WIDTH,
          height: HEIGHT,
          deviceScaleFactor: 1,
          mobile: false,
        })
        const url = BASE + scene.url
        console.log(`→ ${scene.id}: ${url}`)
        await cdp.send('Page.navigate', { url })

        // 等场景自报就绪（最多 45s）
        const deadline = Date.now() + 45000
        let ok = false
        while (Date.now() < deadline) {
          try {
            ok = await cdp.eval(`(${scene.ready.toString()})()`)
          } catch {
            ok = false
          }
          if (ok) break
          await sleep(300)
        }
        if (!ok) throw new Error(`场景未就绪（检查 ready 条件）: ${scene.id}`)

        // 停掉可能还在动的动画抖动（可选场景自己处理）
        await sleep(scene.settle ?? 1200)
        const shot = await cdp.send('Page.captureScreenshot', {
          format: FORMAT,
          quality: FORMAT === 'jpeg' ? QUALITY : undefined,
          captureBeyondViewport: false,
          fromSurface: true,
        })
        const file = path.join(outDir, `${scene.id}.${FORMAT === 'jpeg' ? 'jpg' : 'png'}`)
        fs.writeFileSync(file, Buffer.from(shot.data, 'base64'))
        console.log(`   saved ${path.relative(root, file)}`)
      } finally {
        ws.close()
        await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {})
      }
    }
  } finally {
    edge.kill()
  }
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  main().catch((err) => {
    console.error('截图失败：', err.message)
    process.exit(1)
  })
}
