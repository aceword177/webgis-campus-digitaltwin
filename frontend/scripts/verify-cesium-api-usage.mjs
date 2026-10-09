/**
 * 用真实 cesium 包校验源码里用到的 Cesium API 是否都存在。
 *
 * 为什么需要它：这类错误**静态编译查不出来**，只有运行时调用到才抛
 * `TypeError: ... is not a function`。已抓到两例：
 *   1. `Cesium.SceneTransforms.wgs84ToWindowCoordinates` —— 1.121 前后改名为
 *      worldToWindowCoordinates；发生在 postRender 里，表现为"有数据但弹窗不出现"
 *   2. `Cesium.Cartesian3.fromCartesian` —— 该静态方法只存在于 Cartographic 上；
 *      测面积每次都会抛
 *
 * 校验范围：
 *   · `import * as Cesium from 'cesium'` → 校验 `Cesium.Foo.bar` 整条路径
 *   · `import { Color, Cartesian3 } from 'cesium'` → 校验具名导入与 `Color.WHITE` 这类成员
 *
 * 用法：node scripts/verify-cesium-api-usage.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as Cesium from 'cesium'

const here = dirname(fileURLToPath(import.meta.url))
const srcRoot = resolve(here, '..', 'src')

/**
 * 去掉注释，只留可执行代码。
 *
 * 必要性：注释里经常出现"曾经的错误写法"作为反例（比如本仓库 measure.js 里
 * 就写着 `Cesium.Cartesian3.fromCartesian` 的说明），若不过滤会误报成 API 不存在。
 *
 * 简易实现：状态机逐字符扫描，保留字符串字面量（避免把字符串里的 `//` 当注释），
 * 丢弃 `//...` 与 `/* ... *\/`。不追求处理正则字面量等极端情况。
 */
function stripComments(code) {
  let out = ''
  let i = 0
  const n = code.length
  let state = 'code' // code | line | block | single | double | template
  while (i < n) {
    const c = code[i]
    const c2 = code[i + 1]
    if (state === 'code') {
      if (c === '/' && c2 === '/') { state = 'line'; i += 2; continue }
      if (c === '/' && c2 === '*') { state = 'block'; i += 2; continue }
      if (c === "'") state = 'single'
      else if (c === '"') state = 'double'
      else if (c === '`') state = 'template'
      out += c
      i++
      continue
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c }
      i++
      continue
    }
    if (state === 'block') {
      if (c === '*' && c2 === '/') { state = 'code'; i += 2; continue }
      if (c === '\n') out += c // 保留换行，避免行号错位影响阅读
      i++
      continue
    }
    // 字符串/模板字面量：原样保留，遇转义跳过下一个字符
    if (c === '\\') { out += c + (c2 ?? ''); i += 2; continue }
    if ((state === 'single' && c === "'") ||
        (state === 'double' && c === '"') ||
        (state === 'template' && c === '`')) {
      state = 'code'
    }
    out += c
    i++
  }
  return out
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(vue|js|mjs)$/.test(name)) out.push(p)
  }
  return out
}

/**
 * 收集文件里的 Cesium 命名空间别名。
 * @returns {{ns: string[], named: string[]}} ns 为命名空间别名，named 为具名导入
 */
function collectImports(code) {
  const ns = []
  const named = []

  // import * as Cesium from 'cesium'
  const nsRe = /import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]cesium['"]/g
  let m
  while ((m = nsRe.exec(code))) ns.push(m[1])

  // import { A, B as C } from 'cesium'
  const namedRe = /import\s*\{([^}]+)\}\s*from\s*['"]cesium['"]/g
  while ((m = namedRe.exec(code))) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop().trim()
      if (name) named.push(name)
    }
  }
  return { ns, named }
}

/** 抽出 `<alias>.A.B` 形式的最长访问路径 */
function extractPaths(code, alias) {
  const out = new Map()
  const re = new RegExp(`\\b${alias}((?:\\.[A-Za-z_$][\\w$]*)+)`, 'g')
  let m
  while ((m = re.exec(code))) {
    const path = m[1].slice(1)
    out.set(path, (out.get(path) || 0) + 1)
  }
  return out
}

/** 沿路径在真实 cesium 命名空间里取值 */
function lookup(path) {
  let cur = Cesium
  const parts = path.split('.')
  for (let i = 0; i < parts.length; i++) {
    if (cur == null) return { ok: false, at: parts.slice(0, i).join('.') }
    if (!(parts[i] in cur)) return { ok: false, at: parts.slice(0, i + 1).join('.') }
    cur = cur[parts[i]]
  }
  return { ok: true, value: cur }
}

