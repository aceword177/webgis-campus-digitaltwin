/**
 * Cesium 运行时行为探针 + 回归测试。
 *
 * 重点是 **回归**：`GeoJsonDataSource.isLoading` 是**布尔属性**而不是方法。
 * 曾经把它写成 `dataSource.isLoading?.()` —— `?.` 只对 null/undefined 短路，
 * 对"存在但不是函数"的值照样调用，于是抛 TypeError。又因为 Cesium 的点击
 * 回调是 async，异常变成未处理的 Promise rejection，**整个点击处理器静默中断，
 * 弹窗再也不出现**，且控制台不会亮红字。
 *
 * 用法：node scripts/verify-cesium-behavior.mjs
 */
import * as Cesium from 'cesium'
import { markRaw } from 'vue'

let failures = 0
const fail = (m) => { failures++; console.log(`  ✗ ${m}`) }
const pass = (m) => console.log(`  ✓ ${m}`)

console.log('Cesium 运行时行为探针 + 回归测试\n')

const BUILDING_KEYS = ['teaching', 'dormitory', 'other']

/** 与 CesiumViewer.vue#isBuildingGeometryLoading 保持一致的实现 */
function isBuildingGeometryLoading(dataSources) {
  for (const key of BUILDING_KEYS) {
    const ds = dataSources[key]
    if (ds && ds.isLoading === true) return true
  }
  return false
}

// ---------- 1. 回归：isLoading 是布尔属性 ----------
console.log('【1】回归：isLoading 的类型（写错会让点击静默失效）')
{
  const gds = new Cesium.GeoJsonDataSource('probe')
  const cds = new Cesium.CustomDataSource('probe')
  console.log(`      GeoJsonDataSource.isLoading : ${typeof gds.isLoading}（值 ${gds.isLoading}）`)
  console.log(`      CustomDataSource.isLoading  : ${typeof cds.isLoading}（值 ${cds.isLoading}）`)

  if (typeof gds.isLoading !== 'boolean') {
    fail('GeoJsonDataSource.isLoading 不再是布尔 —— 守卫实现需要跟着改')
  } else {
    pass('GeoJsonDataSource.isLoading 是布尔属性（不是方法）')
  }

  // 反面教材：把它当方法调用必须抛 TypeError，这正是当初的 bug
  let threw = false
  try {
    // eslint-disable-next-line no-unused-expressions
    gds.isLoading?.()
  } catch (e) {
    threw = e instanceof TypeError
  }
  if (threw) {
    pass('把布尔属性当方法调用会抛 TypeError —— 证明 `isLoading?.()` 是错的写法')
  } else {
    fail('`isLoading?.()` 没有抛错，与预期不符，需重新确认')
  }
}

// ---------- 2. 回归：守卫本身不抛错且语义正确 ----------
console.log('\n【2】回归：守卫函数在各种输入下都不抛错')
{
  const loaded = await Cesium.GeoJsonDataSource.load(
    { type: 'FeatureCollection', features: [] }, { clampToGround: false }
  )

  const cases = [
    ['空注册表（数据未加载）', {}, false],
    ['dataSource 正常（isLoading=false）', { teaching: loaded }, false],
    ['dataSource 为 undefined', { teaching: undefined, dormitory: null }, false],
    ['混入非 DataSource 的普通对象', { teaching: { isLoading: false } }, false],
    ['顶层是数组而非对象', { teaching: [] }, false],
    ['模拟 isLoading=true', { teaching: { isLoading: true } }, true]
  ]

  for (const [label, sources, expected] of cases) {
    let got
    let err = null
    try { got = isBuildingGeometryLoading(sources) } catch (e) { err = e }
    if (err) {
      fail(`${label}: 抛错 ${err.message}`)
    } else if (got !== expected) {
      fail(`${label}: 返回 ${got}，期望 ${expected}`)
    } else {
      pass(`${label} → ${got}`)
    }
  }
}

