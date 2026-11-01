# 缺陷档案（Bug Records）

开发过程中踩到并修掉的、**有推导价值**的缺陷记录。每篇尽量写清四件事：
怎么复现、根因是什么、怎么修的、怎么证明修好了 —— 便于回归，也便于在面试/论文里复述。

> 本目录只放技术内容。写给学校的完整版（含论文写作建议）是本地 Word 文档，不入库。

| 编号 | 标题 | 问题类型 | 严重程度 | 状态 |
|---|---|---|---|---|
| [BUG-01](./BUG-01-clampToGround.md) | 拉伸建筑误用 `clampToGround` 导致渲染管线语义冲突 | 渲染配置 / 图形管线冲突 | 高（渲染中断） | 已修复并验证 |
| [BUG-02](./BUG-02-vue-proxy-worker.md) | Cesium 对象进入 Vue 深度响应式导致 Worker 结构化克隆失败 | 框架集成 / 序列化约束 | 高（渲染中断） | 已修复并验证 |
| [BUG-03](./BUG-03-camera-radians.md) | 跟随相机把「度」当作「弧度」相加，导致视角偏移约 2 km | 单位换算 / 相机控制逻辑 | 中高（演示视角失效，必现） | 已修复并验证 |

## 三条各自的「一句话结论」

- **BUG-01**：贴地（`clampToGround` / `GroundPrimitive`）与拉伸（`height` + `extrudedHeight` / `Primitive`）
  是两条互斥管线，不能作用于同一个多边形；拉伸体的轮廓要另用贴地 `polyline` 勾。
- **BUG-02**：框架响应式状态只能放纯数据，引擎实例（Viewer / DataSource / DOM）一律 `shallowRef` / `shallowReactive`，
  否则 Proxy 会随 `postMessage` 进入 Worker，结构化克隆直接抛 `DataCloneError`。
- **BUG-03**：`Cartographic` 的经纬度是**弧度**；把「米换算得到的度」加上去会被放大约 57.3 倍（35 m → 2 km）。
  用 `Cartesian3.fromDegrees` 组装，别手工拼 `Cartographic`。

## 与 README 的对应关系

README 的「[关键实现约束](../..#关键实现约束改代码前必读)」是**结论清单**（写代码前必读），
本目录是这些结论的**推导过程**（为什么这么定）。两者一一对应：

| README 约束 | 对应缺陷 |
|---|---|
| 第 1 条：绝不把 Cesium 对象放进 Vue 响应式 | BUG-02 |
| 第 2 条：拉伸建筑不能用 `clampToGround: true` | BUG-01 |
| 第 6 条：相机飞行要用 `fromDegrees` | BUG-03 |

## 自动化回归

修复不靠"再看一眼"，而是靠脚本：

```bash
cd frontend
npm run verify:offline   # 5 个离线脚本：响应式克隆、Cesium API 用法、点选行为、弹窗定位、组件约定
npm run verify:outlines  # 建筑描边几何提取（集成校验，需后端 :8080）
```

`verify-cesium-reactivity.mjs` 用 Node 的 `worker_threads` 复现浏览器结构化克隆语义，
把「响应式包装会破坏 Worker 通信」变成一条可离线重复的断言 —— BUG-02 的结论即由此锁住。
