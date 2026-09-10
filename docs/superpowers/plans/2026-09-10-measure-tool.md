# 测量工具优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将测距/测面积升级为"动态预览 + 右键撤销 + 双击结束 + 悬浮信息条实时汇总 + 精确面积计算"，并把测量逻辑从 CesiumViewer.vue 抽离为独立模块。

**Architecture:** 新建 `utils/measure.js` 状态机模块（idle→placing→done，管点位/预览/撤销/计算/渲染，不依赖 Vue）；`stores/map.js` 增加 `measureSnapshot`/`measureController` 供信息条与工具栏消费；`CesiumViewer.vue` 仅挂事件转发；新增 `MeasureInfo.vue` 悬浮信息条；`MeasureTool.vue` 增加撤销按钮与操作提示。

**Tech Stack:** Vue3 + Cesium 1.114 + Pinia（复用 utils/cesium.js 的 `computeDistance/formatDistance/formatArea`）

## Global Constraints

- 无新第三方依赖（不引入 Turf.js）。
- 距离用 `EllipsoidGeodesic.surfaceDistance`（复用现有 `computeDistance`）；面积用局部 ENU 切平面投影 + 鞋带公式。
- 单位沿用 `formatDistance`（m/km）、`formatArea`（m²/公顷）。
- 交互映射（用户已确认）：左键加点 / 右键撤销 / 双击结束 / Esc 取消。
- 正式元素黄色系、预览元素青色系；标签带黑色描边（FILL_AND_OUTLINE）。
- 不得 `viewer.entities.removeAll()`（会误删无人机动画等业务实体）；只清理测量模块自建的实体。
- 双击会先派发两次单击，模块内必须去重。
- 结束后结果实体保留在图上（stop 不清正式实体），仅"清除"（clear）清空。
- 每个任务以 `npm run build` 通过为验证门槛；项目无前端测试框架，采用构建 + 手动清单验证（如实说明）。

---

### Task 1: utils/measure.js 测量模块（核心）

**Files:**
- Create: `frontend/src/utils/measure.js`

**Interfaces:**
- Produces: `createMeasureController(viewer, mode)` → `{ start, stop, clear, undo, getSnapshot, onUpdate, onEnd, onCancel }`
- Consumes: `utils/cesium.js` 的 `computeDistance / formatDistance / formatArea`（已存在）

- [ ] **Step 1: 创建 measure.js**

