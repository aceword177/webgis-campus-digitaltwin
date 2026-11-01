# BUG-03　跟随相机把「度」当作「弧度」相加，导致视角偏移约 2 km

| 项 | 内容 |
|---|---|
| 问题类型 | 单位换算错误 / 相机控制逻辑 |
| 所属模块 | 前端三维场景（`frontend/src/utils/cesium.js` → `createDroneAnimation`） |
| 严重程度 | 中高 —— 功能不崩溃，但演示视角完全失效，且每次播放必现 |
| 状态 | 已修复并验证（含跟随机位参数调优） |
| 记录日期 | 2026-11-01 |
| 对应 README 约束 | 「关键实现约束」第 6 条 |

## 一、现象

无人机飞行动画提供「跟随 / 第一人称 / 俯瞰」三种视角。跟随视角的设计是把相机放在无人机**后方 35 m、上方 18 m**，
朝向飞行方向；实际播放时相机被甩到校园之外，校园压在远处地平线、无人机缩成一个点。

实测水平距离 **≈ 2030 m**（设计值 35 m）。每次点「播放飞行动画」必现，与航线、订单无关。

## 二、根因：把「度」加到了「弧度」上

`Cesium.Cartographic` 的 `longitude` / `latitude` 以**弧度**存储（1 rad ≈ 57.2958°，1° = 0.017453 rad），
而代码把「米 ÷ 111320 得到的度」直接与弧度相加：

```js
// ❌ 修复前（updateCamera 的 follow 分支）
const eastOffset = Math.sin(headingOpposite) * cameraDistance   // 单位：米（35）
const northOffset = Math.cos(headingOpposite) * cameraDistance  // 单位：米
const cameraCartographic = new Cesium.Cartographic(
  cartographic.longitude + eastOffset / (111320 * Math.cos(cartographic.latitude)),  // 得到「度」，却加给了弧度
  cartographic.latitude  + northOffset / 111320,
  cartographic.height    + cameraHeight
)
```

### 2.1 放大倍数推导

35 m 在该纬度（约 37.98°）换算为经度偏移 `35 / (111320 × cos 37.98°) ≈ 0.00040°`，
被当成 `0.00040 rad` 使用：`0.00040 × (180/π) ≈ 0.0229°`，约合 **2030 m**。
相对设计值放大了 `1 / 0.017453 ≈ 57.3` 倍 —— 恰好是度与弧度的换算系数。

### 2.2 为什么表现为「高度正确、水平错误」

`Cartographic.height` 本身就是米，与 `cameraHeight` 同量纲直接相加，不涉及换算；
只有经纬度需要「米 → 度 → 弧度」两级换算。**这个不对称性把问题范围从"相机逻辑全错"缩小到"水平换算错"**，
是本次定位的突破口。

## 三、另外两个连带缺陷

### 3.1 `stop()` 只复位坐标系，不恢复视角

动画结束或手动停止后，`stop()` 原本只调用 `viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)`，
相机仍停在无人机旁 35 m、离地数十米处 —— 主观感受同样是"视角自己偏移了"。

### 3.2 `lookAt` 的局部坐标系陷阱

俯瞰模式用 `camera.lookAt()`，会把相机切到以无人机为原点的局部 ENU 坐标系。
此时若直接 `flyTo` / `setView` 世界坐标，该坐标会被当作**局部坐标**解释，相机再次飞错。
正确顺序必须是：先 `lookAtTransform(IDENTITY)` 复位坐标系，再 `flyTo` 世界坐标。

## 四、修复

### 4.1 统一以「度」组装坐标（`cesium.js` L957）

```js
const cameraPosition = Cesium.Cartesian3.fromDegrees(
  Cesium.Math.toDegrees(cartographic.longitude) + eastOffset / (111320 * Math.cos(cartographic.latitude)),
  Cesium.Math.toDegrees(cartographic.latitude)  + northOffset / 111320,
  cartographic.height + cameraHeight
)
```

### 4.2 视角存档与恢复（`cesium.js` L876 / L886）

`start()` 之前保存 `camera.positionWC` 与 `heading / pitch / roll`；`stop()` 中先复位坐标系，再 1.2 s 飞回原视角：

```js
function restoreCameraView() {
  if (!savedView) return
  const view = savedView; savedView = null
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)   // 先退出局部坐标系
  viewer.camera.flyTo({
    destination: view.destination,
    orientation: { heading: view.heading, pitch: view.pitch, roll: view.roll },
    duration: 1.2
  })
}
```

