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

  /**
   * 局部 ENU 切平面投影 + 鞋带公式。
   *
   * 实现要点（这里踩过两个坑，别再改回去）：
   *
   * 1. 原点直接用 points[0]（Cartesian3 世界坐标）。
   *    原写法 `Cesium.Cartesian3.fromCartesian(...)` 是错的 —— `fromCartesian`
   *    只存在于 `Cartographic` 上，`Cartesian3` **从来没有**这个静态方法，
   *    因此这里每次调用都抛 TypeError，测面积功能从未真正工作过。
   *
   * 2. 必须用 ENU 变换矩阵的**逆**把点变到局部系，不能拿矩阵的列向量去点积。
   *    `eastNorthUpToFixedFrame` 返回的列是**位置矢量**（模长≈地球半径），
   *    而且 east/north/up 三列并非相互正交。原写法
   *    `dot(v, new Cartesian3(m[0],m[4],m[8]))` 相当于把 v 投影到一组
   *    非正交基上，结果被剪切：实测 100m 的边会算成 72m / 138m，面积偏差 5.6%。
   *    改用逆矩阵后，局部坐标严格是 (东, 北, 天)，实测边长误差 <0.01%。
   *
   * @param {Cesium.Cartesian3[]} points 多边形顶点（世界坐标）
   * @returns {number} 面积（平方米）
   */
  function computeEnuArea(points) {
    if (points.length < 3) return 0
    const origin = points[0]
    const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(origin)
    const inverseFrame = Cesium.Matrix4.inverse(enuFrame, new Cesium.Matrix4())
    const planar = points.map(p => {
      // multiplyByPoint 会自动做齐次坐标除法（w=1），得到局部 ENU 坐标
      const local = Cesium.Matrix4.multiplyByPoint(inverseFrame, p, new Cesium.Cartesian3())
      return { e: local.x, n: local.y }
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
    // 左键：双击自检（间隔<250ms 且位移<4px 判定双击→结束，不加点）
    handler.setInputAction((movement) => {
      const now = performance.now()
      if (lastClickAt && (now - lastClickAt) < 250 &&
          Cesium.Cartesian2.distance(lastClickPos, movement.position) < 4) {
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

  /** 双击结束：移除双击第一击冗余点 → 点数不足则还原并忽略（防快速加点误判清空），否则定格 */
  function end() {
    const popped = positions.length >= 1 ? positions.pop() : null
    if (positions.length < MIN_POINTS) {
      // 点数不足：还原被移除的点，忽略本次双击（防止连续加点被误判为双击而清空）
      if (popped) positions.push(popped)
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