```js
import * as Cesium from 'cesium'
import { computeDistance, formatDistance, formatArea } from './cesium'

/**
 * 测量控制器：状态机 idle → placing → done
 * 交互：左键加点 / 右键撤销 / 双击结束 / Esc 取消
 * 语义：stop() 停事件保留结果实体；clear() 全清（结果+预览）
 */
export function createMeasureController(viewer, mode) {
  let handler = null
  let phase = 'idle' // idle | placing | done
  let positions = [] // Cartesian3[]
  let entities = []  // 正式实体（节点/线/面/标签）
  let previewPoint = null
  let previewLine = null
  let previewPolygon = null
  let previewLabel = null
  let onUpdateCb = null
  let onEndCb = null
  let onCancelCb = null
  let escListener = null

  const MIN_POINTS = mode === 'distance' ? 2 : 3

  function emitUpdate() { if (onUpdateCb) onUpdateCb(getSnapshot()) }

  function getSnapshot() {
    const total = totalDistance()
    const last = positions.length >= 2
      ? computeDistance(positions[positions.length - 2], positions[positions.length - 1])
      : 0
    return {
      mode,
      count: positions.length,
      totalDistance: total,
      lastSegment: last,
      area: positions.length >= 3 ? computeEnuArea(positions) : 0,
      perimeter: total
    }
  }

  function totalDistance() {
    let sum = 0
    for (let i = 1; i < positions.length; i++) sum += computeDistance(positions[i - 1], positions[i])
    return sum
  }

  /** 局部 ENU 切平面投影 + 鞋带公式（校园尺度误差 <0.1%） */
  function computeEnuArea(points) {
    if (points.length < 3) return 0
    const origin = Cesium.Cartesian3.fromCartesian(Cesium.Cartographic.fromCartesian(points[0]))
    const m = Cesium.Transforms.eastNorthUpToFixedFrame(origin)
    const east = new Cesium.Cartesian3(m[0], m[4], m[8])
    const north = new Cesium.Cartesian3(m[1], m[5], m[9])
    const planar = points.map(p => {
      const v = Cesium.Cartesian3.subtract(p, origin, new Cesium.Cartesian3())
      return { e: Cesium.Cartesian3.dot(v, east), n: Cesium.Cartesian3.dot(v, north) }
    })
    let area = 0
    const n = planar.length
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      area += planar[i].e * planar[j].n - planar[j].e * planar[i].n
    }
    return Math.abs(area) / 2
  }

  function makeLabel(text, fontPx, offset) {
    return {
      text,
      font: `${fontPx}px sans-serif`,
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: offset || new Cesium.Cartesian2(0, -12)
    }
  }

  function clearPreview() {
    if (previewPoint) { viewer.entities.remove(previewPoint); previewPoint = null }
    if (previewLine) { viewer.entities.remove(previewLine); previewLine = null }
    if (previewPolygon) { viewer.entities.remove(previewPolygon); previewPolygon = null }
    if (previewLabel) { viewer.entities.remove(previewLabel); previewLabel = null }
  }

  function clearFormal() {
    entities.forEach(e => viewer.entities.remove(e))
    entities = []
  }

  /** 重建全部正式实体（节点/线/面/标签），保证撤销后无残留 */
  function renderFormal() {
    clearFormal()
    if (positions.length === 0) return
    positions.forEach(p => {
      entities.push(viewer.entities.add({
        position: p,
        point: { pixelSize: 8, color: Cesium.Color.RED, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 }
      }))
    })
    if (mode === 'distance') {
      if (positions.length >= 2) {
        entities.push(viewer.entities.add({
          polyline: { positions: positions.slice(), width: 3, material: Cesium.Color.YELLOW }
        }))
        for (let i = 1; i < positions.length; i++) {
          const mid = Cesium.Cartesian3.midpoint(positions[i - 1], positions[i], new Cesium.Cartesian3())
          entities.push(viewer.entities.add({
            position: mid,
            label: makeLabel(formatDistance(computeDistance(positions[i - 1], positions[i])), 14, new Cesium.Cartesian2(0, -10))
          }))
        }
        entities.push(viewer.entities.add({
          position: positions[positions.length - 1],
          label: makeLabel('总长 ' + formatDistance(totalDistance()), 16, new Cesium.Cartesian2(12, -12))
        }))
      }
    } else {
      if (positions.length >= 3) {
        entities.push(viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions.slice()),
            material: Cesium.Color.YELLOW.withAlpha(0.3),
            outline: true,
            outlineColor: Cesium.Color.YELLOW
          }
        }))
        const snap = getSnapshot()
        const center = Cesium.BoundingSphere.fromPoints(positions).center
        entities.push(viewer.entities.add({
          position: center,
          label: makeLabel(`面积 ${formatArea(snap.area)} · 周长 ${formatDistance(snap.perimeter)}`, 16)
        }))
      }
    }
  }

  /** 鼠标移动动态预览（青色系） */
  function renderPreview(cursor) {
    clearPreview()
    if (!cursor || positions.length === 0 || phase !== 'placing') return
    previewPoint = viewer.entities.add({
      position: cursor,
      point: { pixelSize: 8, color: Cesium.Color.CYAN.withAlpha(0.6), outlineColor: Cesium.Color.WHITE, outlineWidth: 1 }
    })
    if (mode === 'distance') {
      const seg = computeDistance(positions[positions.length - 1], cursor)
      previewLine = viewer.entities.add({
        polyline: { positions: [positions[positions.length - 1], cursor], width: 2, material: Cesium.Color.CYAN.withAlpha(0.6) }
      })
      previewLabel = viewer.entities.add({
        position: Cesium.Cartesian3.midpoint(positions[positions.length - 1], cursor, new Cesium.Cartesian3()),
        label: makeLabel(formatDistance(seg), 14, new Cesium.Cartesian2(0, -10))
      })
    } else {
      const previewPoints = positions.concat([cursor])
      if (previewPoints.length >= 3) {
        previewPolygon = viewer.entities.add({
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(previewPoints),
            material: Cesium.Color.CYAN.withAlpha(0.15),
            outline: true,
            outlineColor: Cesium.Color.CYAN.withAlpha(0.5)
          }
        })
        previewLabel = viewer.entities.add({
          position: cursor,
          label: makeLabel(formatArea(computeEnuArea(previewPoints)), 14, new Cesium.Cartesian2(0, -20))
        })
      }
    }
    emitUpdate()
  }

  function addPoint(cartesian) {
    positions.push(cartesian)
    renderFormal()
    emitUpdate()
  }

  function undo() {
    if (positions.length === 0) return
    positions.pop()
    clearPreview()
    renderFormal()
    emitUpdate()
  }

  /** 双击结束：先去重（双击派发两次单击，移除冗余点），再判定/定格 */
  function end() {
    if (positions.length >= 2) {
      const last = positions[positions.length - 1]
      const prev = positions[positions.length - 2]
      if (computeDistance(last, prev) < 5) positions.pop()
    }
    if (positions.length < MIN_POINTS) { clear(); return }
    clearPreview()
    renderFormal()
    phase = 'done'
    if (onEndCb) onEndCb(getSnapshot())
  }

  /** 停止测量：停事件、清预览、回 idle；保留正式结果实体（供查看） */
  function stop() {
    if (handler) { handler.destroy(); handler = null }
    if (escListener) { window.removeEventListener('keydown', escListener); escListener = null }
    clearPreview()
    positions = []
    phase = 'idle'
  }

  /** 清除：stop() + 移除全部正式实体 */
  function clear() {
    stop()
    clearFormal()
  }

  function start() {
    clear()
    phase = 'placing'
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((movement) => {
      const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid)
      if (cartesian) addPoint(cartesian)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
    handler.setInputAction((movement) => {
      const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid)
      renderPreview(cartesian)
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
    handler.setInputAction(() => undo(), Cesium.ScreenSpaceEventType.RIGHT_CLICK)
    handler.setInputAction(() => end(), Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    escListener = (e) => {
      if (e.key === 'Escape') { clear(); if (onCancelCb) onCancelCb() }
    }
    window.addEventListener('keydown', escListener)
  }

  return {
    start,
    stop,
    clear,
    undo,
    getSnapshot,
    onUpdate(cb) { onUpdateCb = cb },
    onEnd(cb) { onEndCb = cb },
    onCancel(cb) { onCancelCb = cb }
  }
}
```

