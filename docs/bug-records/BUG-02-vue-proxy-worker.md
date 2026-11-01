# BUG-02　Cesium 对象进入 Vue 深度响应式导致 Worker 结构化克隆失败

| 项 | 内容 |
|---|---|
| 问题类型 | 框架集成 / 对象序列化约束 |
| 所属模块 | 前端状态管理（`frontend/src/stores/map.js`）、三维组件（`CesiumViewer.vue`） |
| 严重程度 | 高 —— 渲染中断，三维场景完全不可用 |
| 状态 | 已修复并验证（含自动化回归脚本） |
| 记录日期 | 2026-10-30 |
| 对应 README 约束 | 「关键实现约束」第 1 条 |

## 一、现象

页面一打开就弹出错误面板，三维场景停止渲染：

```
An error occurred while rendering. Rendering has stopped.
DataCloneError: Failed to execute 'postMessage' on 'Worker': [object Object] could not be cloned.
```

## 二、根因

**响应式 Proxy 被送进了 Worker 的 `postMessage`。**

1. `ref()` 会把 `.value` 里的对象、`reactive()` 会把整个对象包装成 Proxy；访问任意属性返回的仍是代理子对象 —— 递归的深度代理；
2. HTML 的结构化克隆算法（`structuredClone` / `postMessage` 使用）**不支持 Proxy**，尝试克隆直接抛 `DataCloneError`；
3. Cesium 的几何构建在 Web Worker 执行，主线程通过
   `worker.postMessage({ id, baseUrl, parameters, canTransferArrayBuffer })` 投递任务；
4. 一旦 `parameters` 里混入 Vue 的 Proxy，克隆立刻失败，异常逃出 `viewer.render()`，被渲染循环的 `catch` 捕获并弹面板。

Cesium 官方仓库 issue [#12438](https://github.com/CesiumGS/cesium/issues/12438) 的结论与此一致：**不应把 Viewer / DataSource 放进 Vue、Pinia 等框架的响应式状态**。

## 三、修复

### 3.1 错误写法（修复前）

```js
// stores/map.js —— 用 ref 持有 Viewer
const viewer = ref(null)
// viewer.value 被深度代理成 Proxy，传回 Cesium 即触发 DataCloneError
const dataSources = reactive({})   // 同理：存入的 DataSource 被深度代理
```

### 3.2 正确写法（修复后，`stores/map.js`）

```js
const viewer = shallowRef(null)                 // L46
const measureController = shallowRef(null)      // L50
const baseAnnotationLayer = shallowRef(null)    // L55
const dataSources = shallowReactive({})         // L97
```

组件层同理（`CesiumViewer.vue`）：容器 DOM 用 `shallowRef`（会被 Viewer 长期持有）；
不可变的 Cesium 值（颜色等常量）用 `markRaw()` 锁死，作为备选方案。
全项目 shallow 变体使用点：`stores/map.js` 共 10 处、`CesiumViewer.vue` 共 6 处。

## 四、修复效果与权衡

`shallowRef` / `shallowReactive` 只代理最外层（`.value` 替换、顶层属性增删），不递归代理内部：

1. 从 `dataSources.teaching` 取出的是**原始** `DataSource` 实例，可安全进入 Worker；
2. 对 `dataSources` 增删图层 key 仍触发视图更新，功能不受损；
3. 对 Viewer 内部状态（如相机位置）不产生响应式追踪 —— 本项目不需要，改由 Cesium 自身事件驱动。

## 五、验证（`npm run verify:cesium`）

`frontend/scripts/verify-cesium-reactivity.mjs` 用 Node 的 `worker_threads` 复现浏览器结构化克隆语义，
对多种包装方式做可克隆性断言。2026-10-30 实测全部通过：

| 包装方式 | 期望 | 实测结论 |
|---|---|---|
| 原始类实例 / 普通对象 | 可克隆 | 可克隆（基线） |
| `ref()` 的 `.value`（类实例） | 不可克隆 | 不可克隆（DataCloneError） |
| `reactive()` 包普通对象 | 不可克隆 | 不可克隆（DataCloneError） |
| `reactive()` 里嵌套的类实例 | 不可克隆 | 不可克隆（DataCloneError） |
| `shallowRef()` 的 `.value` | 可克隆 | 可克隆（本项目采用） |
| `shallowReactive({})` 存的类实例 | 可克隆 | 可克隆（本项目采用） |
| `markRaw(类实例)` | 可克隆 | 可克隆（备选方案） |
| `shallowReactive` 顶层增删改 | 可追踪 | 正常追踪（1→2→3→4） |

该脚本的价值：让「响应式包装会破坏 Worker 通信」这一结论**离线、可重复**，不依赖人工点页面。

## 六、经验

1. 框架响应式状态只放纯数据结构，不放第三方引擎实例（Viewer、DataSource、DOM 节点、WebGL 资源）；
2. 必须响应式持有的引擎实例用 `shallowRef` / `shallowReactive`；完全不需要响应式的常量用 `markRaw`；
3. 跨线程传参前（Worker / iframe `postMessage`）确认参数中不含 Proxy、函数、类实例等方法承载对象；
4. 把这类约束写进 README「关键实现约束」并配回归脚本，防止后续开发回退。
