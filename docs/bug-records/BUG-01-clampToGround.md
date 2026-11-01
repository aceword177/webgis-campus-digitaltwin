# BUG-01　拉伸建筑误用 `clampToGround` 导致渲染管线语义冲突

| 项 | 内容 |
|---|---|
| 问题类型 | 渲染配置 / 图形管线冲突 |
| 所属模块 | 前端三维场景（`frontend/src/utils/cesium.js`） |
| 严重程度 | 高 —— 渲染中断，三维场景完全不可用 |
| 状态 | 已修复并验证（含自动化回归脚本） |
| 记录日期 | 2026-10-30 |
| 对应 README 约束 | 「关键实现约束」第 2 条 |

## 一、现象

加载建筑面数据并拉伸为立体白模后，浏览器弹出 Cesium 渲染错误面板，三维场景停止渲染：

```
An error occurred while rendering. Rendering has stopped.
DataCloneError: Failed to execute 'postMessage' on 'Worker': [object Object] could not be cloned.
```

崩溃前可见征兆：建筑几何被**反复销毁与重建**，画面持续卡顿，CPU 与 Worker 任务队列明显升高，体块闪烁/残缺。

## 二、复现路径

1. 用 `Cesium.GeoJsonDataSource.load(geoJson, { clampToGround: true })` 加载建筑 GeoJSON；
2. 加载后遍历实体，为 `entity.polygon` 设置 `height` 与 `extrudedHeight`，要求多边形立起来；
3. Cesium 需同时满足「贴到地形表面」与「按固定高度拉伸」两个矛盾约束 → 反复重建几何 → Worker 几何任务异常。

## 三、根因

### 3.1 一个多边形对应两条互斥的渲染管线

| 配置 | 渲染管线 | 几何语义 | 是否支持拉伸 |
|---|---|---|---|
| `clampToGround: true` | `GroundPrimitive`（贴地图元） | 投影铺盖到地形表面的二维薄片 | 不支持 |
| `clampToGround: false` | `Primitive` + `PolygonGeometry` | 顶/侧/底构成的封闭立体网格 | 识别 `height` 与 `extrudedHeight` |

`GroundPrimitive` 的职责只有"贴附"：每个点的高度由脚下地形决定，不存在独立的底部/顶部高度，因此无法识别 `extrudedHeight`。要求贴地管线完成拉伸，等于让只会铺毯子的机制去盖楼。

### 3.2 与 `DataCloneError` 的关系（论文严谨性关键）

这里不能写成单一因果链。项目里是**两条独立缺陷**：

- **BUG-02**：Vue 的响应式 Proxy 被传进 Worker 的 `postMessage` 参数 → 结构化克隆失败 → `DataCloneError`；
- **BUG-01**：贴地/拉伸语义冲突 → 几何反复重建 → Worker 几何任务密集调度，是错误暴露的**关联背景**，但不是 `DataCloneError` 的直接原因。

修复后两条各自消失，对应的验证脚本也不同（`verify-cesium-reactivity.mjs` vs `verify-building-outlines.mjs`）。

## 四、修复

### 4.1 错误写法（修复前）

```js
const dataSource = await Cesium.GeoJsonDataSource.load(geoJson, {
  clampToGround: true,   // 贴地管线，与拉伸语义互斥
})
// 随后又要求多边形立起 —— 与上面的贴地配置冲突
entity.polygon.height = 0
entity.polygon.extrudedHeight = height * FLOOR_HEIGHT
```

### 4.2 正确写法（修复后，`cesium.js` L120-L187）

```js
const dataSource = await Cesium.GeoJsonDataSource.load(geoJson, {
  stroke: Cesium.Color.WHITE.withAlpha(0.3),
  strokeWidth: 1,
  fill: BUILDING_COLORS[buildingType] || BUILDING_COLORS.other,
  clampToGround: false          // 走立体 Primitive 管线
})
// 实体遍历中：底部 0，顶部 = 层数 × 3.5 m
entity.polygon.height = 0
entity.polygon.extrudedHeight = height * FLOOR_HEIGHT   // FLOOR_HEIGHT = 3.5，L9
entity.polygon.outline = false                          // 拉伸体不带 outline
await addBuildingOutlines(viewer, features, buildingType) // L184，描边改用贴地 polyline
```

### 4.3 描边的替代处理（关键工程细节）

`polygon.outline` 只对贴地多边形生效，对拉伸立体块不渲染。修复中显式 `outline = false`，并新增
`addBuildingOutlines()`（`cesium.js` L201）：新建独立 `CustomDataSource`，沿每栋建筑外 footprint 添加
`clampToGround: true` 的白色贴地折线（宽 1.5），既保证边界清晰，又不动立体管线。

> 注意：该函数内部必须 `await viewer.dataSources.add(dataSource)` —— `add()` 是异步的，
> 不 await 时对象尚未进入集合，调用方紧接着 `getByName()` 会查到空数组。

## 五、涉及代码位置（实测）

| 文件 | 位置 | 作用 |
|---|---|---|
| `frontend/src/utils/cesium.js` | L120-L187 | `loadBuildings()`：加载并拉伸建筑白模 |
| `frontend/src/utils/cesium.js` | L126 | `clampToGround: false`（修复点） |
| `frontend/src/utils/cesium.js` | L154 附近 | 设置 `height` / `extrudedHeight` / `outline = false` |
| `frontend/src/utils/cesium.js` | L184、L201 | 调用并定义 `addBuildingOutlines` 贴地描边 |
| `frontend/src/utils/cesium.js` | L9、L12 | `FLOOR_HEIGHT = 3.5`、`BUILDING_COLORS` 配色表 |
| `frontend/scripts/verify-building-outlines.mjs` | 全文件 | 描边几何提取的集成自检（需后端） |

## 六、验证

- 重新加载三类建筑图层（教学 / 宿舍 / 其他），建筑稳定拉伸，不再出现渲染中断面板；
- 贴地白色描边沿建筑轮廓正确显示，图层开关可控制显隐；
- Worker / CPU 占用恢复正常，几何不再反复重建；
- `npm run verify:outlines`（集成校验，需后端）通过。

## 七、经验

1. 图形引擎的高层属性往往对应不同底层渲染管线，配属性前先理解渲染路径与适用边界，不能只看表面开关；
2. 需要立体拉伸的多边形一律 `height` / `extrudedHeight` + 关闭 `clampToGround`，二者不可混用；
3. 拉伸体轮廓不依赖 `polygon.outline`，统一用独立贴地 polyline 勾边，作为项目固定约定；
4. 为渲染管线类问题建立可重复运行的验证脚本，使修复可回归、可溯源。