- [ ] **Step 2: 验证**：`cd frontend && npm run build` 通过（模块被后续任务引用前不报错即可；本任务可先确认语法由构建覆盖）
- [ ] **Step 3: 提交**：`git add frontend/src/utils/measure.js && git commit -m "feat(measure): standalone measure controller (preview/undo/double-click-end/precise area)"`

### Task 2: stores/map.js 增加测量状态

**Files:**
- Modify: `frontend/src/stores/map.js`

**Interfaces:**
- Produces: `measureSnapshot`（ref，null 或 `{mode,count,totalDistance,lastSegment,area,perimeter,done}`）、`measureController`（ref）、`clearMeasureState()`（内部辅助置空 snapshot）

- [ ] **Step 1: 新增状态与导出**

在 `viewer` ref 附近新增：
```js
  // ========== 测量状态 ==========
  const measureSnapshot = ref(null)
  const measureController = ref(null)
```
在 return 列表（约 212 行起）追加：
```js
    measureSnapshot, measureController,
```

- [ ] **Step 2: 验证**：`npm run build` 通过
- [ ] **Step 3: 提交**：`git add frontend/src/stores/map.js && git commit -m "feat(store): measure snapshot & controller state"`

### Task 3: CesiumViewer.vue 接线改造

**Files:**
- Modify: `frontend/src/components/CesiumViewer.vue`（删除 28-30 行测量变量、70-72 行 watch 改造、598-706 行 startMeasure/stopMeasure/computePolygonArea，新增接线）

