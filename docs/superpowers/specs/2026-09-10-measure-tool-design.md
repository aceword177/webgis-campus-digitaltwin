# 测量工具优化设计：动态预览 + 撤销 + 信息条 + 精确计算

> 日期：2026-09-10
> 状态：已获用户逐节批准（节 1~4）
> 目标：将测距/测面积从"点击落点+右键结束+近似计算"升级为"动态预览 + 右键撤销 + 双击结束 + 悬浮信息条实时汇总 + 精确面积计算"，并把测量逻辑从 CesiumViewer.vue 抽离为独立模块

## 0. 背景（现状与痛点）

现状（已核实代码）：
- 测距：左键逐点 → 红点 + 黄色折线 + 每段中点距离标签；右键结束（右键无汇总逻辑）。无总长度、无鼠标移动预览。
- 测面积：左键逐点 → 实时重建黄色半透明多边形；右键显示"面积: xxx"后结束。无周长/边长、无预览。
- 面积算法：`computePolygonArea`（CesiumViewer.vue）用"经纬度度数鞋带公式 × 米/度系数"的平面近似。
- 交互缺口：误点无法撤销（只能"清除"重来）；`handleModeChange` 提示为空函数；测量逻辑内联在 CesiumViewer.vue（已 700+ 行）。

用户确认的优化范围：A 交互体验 + B 信息完整性 + C 计算精度 + D 视觉呈现，全部实施。

## 1. 设计节 1：utils/measure.js 测量模块（核心）

### 1.1 定位与状态机

独立 ES 模块，不依赖 Vue。状态机：`idle → placing → done`（双击结束保留结果），`stop/取消` 回 `idle`。

### 1.2 API

`createMeasureController(viewer, mode)` 返回控制器：

| 方法 | 职责 |
|---|---|
| `start(mode)` | 进入测距/测面积，绑定事件，重置状态 |
| `stop()` | 销毁事件、清理全部测量实体，回 idle |
| `undo()` | 撤销最后一个点并重建线/面/标签（0 点时保持 placing 态） |
| `getSnapshot()` | 返回实时数据 `{ mode, count, totalDistance, area, perimeter, lastSegment }` |
| `onUpdate(cb)` / `onEnd(cb)` | 实时数据回调 / 结束回调 |

### 1.3 事件与交互（用户已确认方案 B）

| 事件 | 行为 |
|---|---|
| 左键单击 | 加点（白描边红点） |
| 鼠标移动 | 动态预览：测距=青色半透明预览线+实时段长；测面积=青色 0.15 预览多边形+实时面积 |
| 右键单击 | 撤销上一点（重建线/面/标签） |
| 双击 | 结束：测距在终点标"总长 xxx m"；测面积在质心标"面积 xxx · 周长 xxx"；触发 onEnd |
| Esc 键 | 取消测量（等价 stop()） |

**双击防误触**：Cesium 双击会先派发 2 次单击；监听 `LEFT_DOUBLE_CLICK` 时移除双击产生的多余点（最后 1~2 个重复点），保证结束点位不冗余。

### 1.4 数值计算

- 距离：复用 `computeDistance`（`EllipsoidGeodesic.surfaceDistance`，精确测地线）。
- 面积：局部 ENU 切平面投影 + 鞋带公式——以首点为原点，构建东/北单位向量（用首点经纬度的椭球切平面），点位投影为平面坐标后鞋带求和取绝对值 /2；校园几百米尺度误差 <0.1%。替代现有平面近似。
- 周长：各边 `EllipsoidGeodesic` 距离求和。

### 1.5 渲染层级（D 视觉）

- 放置节点：`point` 白描边红点（pixelSize 8, outline 白 2）；
- 预览跟随点：半透明红点；
- 测距正式线：黄色实线（width 3）+ 每段中点小标签（14px）+ 结束总长标签（16px）；
- 测面积正式面：黄色 0.3 填充 + 描边；结束质心标签"面积 · 周长"（16px）；
- 预览元素统一青色系，与正式黄色系、航线黄色区分；
- 标签均带黑色描边（FILL_AND_OUTLINE），保证影像底图上可读。

## 2. 设计节 2：MeasureInfo.vue 悬浮信息条

- 位置：App.vue 地图容器底部、MeasureTool 上方悬浮；
- 数据流：`controller.onUpdate` → `mapStore.measureSnapshot`（store 新增 `ref(null)`）→ 信息条读取；
- 内容（实时刷新）：
  - 测距：`测距 · 点数 5 · 末段 123.4 m · 累计 456.7 m`
  - 测面积：`测面积 · 点数 4 · 面积 1.23 万m² · 周长 456.7 m`
  - 结束后：数值保留 + `· 已定格，右键撤销可继续`
  - 未测量：组件隐藏；
- 样式：rgba(20,30,48,0.9) 深色半透明 + 圆角 + 青色高亮数值，紧凑单行。

## 3. 设计节 3：CesiumViewer.vue 接线改造

- 删除内联 `startMeasure / stopMeasure / computePolygonArea`（约 110 行）与相关模块变量（measureHandler/measurePositions/measureEntities）；
- 新增模块级 `measureController`；
- `watch(mapStore.measureMode)`：有值 → `controller.start(mode)`；null → `controller.stop()`；
- `controller.onUpdate` → 写 `mapStore.measureSnapshot`；`onEnd` → 置空 `mapStore.measureMode`（结束即退出测量态，结果实体保留）；
- 建筑点击拾取逻辑（`if (mapStore.measureMode) return`）不变；`defineExpose({ stopMeasure })` 保留兼容；
- `clearMeasure`（MeasureTool）语义不变：置空 measureMode → watch → controller.stop() 清理实体；不得 `viewer.entities.removeAll()`（防误删无人机动画等业务实体）。

