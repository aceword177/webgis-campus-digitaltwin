import { defineStore } from 'pinia'
import { ref, reactive, shallowRef, shallowReactive } from 'vue'
import * as Cesium from 'cesium'
import { flyToTarget } from '@/utils/cesium'
import {
  createBaseImageryProvider,
  createAnnotationImageryProvider,
  DEFAULT_BASEMAP,
  BASEMAP_META
} from '@/utils/basemap'

/**
 * 地图全局状态管理
 * 管理 Cesium Viewer 实例、图层显隐、选中建筑、测量模式、
 * 无人机、航线、限飞区、订单、面板显隐等
 */
/**
 * 建筑图层 key -> 其描边 dataSource key 的映射。
 *
 * 描边是 loadBuildings 额外建的独立 CustomDataSource（贴地 polyline 勾边），
 * 它不单列图层，而是跟随所属建筑图层显隐。见 utils/cesium.js#addBuildingOutlines。
 */
const OUTLINE_KEY_OF = {
  teaching: 'outline-teaching',
  dormitory: 'outline-dormitory',
  other: 'outline-other'
}

export const useMapStore = defineStore('map', () => {  // ========== 原有状态 ==========
  /**
   * Cesium Viewer 实例。
   *
   * ⚠️ 必须用 shallowRef，**不能**用 ref。
   *
   * 用 ref 时 `viewer.value` 会被 Vue 深度响应式包成 Proxy；而所有消费方都写
   * `const viewer = mapStore.viewer` 再传回 Cesium API，于是 Proxy 一路进到
   * Cesium 内部。几何构建要走 Worker，`TaskProcessor.scheduleTask` 会执行
   * `worker.postMessage({ id, baseUrl, parameters, ... })`，parameters 里一旦
   * 含 Proxy，结构化克隆直接抛 DataCloneError，异常逃出 viewer.render()，
   * 表现为 "An error occurred while rendering. Rendering has stopped."
   *
   * 这是 Cesium 官方已归档问题的结论（CesiumGS/cesium#12438）：
   * 绝不要把 Viewer / DataSource 放进 Vue 的响应式状态。
   * shallowRef 只跟踪 .value 的替换，不代理内部 —— 引用仍能正常触发更新。
   */
  const viewer = shallowRef(null)
  // ========== 测量状态 ==========
  const measureSnapshot = ref(null)
  /** 测量控制器：内部持有 Cesium 实体，同样不能进深度响应式 */
  const measureController = shallowRef(null)
  const canteenCoverage = ref(null)   // 食堂覆盖接口数据
  const coveragePopup = ref(null)     // 覆盖浮窗状态 {type, canteenId, canteenName, seconds?, dormitories?}
  const canteenActiveSelection = ref(null) // 缓冲圈选中状态 null|{type:'all'}|{type:'canteen',canteenId}|{type:'tier',canteenId,seconds}
  /** 底图注记图层（高德矢量+注记叠加层）；仅影像底图需要。Cesium ImageryLayer，同理 shallowRef */
  const baseAnnotationLayer = shallowRef(null)
  /** 当前底图：'amap-img'（高德影像） | 'amap-vec'（高德矢量） */
  const baseImageryKind = ref(DEFAULT_BASEMAP)
  /**
   * 数据平移量：**恒为 0**，保留字段是为了让加载侧代码不必分支。
   *
   * 为什么恒为 0：本项目的 shapefile 虽标注 GCS_WGS_1984，但实际是按高德
   * （GCJ-02）底图采集的。底图也用高德，两者同基准 → 不需要任何平移。
   * （曾一度改成天地图 WGS84 底图，才出现约 109m 偏移；那个方向是错的。）
   */
  const dataShift = ref({ dLng: 0, dLat: 0, enabled: false })
  const layers = reactive({
    baseImagery: true,
    teaching: true,
    dormitory: true,
    other: true,
    road: true,
    playground: true,
    basketball: true,
    tennis: true,
    school: true,
    // 新增配送相关图层
    drones: true,           // 无人机点位
    routes: true,           // 飞行航线
    noFlyZones: true,       // 限飞区
    restaurants: true,      // 餐厅标记
    dormitoryMarkers: true, // 宿舍楼标记
    canteenBuffer: true     // 食堂缓冲区（覆盖圈）
  })
  /**
   * 图层 dataSource 注册表：key → Cesium DataSource。
   *
   * ⚠️ 用 shallowReactive 而非 reactive。
   *
   * 这些值是 Cesium 的 DataSource / GeoJsonDataSource 实例，reactive 会把它们
   * 连同其内部可达对象一起深度代理，再被传回 Cesium 时触发
   * DataCloneError（原因同上面的 viewer）。shallowReactive 只代理顶层对象本身，
   * 因此我们仍然能正常地增删 key、切图层时读到最新引用，
   * 但取出来 `dataSources.teaching` 是**原始** DataSource 实例。
   *
   * 详见 stores/map.js 中 viewer 的注释与 CesiumGS/cesium#12438。
   */
  const dataSources = shallowReactive({})
  const selectedBuilding = ref(null)
  const measureMode = ref(null)
  const campusCenter = ref([114.468251, 37.984174])
  const campusBounds = ref(null)

  // ========== 新增：无人机 ==========
  const drones = ref([])
  const selectedDrone = ref(null)

  // ========== 新增：航线 ==========
  const routes = ref([])
  const selectedRoute = ref(null)
  const currentPlanRoute = ref(null)  // 当前规划的航线（未保存）

  // ========== 新增：限飞区 ==========
  const noFlyZones = ref([])

  // ========== 新增：订单 ==========
  const orders = ref([])
  const selectedOrder = ref(null)

  // ========== 新增：面板显隐（侧边栏） ==========
  // 当前展开的面板: null | 'layer' | 'order' | 'drone' | 'route' | 'stats'
  const activePanel = ref(null)

  // ========== 新增：航线规划模式 ==========
  // null | 'selectingStart' | 'selectingEnd'
  const routePlanMode = ref(null)
  const planStartPoint = ref(null)  // {lng, lat, name}
  const planEndPoint = ref(null)    // {lng, lat, name}

  // ========== 新增：飞行动画 ==========
  // 'idle' | 'flying' | 'paused'
  const animationState = ref('idle')
  const currentAnimationOrderId = ref(null)

  // ========== 原有方法 ==========
  function initViewer(container) {
    if (viewer.value) return viewer.value
    viewer.value = new Cesium.Viewer(container, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: true,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: true,
      infoBox: false,
      selectionIndicator: false,
      shouldAnimate: true
    })

    // ===== 底图 =====
    // 高德影像 / 矢量均为 GCJ-02，与本项目数据同一基准（数据实际按高德底图采集），
    // 因此**不需要任何坐标平移**，叠加天然对齐。
    // （曾一度改用天地图 WGS84 底图，才出现约 109m 偏移；那个方向是错的。）
    applyBaseImagery()

    const scene = viewer.value.scene
    scene.globe.enableLighting = true
    scene.skyAtmosphere.show = true
    scene.fog.enabled = true
    scene.globe.depthTestAgainstTerrain = false
    // 初始视图：相机位于校园南侧俯视，目标（校园中心）位于视野中心
    const campusHeight = 800
    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        campusCenter.value[0],
        campusCenter.value[1] - campusHeight / 111320,
        campusHeight
      ),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 }
    })
    return viewer.value
  }

  /**
   * （重）建底图与注记图层。
   *
   * kind='amap-img' → 高德影像 + 矢量注记叠加（影像本身不含地名）
   * kind='amap-vec' → 高德矢量底图（自带中文注记）
   *
   * 两者同属 GCJ-02，与项目数据同基准，因此**不做任何坐标平移**。
   */
  function applyBaseImagery(kind = baseImageryKind.value) {
    const v = viewer.value
    if (!v) return
    v.imageryLayers.removeAll()
    baseAnnotationLayer.value = null

    const base = createBaseImageryProvider(Cesium, kind)
    if (base.provider) {
      v.imageryLayers.addImageryProvider(base.provider)
    }
    const annotation = createAnnotationImageryProvider(Cesium, kind)
    if (annotation) {
      const layer = v.imageryLayers.addImageryProvider(annotation)
      layer.alpha = 1.0
      baseAnnotationLayer.value = layer
    }

    baseImageryKind.value = kind
    layers.baseImagery = true
  }

  /** 切换底图（高德影像 / 高德矢量） */
  function switchBaseImagery(kind) {
    applyBaseImagery(kind)
  }

  function flyToCampus() {
    if (!viewer.value) return
    flyToTarget(viewer.value, campusCenter.value[0], campusCenter.value[1], 600, 2)
  }

  function setLayerVisible(layerName, visible) {
    layers[layerName] = visible

    // 底图影像不是 dataSource，而是 imagery layer，需单独控制。
    // 注记叠加层（高德矢量+注记）跟随底图开关，避免"只剩影像没有地名"的割裂观感
    if (layerName === 'baseImagery') {
      const imageryLayers = viewer.value?.imageryLayers
      if (imageryLayers && imageryLayers.length) {
        for (let i = 0; i < imageryLayers.length; i++) {
          imageryLayers.get(i).show = visible
        }
      }
      return
    }

    // 飞行航线/订单航线：dataSource 以 route- 或 order-route- 开头（每条航线一个），需批量控制
    if (layerName === 'routes') {
      for (const [key, ds] of Object.entries(dataSources)) {
        if ((key.startsWith('route-') || key.startsWith('order-route-')) && ds) {
          ds.show = visible
        }
      }
      return
    }

    const ds = dataSources[layerName]
    if (ds) ds.show = visible

    // 建筑描边是独立 dataSource（key = outline-<type>），不单列图层。
    // 这里跟着所属建筑图层一起开关，否则关掉"教学楼"后描边会残留在地图上。
    const outlineKey = OUTLINE_KEY_OF[layerName]
    if (outlineKey) {
      const outlineDs = dataSources[outlineKey]
      if (outlineDs) outlineDs.show = visible
    }
  }

  function selectBuilding(building) {
    selectedBuilding.value = building
  }

  function clearSelection() {
    selectedBuilding.value = null
  }

  function setMeasureMode(mode) {
    measureMode.value = mode
  }

  function destroyViewer() {
    if (viewer.value) {
      viewer.value.destroy()
      viewer.value = null
    }
  }

  // ========== 新增方法：面板 ==========
  function togglePanel(panelName) {
    activePanel.value = activePanel.value === panelName ? null : panelName
  }

  function closePanel() {
    activePanel.value = null
  }

  // ========== 新增方法：航线规划 ==========
  function startRoutePlanning() {
    routePlanMode.value = 'selectingStart'
    planStartPoint.value = null
    planEndPoint.value = null
    currentPlanRoute.value = null
  }

  /** 仅切换到"选择终点"模式（不清空已选的起点），供面板按钮调用 */
  function startSelectingEnd() {
    routePlanMode.value = 'selectingEnd'
  }

  function setPlanStart(point) {
    planStartPoint.value = point
    routePlanMode.value = 'selectingEnd'
  }

  function setPlanEnd(point) {
    planEndPoint.value = point
    routePlanMode.value = null
  }

  function cancelRoutePlanning() {
    routePlanMode.value = null
    planStartPoint.value = null
    planEndPoint.value = null
    currentPlanRoute.value = null
  }

  // ========== 新增方法：订单 ==========
  function selectOrder(order) {
    selectedOrder.value = order
  }

  function clearSelectedOrder() {
    selectedOrder.value = null
  }

  // ========== 新增方法：无人机 ==========
  function selectDrone(drone) {
    selectedDrone.value = drone
  }

  function clearSelectedDrone() {
    selectedDrone.value = null
  }

  // ========== 新增方法：飞行动画 ==========
  function startAnimation(orderId) {
    animationState.value = 'flying'
    currentAnimationOrderId.value = orderId
  }

  function pauseAnimation() {
    animationState.value = 'paused'
  }

  function resumeAnimation() {
    animationState.value = 'flying'
  }

  function stopAnimation() {
    animationState.value = 'idle'
    currentAnimationOrderId.value = null
  }

  return {
    // 原有
    viewer, layers, dataSources, selectedBuilding, measureMode,
    measureSnapshot, measureController,
    canteenCoverage, coveragePopup, canteenActiveSelection,
    baseAnnotationLayer, baseImageryKind, switchBaseImagery,
    dataShift, BASEMAP_META,
    campusCenter, campusBounds,
    initViewer, flyToCampus, setLayerVisible, selectBuilding, clearSelection,
    setMeasureMode, destroyViewer,
    // 新增：无人机
    drones, selectedDrone, selectDrone, clearSelectedDrone,
    // 新增：航线
    routes, selectedRoute, currentPlanRoute,
    // 新增：限飞区
    noFlyZones,
    // 新增：订单
    orders, selectedOrder, selectOrder, clearSelectedOrder,
    // 新增：面板
    activePanel, togglePanel, closePanel,
    // 新增：航线规划
    routePlanMode, planStartPoint, planEndPoint,
    startRoutePlanning, setPlanStart, setPlanEnd, cancelRoutePlanning, startSelectingEnd,
    // 新增：飞行动画
    animationState, currentAnimationOrderId,
    startAnimation, pauseAnimation, resumeAnimation, stopAnimation
  }
})
