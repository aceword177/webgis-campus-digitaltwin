/**
 * 验证 Vue 响应式包装是否会破坏 Cesium 的 Worker 结构化克隆
 * （即 DataCloneError: Failed to execute 'postMessage' on 'Worker'）
 *
 * 背景：Cesium 几何构建走 Worker，主线程执行
 *   worker.postMessage({ id, baseUrl, parameters, canTransferArrayBuffer })
 * parameters 里含 Vue 的 reactive Proxy 时，结构化克隆会抛 DataCloneError。
 * 这正是 "An error occurred while rendering. Rendering has stopped." 的成因
 * （CesiumGS/cesium#12438）。
 *
 * 本测试用真实 Worker（Node worker_threads 使用与浏览器 Web Worker 相同的
 * HTML 结构化克隆算法，Proxy 同样无法克隆）断言：
 *   1. 原始对象引用                    → 可克隆
 *   2. ref()/reactive() 包过的          → **不可克隆**（复现 bug）
 *   3. shallowRef()/shallowReactive()   → 可克隆（本项目采用的修复）
 *   4. markRaw()                        → 可克隆（备选修复）
 *   5. shallowReactive 仍保留顶层响应式  → 不牺牲功能
 *
 * 用法：node scripts/verify-cesium-reactivity.mjs
 */
import { ref, reactive, shallowRef, shallowReactive, markRaw, watchEffect, nextTick } from 'vue'
import { Worker } from 'node:worker_threads'

let failures = 0

/** 用真实 Worker 的 postMessage 检验能否结构化克隆 */
function canClone(value) {
  const w = new Worker('setInterval(() => {}, 1000);', { eval: true })
  try {
    w.postMessage({ id: 1, baseUrl: '/cesium/', parameters: value, canTransferArrayBuffer: true })
    return { ok: true }
  } catch (e) {
    return { ok: false, err: e }
  } finally {
    w.terminate()
  }
}

function check(name, shouldClone, factory) {
  let value
  try {
    value = factory()
  } catch (e) {
    failures++
    console.log(`  ✗ ${name.padEnd(40)} 构造值本身抛错: ${e.message}`)
    return
  }
  const { ok, err } = canClone(value)
  const passed = ok === shouldClone
  if (!passed) failures++
  const got = ok ? '可克隆' : `不可克隆(${err?.name || 'Error'})`
  console.log(`  ${passed ? '✓' : '✗'} ${name.padEnd(40)} 期望=${shouldClone ? '可克隆  ' : '不可克隆'} 实际=${got}`)
  if (!passed && err) console.log(`      错误: ${err.message}`)
}

/** 模拟 Cesium 内部对象：带原型方法的普通类实例 */
class FakeEllipsoid {
  constructor() { this.radii = [6378137, 6378137, 6356752] }
  toString() { return 'Ellipsoid' }
}
class FakeViewer {
  constructor() {
    this.scene = { globe: { ellipsoid: new FakeEllipsoid() }, primitives: { length: 0 } }
    this.dataSources = { length: 0 }
  }
  render() { return 'rendered' }
}

console.log('验证 Vue 响应式包装对结构化克隆（Worker postMessage）的影响\n')

console.log('【1】基线：原始引用应可克隆')
check('原始类实例', true, () => new FakeViewer())
check('普通对象（含嵌套类实例）', true, () => ({ id: 1, ellipsoid: new FakeEllipsoid() }))

console.log('\n【2】复现 bug：深度响应式包装后不可克隆')
check('ref() 的 .value（类实例）', false, () => {
  const v = ref(null)
  v.value = new FakeViewer()
  return v.value
})
check('reactive() 包普通对象', false, () => reactive({ id: 1, items: [1, 2] }))
check('reactive() 里嵌套的类实例', false, () => reactive({ ellipsoid: new FakeEllipsoid() }).ellipsoid)
check('reactive({}) 里存的类实例', false, () => {
  const bag = reactive({})
  bag.viewer = new FakeViewer()
  return bag.viewer
})

console.log('\n【3】本项目修复：shallow 变体应可克隆')
check('shallowRef() 的 .value', true, () => {
  const v = shallowRef(null)
  v.value = new FakeViewer()
  return v.value
})
check('shallowReactive({}) 存的类实例', true, () => {
  const bag = shallowReactive({})
  bag.viewer = new FakeViewer()
  return bag.viewer
})

console.log('\n【4】备选修复：markRaw 应可克隆')
check('markRaw(类实例)', true, () => markRaw(new FakeViewer()))
check('ref() + markRaw 的 .value', true, () => {
  const v = ref(null)
  v.value = markRaw(new FakeViewer())
  return v.value
})

console.log('\n【5】回归：shallowReactive 仍支持本项目实际用到的读写方式')
{
  // 本项目 setLayerVisible 里就是 Object.entries(dataSources) 遍历 + 取单键
  const bag = shallowReactive({ teaching: new FakeViewer() })
  let iterations = 0
  let seenKeys = 0
  const stop = watchEffect(() => {
    seenKeys = Object.entries(bag).length // 建立 iterate 依赖（等价 setLayerVisible 的遍历）
    iterations++
  })
  // watchEffect 默认微任务 flush，必须 await nextTick 才能观察到计数变化
  await nextTick()
  const afterInit = iterations

  bag.dormitory = new FakeViewer()          // 新增 key（图层加载时就是这么塞的）
  await nextTick()
  const afterAdd = iterations

  bag.teaching = new FakeViewer()           // 替换已有 key
  await nextTick()
  const afterReplace = iterations

  delete bag.dormitory                      // 删除 key（CesiumViewer 里删规划航线用）
  await nextTick()
  const afterDelete = iterations
  stop()

  const ok = afterInit === 1 && afterAdd === 2 && afterReplace === 3 && afterDelete === 4 && seenKeys === 1
  if (!ok) failures++
  console.log(`  ${ok ? '✓' : '✗'} 遍历（Object.entries）追踪增删改   初始=${afterInit} 新增=${afterAdd} 替换=${afterReplace} 删除=${afterDelete}`)
  console.log(`      最终遍历到的 key 数 = ${seenKeys}（期望 1，已删除 dormitory）`)

  // 再确认取出来的值是**未经代理**的原始实例（这才是修复的关键）
  const raw = bag.teaching
  const { ok: cloneable } = canClone(raw)
  if (!cloneable) failures++
  console.log(`  ${cloneable ? '✓' : '✗'} 遍历/取值拿到的仍是原始实例（可进 Worker）`)
}

console.log('')
if (failures) {
  console.log(`失败 ${failures} 项`)
  process.exit(1)
}
console.log('全部通过 ✓ —— shallowRef/shallowReactive 确实解除 DataCloneError，且不损失顶层响应式')
