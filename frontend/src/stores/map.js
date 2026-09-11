import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import * as Cesium from 'cesium'
import { flyToTarget } from '@/utils/cesium'

/**
 * 地图全局状态管理
 * 管理 Cesium Viewer 实例、图层显隐、选中建筑、测量模式、
 * 无人机、航线、限飞区、订单、面板显隐等
 */
export const useMapStore = defineStore('map', () => {
  // ========== 原有状态 ==========
  const viewer = ref(null)
  // ========== 测量状态 ==========
  const measureSnapshot = ref(null)
  const measureController = ref(null)
  const canteenCoverage = ref(null)   // 食堂覆盖接口数据
  const coveragePopup = ref(null)     // 覆盖浮窗状态 {type, canteenId, canteenName, seconds?, dormitories?}
  const canteenActiveSelection = ref(null) // 缓冲圈选中状态 null|{type:'all'}|{type:'canteen',canteenId}|{type:'tier',canteenId,seconds}
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
  const dataSources = reactive({})
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
    viewer.value.imageryLayers.removeAll()
    viewer.value.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
        subdomains: ['1', '2', '3', '4'],
        maximumLevel: 18
      })
    )
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

  function flyToCampus() {
    if (!viewer.value) return
    flyToTarget(viewer.value, campusCenter.value[0], campusCenter.value[1], 600, 2)
  }

  function setLayerVisible(layerName, visible) {
    layers[layerName] = visible

    // 底图影像不是 dataSource，而是 imagery layer，需单独控制
    if (layerName === 'baseImagery') {
      const imageryLayers = viewer.value?.imageryLayers
      if (imageryLayers && imageryLayers.length) {
        for (let i = 0; i < imageryLayers.length; i++) {
          imageryLayers.get(i).show = visible
        }
      }
      return
    }

    const ds = dataSources[layerName]
    if (ds) ds.show = visible
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
    startRoutePlanning, setPlanStart, setPlanEnd, cancelRoutePlanning,
    // 新增：飞行动画
    animationState, currentAnimationOrderId,
    startAnimation, pauseAnimation, resumeAnimation, stopAnimation
  }
})