const files = walk(srcRoot)
let checked = 0
let failures = 0
const seen = new Set()

console.log(`用真实 Cesium ${Cesium.VERSION} 校验源码里的 API 引用\n`)

for (const file of files) {
  // 必须先去注释：注释里的"错误写法示例"不该被当成真实 API 引用
  const code = stripComments(readFileSync(file, 'utf8'))
  const { ns, named } = collectImports(code)
  if (!ns.length && !named.length) continue

  const rel = relative(srcRoot, file).replace(/\\/g, '/')
  const bad = []
  let refs = 0

  // 命名空间别名：整条路径校验
  for (const alias of ns) {
    for (const [path, count] of extractPaths(code, alias)) {
      refs++
      checked++
      const key = `${alias}.${path}`
      const r = lookup(path)
      if (!r.ok) {
        // 按路径去重报错（同一错误在多文件重复时只提示一次）
        const dedupKey = `${rel}|${key}`
        if (!seen.has(dedupKey)) {
          seen.add(dedupKey)
          bad.push(`    ✗ ${alias}.${path}  （在 ${r.at} 处不存在，出现 ${count} 次）`)
        }
      }
    }
  }

  // 具名导入：成员本身必须存在
  for (const name of named) {
    refs++
    checked++
    if (!(name in Cesium)) bad.push(`    ✗ import { ${name} } from 'cesium'  （cesium 未导出该成员）`)
  }

  if (bad.length) {
    failures += bad.length
    console.log(`  ✗ ${rel}`)
    bad.forEach(b => console.log(b))
  } else {
    console.log(`  ✓ ${rel}  (${refs} 个引用)`)
  }
}

// ---------- 重点回归：SceneTransforms 投影 API ----------
console.log('\n【重点回归】SceneTransforms 投影 API（1.121 改名过）')
{
  const st = Cesium.SceneTransforms
  const hasNew = typeof st.worldToWindowCoordinates === 'function'
  const hasOld = typeof st.wgs84ToWindowCoordinates === 'function'
  console.log(`      worldToWindowCoordinates (≥1.121 新名): ${hasNew}`)
  console.log(`      wgs84ToWindowCoordinates (<1.121 旧名): ${hasOld}`)
  if (!hasNew && !hasOld) {
    failures++
    console.log('  ✗ 两个名字都不存在 —— utils/cesium.js 的兼容封装会一直返回 null')
  } else {
    console.log(`  ✓ 兼容封装可命中 ${hasNew ? '新' : '旧'} API`)
  }
}

// ---------- 重点回归：Cartesian3 上不该有 fromCartesian ----------
console.log('\n【重点回归】Cartesian3 / Cartographic 的静态方法归属')
{
  const cartesianHasFromCartesian = typeof Cesium.Cartesian3.fromCartesian === 'function'
  const cartographicHasFromCartesian = typeof Cesium.Cartographic.fromCartesian === 'function'
  console.log(`      Cartesian3.fromCartesian   : ${cartesianHasFromCartesian}  ← 必须为 false`)
  console.log(`      Cartographic.fromCartesian : ${cartographicHasFromCartesian}  ← 必须为 true`)
  if (cartesianHasFromCartesian) {
    failures++
    console.log('  ✗ Cartesian3 上出现了 fromCartesian，与本项目的修复前提不符')
  } else if (!cartographicHasFromCartesian) {
    failures++
    console.log('  ✗ Cartographic.fromCartesian 不存在，测面积实现需要重新评估')
  } else {
    console.log('  ✓ 归属正确：fromCartesian 只在 Cartographic 上')
  }
}

// ---------- 回归：兼容封装的边界行为 ----------
console.log('\n【回归】worldToWindowCoordinates 封装边界行为')
{
  const { worldToWindowCoordinates } = await import('../src/utils/cesium.js').catch(() => ({}))
  if (typeof worldToWindowCoordinates !== 'function') {
    console.log('      （Node 下无法 import 该模块，跳过；由浏览器运行时覆盖）')
  } else {
    for (const [label, scene, pos] of [
      ['scene=null', null, {}],
      ['position=null', {}, null],
      ['两者都为 null', null, null]
    ]) {
      let got, err = null
      try { got = worldToWindowCoordinates(scene, pos) } catch (e) { err = e }
      if (err) { failures++; console.log(`  ✗ ${label}: 抛错 ${err.message}`) }
      else if (got !== null) { failures++; console.log(`  ✗ ${label}: 返回 ${got}，期望 null`) }
      else console.log(`  ✓ ${label} → null（不抛错）`)
    }
  }
}