**Interfaces:**
- Consumes: `createMeasureController`（Task 1）、`mapStore.measureSnapshot/measureController`（Task 2）
- Produces: 保持 `defineExpose({ stopMeasure })`（兼容，实现为内部 stop 转发）

- [ ] **Step 1: import 增加**

在 `import { ... flyToTarget } from '@/utils/cesium'` 之后新增：
```js
import { createMeasureController } from '@/utils/measure'
```

- [ ] **Step 2: 删除旧测量变量与函数**

- 删除模块变量：`let measureHandler = null`、`let measurePositions = []`、`let measureEntities = []`（原 28-30 行）；
- 删除 `startMeasure` 与 `computePolygonArea` 全部实现（原 598-706 行区域）；`stopMeasure` 旧实现一并删除，由 Step 4 重建同名新实现；
- 新增模块级变量与接线函数：
```js
let measureController = null

/** 测量接线：mode 变化时启停控制器，回调写入 store 状态 */
function setupMeasure(viewer) {
  watch(() => mapStore.measureMode, (mode) => {
    if (mode) {
      measureController = createMeasureController(viewer, mode)
      mapStore.measureController = measureController
      measureController.onUpdate((snap) => {
        mapStore.measureSnapshot = { ...snap, done: false }
      })
      measureController.onEnd((snap) => {
        mapStore.measureSnapshot = { ...snap, done: true }
        mapStore.setMeasureMode(null) // 结束即退出测量态，实体保留
      })
      measureController.onCancel(() => {
        mapStore.measureSnapshot = null
        mapStore.setMeasureMode(null)
      })
      measureController.start()
    } else {
      measureController?.stop()
    }
  })
}
```

- [ ] **Step 3: 挂接 setupMeasure**

原 watch（70-72 行）替换为在 `onMounted` 中 `const viewer = mapStore.initViewer(...)` 之后调用 `setupMeasure(viewer)`；`watch(() => mapStore.measureMode, ...)` 从 setupMeasure 内注册（注意：setupMeasure 在 onMounted 内调用时注册 watch，viewer 变量闭包可用）。

- [ ] **Step 4: stopMeasure 兼容**

保留 `defineExpose({ stopMeasure })`，实现改为：
```js
function stopMeasure() {
  measureController?.stop()
}
```

- [ ] **Step 5: 验证**：`npm run build` 通过
- [ ] **Step 6: 提交**：`git add frontend/src/components/CesiumViewer.vue && git commit -m "refactor(measure): wire standalone controller, drop inline measure logic"`

### Task 4: MeasureInfo.vue 悬浮信息条

**Files:**
- Create: `frontend/src/components/MeasureInfo.vue`

**Interfaces:**
- Consumes: `mapStore.measureSnapshot`
- Produces: 组件（App.vue 挂载）

- [ ] **Step 1: 创建组件**

```vue
<template>
  <div v-if="snap" class="measure-info">
    <template v-if="snap.mode === 'distance'">
      <span class="mi-label">测距</span>
      <span class="mi-item">点数 {{ snap.count }}</span>
      <span class="mi-item">末段 <b>{{ fmt(snap.lastSegment) }}</b></span>
      <span class="mi-item">累计 <b>{{ fmt(snap.totalDistance) }}</b></span>
    </template>
    <template v-else>
      <span class="mi-label">测面积</span>
      <span class="mi-item">点数 {{ snap.count }}</span>
      <span class="mi-item">面积 <b>{{ fmtArea(snap.area) }}</b></span>
      <span class="mi-item">周长 <b>{{ fmt(snap.perimeter) }}</b></span>
    </template>
    <span v-if="snap.done" class="mi-done">· 已定格，右键撤销可继续</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMapStore } from '@/stores/map'
import { formatDistance, formatArea } from '@/utils/cesium'

const { measureSnapshot: snap } = storeToRefs(useMapStore())
const fmt = (v) => formatDistance(v || 0)
const fmtArea = (v) => formatArea(v || 0)
</script>

<style scoped>
.measure-info {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 14px;
  background: rgba(20, 30, 48, 0.9);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}
.mi-label { color: #409EFF; font-weight: 600; }
.mi-item b { color: #00E5FF; }
.mi-done { color: rgba(255, 255, 255, 0.6); }
</style>
```