### 4.3 机位参数抽成常量（`cesium.js` L920）

原机位（后 35 / 上 18 / 俯角 −15°）贴得过近，穿越教学区时相机会切进楼体内部。
现集中为 `FOLLOW_CAMERA`，由逐帧更新 `updateCamera()` 与入场 `start()` **共用**，
并调整为后 50 m / 上 28 m / 俯角 −22°：

```js
const FOLLOW_CAMERA = { distance: 50, height: 28, pitch: Cesium.Math.toRadians(-22) }
```

抽常量的目的：消除"两处数值各自维护、改一处忘另一处"的隐患 —— 这正是修复前 `start()` 与
`updateCamera()` 各写了一份 35/18 的由来。

## 五、量化取证（CDP 实测，不是肉眼判断）

在 `CesiumViewer.vue` 中以 `import.meta.env.DEV` 为条件暴露调试句柄 `window.__CESIUM_VIEWER__`
（生产构建不挂载），再用 Chrome DevTools Protocol 的 `Runtime.evaluate` 逐帧读取
`viewer.camera.positionCartographic` 与无人机实体位置：

| 时刻 | 无人机坐标（h） | 相机坐标（h） | 水平距离 |
|---|---|---|---|
| 播放 2 s（修复前） | (114.470785, 37.983206) h=51 | (114.447930, 37.983273) h=69 | ≈ 2030 m |
| 播放 2 s（修复后） | (114.470697, 37.983206) h=51 | (114.471096, 37.983207) h=69 | ≈ 35 m（设计值） |
| 停止后（修复后） | — | (114.467788, 37.978915) h=600 | 回到播放前视角 |

修复前后高度都是 69 m（51 + 18），只有水平距离从 2030 m 回到 35 m，与 2.1 的推导一致。

## 六、涉及代码位置（实测）

| 文件 | 位置 | 作用 |
|---|---|---|
| `frontend/src/utils/cesium.js` | L796 | `createDroneAnimation()` 入口 |
| `frontend/src/utils/cesium.js` | L876 / L886 | `saveCameraView` / `restoreCameraView` |
| `frontend/src/utils/cesium.js` | L891 | 恢复视角前先 `lookAtTransform(IDENTITY)` |
| `frontend/src/utils/cesium.js` | L920 | `FOLLOW_CAMERA`（50 / 28 / −22°） |
| `frontend/src/utils/cesium.js` | L927 | `updateCamera()` 逐帧更新相机 |
| `frontend/src/utils/cesium.js` | L957 | `Cartesian3.fromDegrees()`（修复点） |
| `frontend/src/utils/cesium.js` | L1009 / L1066 | `start()` 入场机位 / `stop()` 恢复视角 |
| `frontend/src/utils/cesium.js` | L1082 | `setViewMode()` 切换机位时复位 lookAt |
| `README.md` | 「关键实现约束」第 6 条 | 把该单位坑写成项目约定 |

## 七、验证

1. **数值**：水平距离 35 m（= 设计值）、高度差 18 m（= 设计值）、`pitch −22°`，与 `FOLLOW_CAMERA` 一致；
2. **画面**：播放中无人机稳定居中，航线走向与周边楼栋同时可见，穿越教学区不再切进楼体；
3. **停止**：点「停止」后 1.2 s 内飞回播放前视角，实测坐标与播放前一致；
4. **回归**：`npm run verify:offline` 5 个脚本全通过、`vite build` 通过、`eslint` 0 问题。

## 八、经验

1. **同一含义的量必须锁定单位**：Cartographic 用弧度、业务测算用「度」，跨界处必须显式 `toDegrees` / `toRadians`；
2. **用带单位语义的构造函数**：能用 `Cartesian3.fromDegrees` 就不要手工拼 `Cartographic`；
3. **用数量级自检兜底**：35 m 的机位偏移若换算成 0.02°（≈2 km），量级本身就是错误信号；
4. **相机状态成对管理**：进入特殊机位前存档、退出时恢复；用过 `camera.lookAt` 必须 `lookAtTransform(IDENTITY)` 才能回到世界坐标；
5. **共享参数集中为常量**：入场与逐帧更新共用同一组数值，避免复制导致漂移；
6. **把可见现象转成可观测量**：用 CDP 读真实坐标，把"看起来偏了"变成"偏了 2030 m"，修复与验证才有证据链。