// ---------- 3. 实体属性足以独立支撑弹窗 ----------
console.log('\n【3】实体属性是否足以独立支撑弹窗（pointQuery 失败时的兜底）')
{
  const ds = await Cesium.GeoJsonDataSource.load({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[114.4673, 37.9841], [114.4682, 37.9842], [114.4682, 37.9840], [114.4673, 37.9841]]]
      },
      properties: {
        id: 1, name: '6号教学楼', height: 6, dept_name: '商学院', description: '学院简介',
        geom: '{"type":"Polygon","coordinates":[[[114.4673,37.9841],[114.4682,37.9842],[114.4682,37.9840],[114.4673,37.9841]]]}'
      }
    }]
  }, { clampToGround: false })

  const entity = ds.entities.values[0]
  const read = (k) => entity.properties?.[k]?.getValue()
  const snapshot = {
    id: read('id'), name: read('name'), height: read('height'),
    dept_name: read('dept_name'), description: read('description')
  }
  console.log(`      读到: ${JSON.stringify(snapshot)}`)

  const complete = snapshot.id === 1 && snapshot.name && snapshot.height && snapshot.dept_name && snapshot.description
  if (complete) pass('弹窗所需字段全部可从实体属性取得（不依赖后端反查）')
  else fail('实体属性不完整，弹窗兜底方案不可靠')

  // 拉伸后 hierarchy 必须可解析，否则几何生不出来、也就 pick 不到
  entity.polygon.extrudedHeight = 21
  entity.polygon.height = 0
  if (entity.polygon.hierarchy?.getValue?.()) pass('拉伸后 polygon.hierarchy 可解析（几何可生成）')
  else fail('拉伸后 hierarchy 解析失败 —— 建筑 pick 不到')
}

// ---------- 4. markRaw + Cesium 对象 ----------
console.log('\n【4】markRaw 包裹 Cesium 对象是否安全')
{
  const raw = Cesium.Color.fromCssColorString('#7EC8FF').withAlpha(0.95)
  const marked = markRaw(raw)
  if (marked === raw) pass('markRaw 返回同一实例（引用未变）')
  else fail('markRaw 返回了新对象')
  if (marked instanceof Cesium.Color && marked.equals(raw)) pass('仍是有效 Color，equals() 正常')
  else fail('markRaw 后 Color 失效')
}

// ---------- 5. 描边注册依赖的 getByName ----------
console.log('\n【5】DataSourceCollection.add / getByName 契约（描边注册依赖）')
{
  const collection = new Cesium.DataSourceCollection()
  const added = new Cesium.CustomDataSource('outline-teaching')

  // 关键：add() 是异步的，await 之前集合里还查不到
  collection.add(added)
  const beforeAwait = collection.getByName('outline-teaching')
  console.log(`      add() 后未 await: getByName = ${JSON.stringify(beforeAwait)}`)
  if (Array.isArray(beforeAwait) && beforeAwait.length === 0) {
    pass('未 await 时 getByName 返回空数组 —— 这正是描边注册静默失效的原因')
  } else {
    console.log(`      （本次未复现；返回 ${JSON.stringify(beforeAwait)}，不同 Cesium 版本行为可能不同）`)
  }

  await Promise.resolve()
  await collection.add(new Cesium.CustomDataSource('outline-dormitory'))

  const hit = collection.getByName('outline-teaching')
  const miss = collection.getByName('not-exist')
  console.log(`      await 后命中: ${Array.isArray(hit) ? `数组(长度${hit.length})` : typeof hit}`)
  if (Array.isArray(hit) && hit[0]?.name === 'outline-teaching') {
    pass('await 之后 getByName 能查到目标 dataSource')
  } else {
    fail('await 之后仍查不到 —— 描边无法登记进图层注册表')
  }
  if (Array.isArray(miss) && miss.length === 0) pass('未命中返回空数组，?.length 判断可容忍')
  else fail('未命中返回值不符合预期')
}

console.log('')
if (failures) {
  console.log(`失败 ${failures} 项`)
  process.exit(1)
}
console.log('全部通过 ✓')
