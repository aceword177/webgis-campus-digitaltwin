/**
 * 建筑描边几何提取的自检（用后端真实 GeoJSON，不依赖浏览器）。
 *
 * 背景：loadBuildings 关掉 clampToGround 后，`polygon.outline` 不再生效
 * （它只对贴地多边形有效），因此改用独立贴地 polyline 勾边。
 * 本脚本验证：
 *   1. 从每个建筑要素能提取出 >=1 个有效外环（>=3 个点）
 *   2. 环坐标与原始 geom 完全一致（提取过程没有丢点/改点）
 *   3. MultiPolygon 的每个子面都被处理
 *   4. 提取出的坐标能构造出有效的 Cartesian3（喂给 fromDegreesArray 不会崩）
 *   5. height 字段可用（拉伸高度依赖它）
 *
 * 需要后端在 localhost:8080 运行。用法：node scripts/verify-building-outlines.mjs
 *
 * 这是本目录里唯一的「集成校验」（要真实数据），其余 5 个都是离线可跑的。
 * 后端连不上时**跳过而不是失败**：以前它会把「后端没启动」报成「失败 3 项」，
 * 看起来像代码回归，导致 `npm run verify:all` 在离线环境下必然红——
 * 一个总是红的门等于没有门。注意区分：只有「连不上」才跳过，
 * 后端响应了却报错仍按真失败处理，不掩盖问题。
 */
import * as Cesium from 'cesium'

const API = 'http://localhost:8080/api/spatial/geojson'
const TABLES = ['teaching_building', 'dormitory', 'other_buildings']

let failures = 0
const fail = (msg) => { failures++; console.log(`  ✗ ${msg}`) }

/**
 * 后端可用性预检。
 * @returns {Promise<{kind:'down'|'up', detail:string}>}
 *   down = TCP/网络层连不上（跳过）；up = 有 HTTP 响应（哪怕是错误码，都交给下面的
 *   逐表校验去判真失败）。
 */
async function probeBackend() {
  try {
    await fetch(`${API}/${TABLES[0]}`, { signal: AbortSignal.timeout(3000) })
    return { kind: 'up', detail: '' }
  } catch (e) {
    return { kind: 'down', detail: e.message }
  }
}

/**
 * 与 utils/cesium.js#addBuildingOutlines 完全一致的环提取逻辑。
 * 这里复制一份是为了能在 Node 里独立测试（原函数需要 viewer 且不导出）。
 */
function extractOuterRings(geom) {
  let g = geom
  if (typeof g === 'string') {
    try { g = JSON.parse(g) } catch { return [] }
  }
  if (!g) return []
  const rings = []
  if (g.type === 'Polygon') {
    if (g.coordinates?.[0]) rings.push(g.coordinates[0])
  } else if (g.type === 'MultiPolygon') {
    for (const poly of g.coordinates || []) {
      if (poly?.[0]) rings.push(poly[0])
    }
  }
  return rings
}

console.log('校验建筑描边几何提取（数据来自后端真实表）\n')

const probe = await probeBackend()
if (probe.kind === 'down') {
  console.log(`  ⚠️  跳过：连不上后端 localhost:8080（${probe.detail}）`)
  console.log('')
  console.log('      本脚本需要真实数据，属「集成校验」，不计入离线回归。')
  console.log('      要做这次校验，先启动后端（项目根目录 start-backend.bat），再重跑：')
  console.log('          node scripts/verify-building-outlines.mjs')
  console.log('')
  console.log('      离线可跑的 5 个脚本：npm run verify:offline')
  process.exit(0)
}

for (const table of TABLES) {
  let rows
  try {
    const res = await fetch(`${API}/${table}`)
    const body = await res.json()
    rows = body?.data
  } catch (e) {
    fail(`${table}: 请求失败 ${e.message}（后端是否在 8080 运行？）`)
    continue
  }
  if (!Array.isArray(rows) || !rows.length) {
    fail(`${table}: 返回数据为空`)
    continue
  }

  let featureCount = 0
  let ringCount = 0
  let pointCount = 0

  for (const row of rows) {
    featureCount++
    const rings = extractOuterRings(row.geom)
    if (!rings.length) {
      fail(`${table} id=${row.id}: 未提取到任何外环`)
      continue
    }
    if (!row.height) {
      fail(`${table} id=${row.id}: height 缺失，拉伸高度会回退到 3 层`)
    }

    // 与原始 geom 逐点比对，确保提取没改动数据
    const g = typeof row.geom === 'string' ? JSON.parse(row.geom) : row.geom
    const expectedRings = g.type === 'MultiPolygon'
      ? g.coordinates.map(p => p[0])
      : [g.coordinates[0]]
    if (rings.length !== expectedRings.length) {
      fail(`${table} id=${row.id}: 外环数量不符 提取=${rings.length} 期望=${expectedRings.length}`)
      continue
    }
    for (let i = 0; i < rings.length; i++) {
      if (JSON.stringify(rings[i]) !== JSON.stringify(expectedRings[i])) {
        fail(`${table} id=${row.id}: 第 ${i} 个环坐标与原始 geom 不一致`)
      }
    }

    for (const ring of rings) {
      ringCount++
      if (!Array.isArray(ring) || ring.length < 3) {
        fail(`${table} id=${row.id}: 环点数不足 3（${ring?.length}）`)
        continue
      }
      // 首尾闭合检查（贴地 polyline 不闭合会留缺口）
      const first = ring[0]
      const last = ring[ring.length - 1]
      if (first[0] !== last[0] || first[1] !== last[1]) {
        fail(`${table} id=${row.id}: 外环首尾未闭合`)
      }
      for (const c of ring) {
        if (!Array.isArray(c) || typeof c[0] !== 'number' || typeof c[1] !== 'number') {
          fail(`${table} id=${row.id}: 存在非法坐标 ${JSON.stringify(c)}`)
        }
        pointCount++
      }
      // 关键：这些坐标必须能喂给 Cesium 而不抛错
      try {
        const positions = Cesium.Cartesian3.fromDegreesArray(ring.flat())
        if (!positions || positions.length !== ring.length) {
          fail(`${table} id=${row.id}: fromDegreesArray 结果长度不符`)
        }
      } catch (e) {
        fail(`${table} id=${row.id}: fromDegreesArray 抛错 ${e.message}`)
      }
    }
  }

  console.log(`  ✓ ${table.padEnd(18)} 要素=${featureCount}  外环=${ringCount}  顶点=${pointCount}`)
}

console.log('')
if (failures) {
  console.log(`失败 ${failures} 项`)
  process.exit(1)
}
console.log('全部通过 ✓ —— 每个建筑都能提取出闭合、可用的外环，坐标未被改动')