// ---------- 回归：测面积核心算法（computeEnuArea 的 ENU 投影 + 鞋带） ----------
console.log('\n【回归】测面积的 ENU 投影与鞋带公式')
{
  // 构造正南北正方形：纬向边长用「每度 111320m」，经向按该纬度做余弦修正。
  // 注意：这样构造出来的"100m"并不精确等于 100m，所以真值要用椭球测地线实测，
  // 不能直接拿 100×100 当基准（否则会把构造误差误判成算法误差）。
  const baseLng = 114.4673
  const baseLat = 37.9841
  const dLat = 100 / 111320
  const dLng = 100 / (111320 * Math.cos(Cesium.Math.toRadians(baseLat)))
  const coords = [
    [baseLng, baseLat],
    [baseLng + dLng, baseLat],
    [baseLng + dLng, baseLat + dLat],
    [baseLng, baseLat + dLat]
  ]
  const points = coords.map(c => Cesium.Cartesian3.fromDegrees(c[0], c[1]))

  // 真值：用椭球测地线量出两条边，乘积即真实面积
  const geoDist = (a, b) => new Cesium.EllipsoidGeodesic(
    Cesium.Cartographic.fromCartesian(a),
    Cesium.Cartographic.fromCartesian(b)
  ).surfaceDistance
  const trueArea = geoDist(points[0], points[1]) * geoDist(points[1], points[2])
  console.log(`      真值（测地线边长乘积）= ${trueArea.toFixed(2)} m²`)

  // 与 measure.js#computeEnuArea 一致的实现（逆矩阵变到局部 ENU）
  function computeEnuArea(pts) {
    if (pts.length < 3) return 0
    const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(pts[0])
    const inverseFrame = Cesium.Matrix4.inverse(enuFrame, new Cesium.Matrix4())
    const planar = pts.map(p => {
      const local = Cesium.Matrix4.multiplyByPoint(inverseFrame, p, new Cesium.Cartesian3())
      return { e: local.x, n: local.y }
    })
    let area = 0
    const n = planar.length
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      area += planar[i].e * planar[j].n - planar[j].e * planar[i].n
    }
    return Math.abs(area) / 2
  }

  let area = 0
  try {
    area = computeEnuArea(points)
  } catch (e) {
    failures++
    console.log(`  ✗ ENU 投影抛错: ${e.message}`)
  }

  if (area > 0) {
    const errPct = Math.abs(area - trueArea) / trueArea * 100
    console.log(`      算法算得 = ${area.toFixed(2)} m²（偏差 ${errPct.toFixed(3)}%）`)
    if (errPct < 0.1) console.log('  ✓ 测面积算法正确（偏差 <0.1%，与函数注释一致）')
    else { failures++; console.log('  ✗ 测面积偏差超过 0.1%') }
  }

  // 再验证：错误写法（列向量点积）会明显偏离，说明这个回归有区分度
  const m = Cesium.Transforms.eastNorthUpToFixedFrame(points[0])
  const badEast = new Cesium.Cartesian3(m[0], m[4], m[8])
  const badNorth = new Cesium.Cartesian3(m[1], m[5], m[9])
  const badPlanar = points.map(p => {
    const v = Cesium.Cartesian3.subtract(p, points[0], new Cesium.Cartesian3())
    return { e: Cesium.Cartesian3.dot(v, badEast), n: Cesium.Cartesian3.dot(v, badNorth) }
  })
  let badArea = 0
  for (let i = 0; i < badPlanar.length; i++) {
    const j = (i + 1) % badPlanar.length
    badArea += badPlanar[i].e * badPlanar[j].n - badPlanar[j].e * badPlanar[i].n
  }
  badArea = Math.abs(badArea) / 2
  const badErr = Math.abs(badArea - trueArea) / trueArea * 100
  console.log(`      对照/错误写法（列向量点积）= ${badArea.toFixed(2)} m²（偏差 ${badErr.toFixed(2)}%）`)
  if (badErr > 1) console.log('  ✓ 错误写法确实会明显偏离 —— 本回归有区分度')
  else { failures++; console.log('  ✗ 错误写法没有明显偏离，回归失去意义') }
}

console.log('')
if (failures) {
  console.log(`失败 ${failures} 处 —— 见上面 ✗`)
  process.exit(1)
}
console.log(`全部通过 ✓ —— 共校验 ${checked} 个 Cesium API 引用，全部存在于 ${Cesium.VERSION}`)