- [ ] **Step 2: 验证**：`npm run build` 通过
- [ ] **Step 3: 提交**：`git add frontend/src/components/MeasureInfo.vue && git commit -m "feat(ui): measure info bar (live total/perimeter)"`

### Task 5: App.vue 挂载信息条

**Files:**
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: import + 挂载**

script 中 import：`import MeasureInfo from '@/components/MeasureInfo.vue'`
模板 `.map-container` 内、`MeasureTool` 工具栏上方插入：
```html
        <!-- 测量信息条（实时汇总） -->
        <div class="measure-info-slot">
          <MeasureInfo />
        </div>
```
样式：
```css
.measure-info-slot {
  position: absolute;
  bottom: 64px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 11;
  pointer-events: none;
}
```

- [ ] **Step 2: 验证**：`npm run build` 通过
- [ ] **Step 3: 提交**：`git add frontend/src/App.vue && git commit -m "feat(ui): mount measure info bar above toolbar"`

### Task 6: MeasureTool.vue 撤销按钮 + 操作提示

**Files:**
- Modify: `frontend/src/components/MeasureTool.vue`

- [ ] **Step 1: 模板增加撤销按钮与提示条**

"清除"按钮旁新增：
```html
    <el-button size="small" @click="undoMeasure" :disabled="!measureMode">
      <el-icon><RefreshLeft /></el-icon>
      撤销
    </el-button>
```
工具栏下方（根 div 内最后）新增提示条：
```html
    <div v-if="measureMode" class="measure-hint">
      左键加点 · 右键撤销 · 双击结束 · Esc 取消
    </div>
```

- [ ] **Step 2: script 更新**

```js
import { RefreshLeft } from '@element-plus/icons-vue'
const measureMode = computed({ get: () => mapStore.measureMode, set: (val) => mapStore.setMeasureMode(val) })

function undoMeasure() {
  mapStore.measureController?.undo()
}
```
删除空函数 `handleModeChange` 及其模板 `@change` 绑定（保留 radio-group v-model）。

- [ ] **Step 3: 样式**

```css
.measure-tool { flex-wrap: wrap; }
.measure-hint {
  width: 100%;
  margin-top: 4px;
  padding: 4px 8px;
  background: rgba(64, 158, 255, 0.15);
  border-radius: 4px;
  font-size: 12px;
  color: #79bbff;
  text-align: center;
}
```

- [ ] **Step 4: 验证**：`npm run build` 通过
- [ ] **Step 5: 提交**：`git add frontend/src/components/MeasureTool.vue && git commit -m "feat(ui): undo button + interaction hint in measure toolbar"`

### Task 7: 构建 + 手动验证 + 收尾

**Files:** 无（验证与提交）

- [ ] **Step 1: 全量构建**：`cd frontend && npm run build`，确认 0 错误
- [ ] **Step 2: 手动清单（用户在浏览器验证，交付时提供）**：
  1. 测距：左键加点 → 红点+黄线+每段标签；移动鼠标青色预览线+实时段长跟手；
  2. 右键撤销 → 点数递减、线/面/标签重建无残留；撤销到 0 仍可继续加点；
  3. 双击结束 → 测距终点"总长 xxx m"，信息条定格"已定格"提示；测面积质心"面积·周长"；
  4. 测面积：加点预览多边形实时变化、面积随点数刷新；双击定格；
  5. Esc / "清除"按钮 → 全部测量实体消失、信息条隐藏；
  6. 测量态下点击地图不触发建筑拾取弹窗；无人机动画/航线等业务实体不受影响；
  7. 面积精度：取校园某多边形对比 PostGIS `ST_Area(geom::geography)`，误差 <0.1%。
- [ ] **Step 3: 收尾提交**：如有验证中发现的问题，修复后提交；最后 `git status` 确认工作区干净
