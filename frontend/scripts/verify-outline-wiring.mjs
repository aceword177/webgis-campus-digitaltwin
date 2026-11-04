/**
 * verify-outline-wiring.mjs —— 「建筑描边显隐联动」接线自检（纯静态，不需要浏览器/后端）
 *
 * 为什么需要它：
 *   2026-11 的缺陷 20 是「接线断开」而不是「机制错误」——
 *   `addBuildingOutlines` 建的 dataSource 叫 `building-outlines-<type>`，
 *   而 `CesiumViewer#loadBuildingLayer` 按 `outline-<type>` 用 getByName 去查；
 *   getByName 是**精确匹配**，查不到返回空数组，`if (outlines?.length)` 直接跳过，
 *   于是描边从未登记进图层注册表 → 关掉"教学楼"后白模消失、描边残留。
 *
 *   当时两道门禁都是绿的，因为：
 *     · `verify-cesium-behavior.mjs` 测的是 Cesium 的 add/getByName **机制**（自己造对象来查）；
 *     · `verify-building-outlines.mjs` 测的是 GeoJSON 外环**提取**。
 *   两者都没断言"生产代码里这几处的名字与传参是不是对得上"——本脚本补的就是这一层。
 *
 * 断言（任何一条不成立即 exit 1）：
 *   1. 描边 dataSource 的名字只用一种写法：`'outline-' + buildingType`
 *   2. `loadBuildings` 返回 `{ dataSource, outlineDataSource }`（**直接传对象**，不再靠名字取回）
 *   3. `CesiumViewer#loadBuildingLayer` 解构接收，并把两者分别登记进 store
 *   4. `CesiumViewer` 不再有描边相关的 `getByName`
 *   5. `stores/map.js` 的 `OUTLINE_KEY_OF` 恰好覆盖三个建筑类型，且值为 `outline-<type>`
 *   6. 建筑与描边都按当前开关回写 `show`（否则"加载完成前关掉的图层会被擅自点亮"）
 *   7. 死代码已清：`cesium.js` 里不再有 `OUTLINE_LAYER_OF`
 *
 * 用法：node scripts/verify-outline-wiring.mjs      （已挂进 npm run verify:wiring / verify:offline）
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

/**
 * 去掉注释再断言。
 * ⚠️ 第一版没做这一步，结果断言 #4 被**自己写的说明注释**触发（注释里有 `getByName('outline-<type>')`），
 *    门禁把"文档"当成"代码"报了失败 —— 这类假阳性同样会毁掉门禁的可信度。
 */
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split(/\r?\n/).map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n')

const cesium = stripComments(read('src/utils/cesium.js'))
const viewer = stripComments(read('src/components/CesiumViewer.vue'))
const store = stripComments(read('src/stores/map.js'))

let failures = 0
const pass = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => { failures++; console.log(`  ✗ ${m}`) }
const check = (cond, okMsg, badMsg) => (cond ? pass(okMsg) : fail(badMsg))

console.log('建筑描边显隐联动 —— 接线自检（静态）')

// ---------- 1. 描边 dataSource 只有一种命名写法 ----------
console.log('\n【1】描边 dataSource 的命名')
check(/new Cesium\.CustomDataSource\(\s*'outline-'\s*\+\s*buildingType\s*\)/.test(cesium),
  'addBuildingOutlines 用 `\'outline-\' + buildingType` 命名',
  'addBuildingOutlines 的命名写法变了（应为 `\'outline-\' + buildingType`）')
check(!/'building-outlines-'/.test(cesium),
  '不再存在 `\'building-outlines-\'` 这种第二套名字',
  'cesium.js 里仍出现 `\'building-outlines-\'` —— 两套名字会再次错位')

// ---------- 2. loadBuildings 直接返回对象 ----------
console.log('\n【2】loadBuildings 的返回形状')
check(/return\s*\{\s*dataSource\s*,\s*outlineDataSource\s*\}/.test(cesium),
  'loadBuildings 返回 `{ dataSource, outlineDataSource }`（对象直传）',
  'loadBuildings 没有返回 `{ dataSource, outlineDataSource }` —— 调用方会被迫靠名字取回')