## 4. 设计节 4：MeasureTool.vue 工具栏更新

- 保留：测距 / 测面积 / 清除 / 航线规划 / 定位校园；
- 新增"撤销"按钮：`controller.undo()`（与右键撤销双通道）；
- 交互提示条：选中测距/测面积后工具栏下方浮出——"左键加点 · 右键撤销 · 双击结束 · Esc 取消"；
- 样式与信息条统一深色半透明风格。

## 5. 验证方式

- 前端 `npm run build` 通过；
- 手动清单（用户浏览器验证）：
  1. 测距：左键加点看到红点+预览线跟手；移动鼠标预览线实时变化；右键撤销点数递减；双击结束出现总长标签，信息条定格；
  2. 测面积：左键加点预览多边形实时变化；面积随点数更新；双击结束质心显示"面积·周长"，信息条定格；
  3. Esc/清除：实体全部消失，信息条隐藏；
  4. 与既有功能不冲突：测量态下点击地图不触发建筑拾取；无人机动画等实体不受影响；
  5. 面积数值与 psql `ST_Area(geom::geography)` 对同一校园多边形对比，误差 <0.1%。

## 6. 风险与兼容

- 双击事件：若浏览器双击速度设置异常，用 Cesium 默认 DOUBLE_CLICK_INTERVAL 逻辑，已在模块内去重；
- 标签与信息条单位：距离 m/km、面积 m²/公顷 沿用现有 `formatDistance / formatArea`（utils/cesium.js），不重复实现；
- 不新增第三方依赖（不引入 Turf.js）。

## 7. 已验证事实

- CesiumViewer.vue:598-706 现有 startMeasure/stopMeasure/computePolygonArea 完整逻辑（已读）；
- utils/cesium.js 已有 `computeDistance`（EllipsoidGeodesic）、`formatDistance`（m/km）、`formatArea`（m²/公顷）可复用；
- MeasureTool.vue 现有按钮结构与 `clearMeasure` 语义（置空 measureMode，注释明确不得 removeAll）；
- App.vue `.map-container` 为 position:relative 容器，底部可叠加悬浮元素；`MeasureTool` 位于 `.bottom-toolbar`（bottom:20px 居中）。

## 8. 缺陷修复 + 结束确认弹窗（2026-09-10 第二轮，用户已确认）

### 8.1 缺陷根因（已核实）

1. **残留实体导致"点数2/面积0/图上点多"**：`CesiumViewer.setupMeasure` 的 watch 在每次进入测量模式时新建 `measureController`（`measureController = createMeasureController(...)`），新实例 `start()→clear()` 只清自身实体；上一轮 controller `stop()` 按设计**保留**结果实体，重新开始测量时旧多边形残留叠加新点。
2. **双击无法结束**：Cesium 的 `LEFT_DOUBLE_CLICK` 依赖浏览器原生 dblclick（受系统双击间隔/位移阈值限制），用户双击间隔稍长或位移稍大即不触发，被当成两次单击各加 1 点；即便触发，去重用地面距离 5m 阈值，高视角下双击两击屏幕 4px 内地面距离可能 >5m，去重失效致结束点多 1~2 个。

### 8.2 修复与弹窗设计（用户已确认）

1. **watch 进入测量前清残留**：`if (mode) { measureController?.clear(); measureController = createMeasureController(viewer, mode); ... }`。
2. **双击自检**：移除 `LEFT_DOUBLE_CLICK` 注册；在 `LEFT_CLICK` 回调内自检——两次点击 `performance.now()` 间隔 <400ms 且 `Cartesian2.distance` <8px 判定为双击 → 不加点直接 `end()`；否则记录 `lastClickAt/lastClickPos` 并 `addPoint`。
3. **end() 改为进入 pending**：无条件移除最后 1 点（双击第一击产生的冗余点）→ 点数不足 MIN_POINTS 时 `clear()` 并触发 `onCancel`（同步 UI）→ 否则停事件（保留实体）、`phase='pending'`、回调 `onPending(snapshot)`。
4. **controller API 扩展**：`confirmEnd()`（phase='done' + `onEnd`）；`resume()`（phase='placing' + 重新绑定事件 + `emitUpdate`）；`start()` 抽 `bindEvents()`、`stop()` 抽 `stopEvents()` 复用；Esc：placing 时 `clear()+onCancel`，pending 时 `resume()`。
5. **snapshot 增加 phase 字段**：`placing`（onUpdate）/ `pending`（onPending）/ `done`（onEnd），由 CesiumViewer 包装时写入。
6. **MeasureConfirm.vue（新）**：`v-if="measureSnapshot?.phase === 'pending'"`；内容"测距完成 · 总长 xxx m" / "测面积完成 · 面积 xxx · 周长 xxx"；按钮【继续加点】→ `measureController.resume()`，【完成】→ `measureController.confirmEnd()`；位置在信息条上方，深色半透明风格。App.vue 挂载。
7. **MeasureInfo.vue**：phase 文案——`pending` 显示"· 待确认"，`done` 显示"· 已定格"。
8. **CesiumViewer 接线**：`onUpdate → {...snap, phase:'placing'}`；新增 `onPending → {...snap, phase:'pending'}`；`onEnd → {...snap, phase:'done'} + setMeasureMode(null)`；`onCancel → measureSnapshot=null + setMeasureMode(null)`。
