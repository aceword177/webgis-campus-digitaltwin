import * as Cesium from 'cesium'
import { computeDistance, formatDistance, formatArea } from './cesium'

/**
 * 测量控制器：状态机 idle → placing → done
 * 交互：左键加点 / 右键撤销 / 双击自检结束 / Esc 取消
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
  // 双击自检状态
  let lastClickAt = null
  let lastClickPos = null

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

  /** 绑定测量事件（左键双击自检 / 鼠标移动预览 / 右键撤销 / Esc） */
  function bindEvents() {
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    // 左键：双击自检（间隔<400ms 且位移<8px 判定双击→结束，不加点）
    handler.setInputAction((movement) => {
      const now = performance.now()
      if (lastClickAt && (now - lastClickAt) < 400 &&
          Cesium.Cartesian2.distance(lastClickPos, movement.position) < 8) {
        lastClickAt = null
        end()
        return
      }
      lastClickAt = now
      lastClickPos = movement.position.clone()
      const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid)
      if (cartesian) addPoint(cartesian)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
    handler.setInputAction((movement) => {
      const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid)
      renderPreview(cartesian)
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
    handler.setInputAction(() => undo(), Cesium.ScreenSpaceEventType.RIGHT_CLICK)
    escListener = (e) => {
      if (e.key === 'Escape') {
        clear()
        if (onCancelCb) onCancelCb()
      }
    }
    window.addEventListener('keydown', escListener)
  }

  /** 停止事件监听（destroy handler + 移除 Esc），不触碰实体 */
  function stopEvents() {
    if (handler) { handler.destroy(); handler = null }
    if (escListener) { window.removeEventListener('keydown', escListener); escListener = null }
  }

  /** 双击结束：无条件移除双击第一击冗余点 → 点数不足则取消，否则定格 */
  function end() {
    if (positions.length >= 1) positions.pop()
    if (positions.length < MIN_POINTS) {
      clear()
      if (onCancelCb) onCancelCb()
      return
    }
    stopEvents()
    clearPreview()
    renderFormal()
    phase = 'done'
    if (onEndCb) onEndCb(getSnapshot())
  }

  /** 停止测量：停事件、清预览、回 idle；保留正式结果实体（供查看） */
  function stop() {
    stopEvents()
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
    bindEvents()
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