check(/const outlineDataSource = await addBuildingOutlines\(/.test(cesium),
  'loadBuildings 捕获了 addBuildingOutlines 的返回值',
  'addBuildingOutlines 的返回值被丢弃了（曾经就是这样，只能靠 getByName 补救）')

// ---------- 3. 调用方解构并分别登记 ----------
console.log('\n【3】CesiumViewer#loadBuildingLayer 的登记')
check(/const\s*\{\s*dataSource\s*,\s*outlineDataSource\s*\}\s*=\s*await loadBuildings\(/.test(viewer),
  '解构接收 `{ dataSource, outlineDataSource }`',
  '没有解构接收 loadBuildings 的返回值')
check(/dataSources\[buildingType\]\s*=\s*dataSource/.test(viewer),
  '主图层登记到 `dataSources[buildingType]`',
  '主图层登记写法变了')
check(/dataSources\[\s*`outline-\$\{buildingType\}`\s*\]\s*=\s*outlineDataSource/.test(viewer),
  '描边登记到 `dataSources[`outline-${buildingType}`]`',
  '描边没有登记到 `outline-<type>` 这个 key —— setLayerVisible 会查不到')

// ---------- 4. 不再用 getByName 取回描边 ----------
console.log('\n【4】不许再用名字取回描边')
const getByNameOutline = /getByName\(\s*['"`]outline-/.test(viewer) || /getByName\(\s*outlineName/.test(viewer)
check(!getByNameOutline, 'CesiumViewer 里没有描边相关的 getByName',
  'CesiumViewer 仍有 `getByName(\'outline-…\')` —— 这是缺陷 20 的原始写法')

// ---------- 5. store 侧的映射与枚举一致 ----------
console.log('\n【5】stores/map.js 的 OUTLINE_KEY_OF')
const keyMapLiteral = store.match(/const OUTLINE_KEY_OF = \{([\s\S]*?)\}/)
check(!!keyMapLiteral, '找到 OUTLINE_KEY_OF 定义', '找不到 OUTLINE_KEY_OF 定义')
if (keyMapLiteral) {
  const body = keyMapLiteral[1]
  const expected = ['teaching', 'dormitory', 'other']
  const found = [...body.matchAll(/(\w+)\s*:\s*'([^']+)'/g)].map((m) => ({ type: m[1], key: m[2] }))
  console.log('      ' + found.map((f) => `${f.type} → ${f.key}`).join(' ｜ '))
  for (const t of expected) {
    const hit = found.find((f) => f.type === t)
    if (!hit) fail(`OUTLINE_KEY_OF 缺 ${t}`)
    else if (hit.key === `outline-${t}`) pass(`OUTLINE_KEY_OF.${t} = 'outline-${t}'（与登记 key 一致）`)
    else fail(`OUTLINE_KEY_OF.${t} = '${hit.key}'，与登记用的 'outline-${t}' 不一致`)
  }
  const extra = found.filter((f) => !expected.includes(f.type))
  check(extra.length === 0, '没有多余条目', `OUTLINE_KEY_OF 多出：${extra.map((e) => e.type).join(',')}`)
}

// ---------- 6. 加载完成后按开关回写 show ----------
console.log('\n【6】加载完成后的 show 回写')
check(/dataSource\.show\s*=\s*mapStore\.layers\[buildingType\]/.test(viewer),
  '主图层按当前开关回写 show',
  '主图层没回写 show —— 加载完成前关掉的图层会被擅自点亮')
check(/outlineDataSource\.show\s*=\s*mapStore\.layers\[buildingType\]/.test(viewer),
  '描边按当前开关回写 show',
  '描边没回写 show')

// ---------- 7. 死代码已清 ----------
console.log('\n【7】死导出清理')
check(!/OUTLINE_LAYER_OF/.test(cesium), 'cesium.js 里已无 OUTLINE_LAYER_OF（死导出）',
  'cesium.js 仍有 OUTLINE_LAYER_OF —— 要么用起来，要么删掉')

console.log(failures === 0
  ? '\n全部通过 ✓ —— 描边从创建、返回、登记到显隐联动，四处名字与传参闭合'
  : `\n失败 ${failures} 项 ✗`)
if (failures > 0) process.exit(1)
