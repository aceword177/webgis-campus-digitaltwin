<template>
  <div ref="cesiumContainer" class="cesium-container"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/map'
import { getGeoJson, getCampusBounds, pointQuery } from '@/api/spatial'
import { getDrones, updateDronePosition } from '@/api/drone'
import { getNoFlyZones } from '@/api/noFlyZone'
import { getActiveRoutes, getRouteByOrderId } from '@/api/route'
import { getRestaurants, getRestaurantDetail } from '@/api/restaurant'
import {
  loadBuildings, loadVenues, loadRoads, loadSchoolBoundary,
  loadDrones as loadDroneEntities, createDroneEntity, getDroneColor,
  loadNoFlyZones as loadNoFlyZoneEntities,
  loadRoute, loadRestaurantMarkers, parseRouteGeojson,
  createDroneAnimation, getTableNameByType,
  flyToTarget
} from '@/utils/cesium'
import { createMeasureController } from '@/utils/measure'

const mapStore = useMapStore()
const cesiumContainer = ref(null)
const routePlanMode = computed(() => mapStore.routePlanMode)

let handler = null
let measureController = null
let droneAnimation = null
let droneSyncTimer = null
let currentAnimatedDroneId = null
let eventListeners = []
let droneTrailData = null
const droneTrails = new Map()

// 航线规划提示标签
let planHintLabel = null

onMounted(async () => {
  const viewer = mapStore.initViewer(cesiumContainer.value)

  // 获取校园边界，设置中心点
  try {
    const bounds = await getCampusBounds()
    if (bounds) {
      mapStore.campusCenter = [bounds.center_lng, bounds.center_lat]
      mapStore.campusBounds = bounds
      // 定位校园：相机从校园南侧俯视，校园中心位于视野中心
      flyToTarget(viewer, bounds.center_lng, bounds.center_lat, 600, 2)
    }
  } catch (e) {
    console.warn('获取校园边界失败:', e)
  }

  // 加载所有空间数据
  await loadAllSpatialData(viewer)

  // 加载配送相关数据
  await loadDeliveryData(viewer)

  // 注册点击事件
  registerClickHandler(viewer)

  // 注册自定义事件监听
  registerCustomEventListeners(viewer)

  // 测量接线（内部注册 measureMode watch）
  setupMeasure(viewer)

  // 监听航线规划模式变化
  watch(routePlanMode, (mode) => {
    updatePlanHint(viewer, mode)
  })
})

onBeforeUnmount(() => {
  if (handler) handler.destroy()
  stopMeasure()
  if (droneAnimation) droneAnimation.stop()
  if (droneSyncTimer) clearInterval(droneSyncTimer)
  // 移除所有自定义事件监听
  eventListeners.forEach(({ event, handler }) => {
    window.removeEventListener(event, handler)
  })
  if (planHintLabel) {
    const viewer = mapStore.viewer
    if (viewer) viewer.entities.remove(planHintLabel)
  }
  mapStore.destroyViewer()
})

/** 加载所有空间数据 */
async function loadAllSpatialData(viewer) {
  try {
    const schoolData = await getGeoJson('school')
    if (schoolData?.length) mapStore.dataSources.school = await loadSchoolBoundary(viewer, schoolData, '校园边界')

    const teachingData = await getGeoJson('teaching_building')
    if (teachingData?.length) mapStore.dataSources.teaching = await loadBuildings(viewer, teachingData, 'teaching', '教学楼')

    const dormitoryData = await getGeoJson('dormitory')
    if (dormitoryData?.length) mapStore.dataSources.dormitory = await loadBuildings(viewer, dormitoryData, 'dormitory', '宿舍楼')

    const otherData = await getGeoJson('other_buildings')
    if (otherData?.length) mapStore.dataSources.other = await loadBuildings(viewer, otherData, 'other', '其他建筑')

    const roadData = await getGeoJson('road')
    if (roadData?.length) mapStore.dataSources.road = await loadRoads(viewer, roadData, '道路')

    const playgroundData = await getGeoJson('playground')
    if (playgroundData?.length) mapStore.dataSources.playground = await loadVenues(viewer, playgroundData, 'playground', '操场')

    const basketballData = await getGeoJson('basketball_court')
    if (basketballData?.length) mapStore.dataSources.basketball = await loadVenues(viewer, basketballData, 'basketball', '篮球场')

    const tennisData = await getGeoJson('tennis_court')
    if (tennisData?.length) mapStore.dataSources.tennis = await loadVenues(viewer, tennisData, 'tennis', '网球场')
  } catch (e) {
    console.error('加载空间数据失败:', e)
  }
}

/** 加载配送相关数据 */
async function loadDeliveryData(viewer) {
  // 加载限飞区
  try {
    const zones = await getNoFlyZones()
    if (zones?.length) {
      mapStore.noFlyZones = zones
      const ds = await loadNoFlyZoneEntities(viewer, zones, '限飞区')
      mapStore.dataSources.noFlyZones = ds
    }
  } catch (e) { console.warn('加载限飞区失败:', e) }

  // 加载无人机
  try {
    const drones = await getDrones()
    if (drones?.length) {
      // 飞行尾迹线数据源（配送中无人机实时轨迹）
      droneTrailData = new Cesium.CustomDataSource('droneTrails')
      viewer.dataSources.add(droneTrailData)
      mapStore.drones = drones
      mapStore.dataSources.drones = loadDroneEntities(viewer, drones, '无人机')
      // 每 5 秒增量同步无人机位置与状态（充电移动 / 派单移动 / 电量变化实时上地图）
      startDroneSync(viewer)
    }
  } catch (e) { console.warn('加载无人机失败:', e) }

  // 加载当前飞行中的航线
  try {
    const routes = await getActiveRoutes()
    if (routes?.length) {
      mapStore.routes = routes
      routes.forEach((route, idx) => {
        const ds = loadRoute(viewer, route, `航线-${route.id || idx}`, Cesium.Color.YELLOW)
        mapStore.dataSources[`route-${route.id || idx}`] = ds
      })
    }
  } catch (e) { console.warn('加载航线失败:', e) }

  // 加载餐厅标记
  try {
    const restaurants = await getRestaurants()
    if (restaurants?.length) {
      // 获取餐厅详情（含坐标），统一走 axios 封装
      const details = await Promise.all(
        restaurants.map(r => getRestaurantDetail(r.id).catch(() => null))
      ).catch(() => [])
      const validDetails = details.filter(Boolean)
      if (validDetails.length) {
        mapStore.dataSources.restaurants = loadRestaurantMarkers(viewer, validDetails, '餐厅标记')
      }
    }
  } catch (e) { console.warn('加载餐厅标记失败:', e) }
}

/** 启动无人机位置定时同步（每 2 秒一次，与后端实时推进节奏一致） */
function startDroneSync(viewer) {
  if (droneSyncTimer) clearInterval(droneSyncTimer)
  droneSyncTimer = setInterval(() => {
    syncDronePositions(viewer)
  }, 2000)
}

/**
 * 增量同步无人机位置/状态到地图实体：
 * - 已存在的实体：平滑飞行到新位置，刷新电量颜色与属性
 * - 新增的无人机：添加实体
 * - 已下线的无人机：移除实体
 */
async function syncDronePositions(viewer) {
  try {
    const drones = await getDrones()
    mapStore.drones = drones
    const dataSource = mapStore.dataSources.drones
    if (!dataSource) return

    // 1. 更新已有实体 / 新增实体
    for (const drone of drones) {
      if (drone.current_lng == null || drone.current_lat == null) continue
      // 更新/清除飞行尾迹线
      updateDroneTrail(viewer, drone)
      const entity = dataSource.entities.getById('drone-' + drone.id)
      if (entity) {
        // 平滑飞行到新位置（距离 > 0.5 米才移动；显式用绝对距离判断，避免 equalsEpsilon 相对容差误判）
        const target = Cesium.Cartesian3.fromDegrees(drone.current_lng, drone.current_lat, 50)
        const current = entity.position?.getValue(Cesium.JulianDate.now())
        if (current && Cesium.Cartesian3.distance(current, target) > 0.5) {
          smoothMoveEntity(viewer, entity, target, 1.9)
        }
        // 刷新电量颜色（电量不足 = 电量 ≤ 30% 显示红色）
        const lowBattery = drone.battery_pct !== undefined && drone.battery_pct <= 30
        entity.billboard.color = lowBattery ? Cesium.Color.RED : getDroneColor(drone.status)
        // 刷新属性，保证点击后详情面板显示最新数据
        entity.properties = new Cesium.PropertyBag({ ...drone, isDrone: true })
      } else {
        const newEntity = createDroneEntity(drone)
        if (newEntity) dataSource.entities.add(newEntity)
      }
    }

    // 2. 移除后端已不存在的无人机实体
    const validIds = new Set(drones.map(d => 'drone-' + d.id))
    const toRemove = []
    for (const entity of dataSource.entities.values) {
      if (entity.properties?.isDrone?.getValue && !validIds.has(entity.id)) {
        toRemove.push(entity)
      }
    }
    toRemove.forEach(e => dataSource.entities.remove(e))
  } catch (e) {
    console.warn('同步无人机位置失败:', e)
  }
}

/**
 * 将实体从当前位置平滑飞行到目标位置（1.5 秒线性插值）
 * 通过 scene.postUpdate 每帧读取插值位置写回常量位置，不依赖 viewer.clock 状态
 */
function smoothMoveEntity(viewer, entity, targetCartesian, duration) {
  const startTime = Cesium.JulianDate.now()
  const endTime = Cesium.JulianDate.addSeconds(startTime, duration, new Cesium.JulianDate())
  const from = entity.position?.getValue(startTime) || targetCartesian

  const prop = new Cesium.SampledPositionProperty()
  prop.setInterpolationOptions({
    interpolationDegree: 1,
    interpolationAlgorithm: Cesium.LinearApproximation
  })
  prop.addSample(startTime, from)
  prop.addSample(endTime, targetCartesian)
  entity.position = prop

  const remove = viewer.scene.postUpdate.addEventListener(() => {
    const t = Cesium.JulianDate.now()
    const pos = prop.getValue(t)
    if (Cesium.defined(pos)) {
      entity.position = pos
    }
    if (Cesium.JulianDate.greaterThanOrEquals(t, endTime)) {
      remove()
      entity.position = targetCartesian
    }
  })
}

/**
 * 更新/清除无人机飞行尾迹线：
 * - 配送中的无人机：将当前位置追加到尾迹点集（保留最近 40 点），绘制半透明发光尾迹
 * - 非配送中（回到食堂/充电/空闲）：清除该无人机尾迹
 */
function updateDroneTrail(viewer, drone) {
  if (!droneTrailData) return
  const id = 'trail-' + drone.id
  const trail = droneTrailData.entities.getById(id)
  if (drone.status === 'delivering') {
    let pts = droneTrails.get(drone.id) || []
    const last = pts[pts.length - 1]
    if (!last || Math.abs(last[0] - drone.current_lng) > 1e-9 || Math.abs(last[1] - drone.current_lat) > 1e-9) {
      pts.push([drone.current_lng, drone.current_lat])
    }
    if (pts.length > 40) pts = pts.slice(pts.length - 40)
    droneTrails.set(drone.id, pts)
    if (pts.length < 2) return
    const positions = pts.map(p => Cesium.Cartesian3.fromDegrees(p[0], p[1], 50))
    if (!trail) {
      droneTrailData.entities.add({
        id,
        polyline: {
          positions,
          width: 2,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.15,
            color: Cesium.Color.YELLOW.withAlpha(0.8)
          })
        }
      })
    } else {
      trail.polyline.positions = positions
    }
  } else {
    droneTrails.delete(drone.id)
    if (trail) droneTrailData.entities.remove(trail)
  }
}

/** 注册点击事件 */
function registerClickHandler(viewer) {
  handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

  handler.setInputAction(async (movement) => {
    // 测量模式下不触发
    if (mapStore.measureMode) return

    // 航线规划模式：点击地图设置起点/终点
    if (routePlanMode.value) {
      const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid)
      if (!cartesian) return
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
      const lng = Cesium.Math.toDegrees(cartographic.longitude)
      const lat = Cesium.Math.toDegrees(cartographic.latitude)

      if (routePlanMode.value === 'selectingStart') {
        mapStore.setPlanStart({ lng, lat, name: `自定义起点(${lng.toFixed(4)},${lat.toFixed(4)})` })
      } else if (routePlanMode.value === 'selectingEnd') {
        mapStore.setPlanEnd({ lng, lat, name: `自定义终点(${lng.toFixed(4)},${lat.toFixed(4)})` })
      }
      return
    }

    // 正常拾取
    const picked = viewer.scene.pick(movement.position)
    if (Cesium.defined(picked) && picked.id) {
      const entity = picked.id

      // 无人机点击
      if (entity.properties?.isDrone?.getValue()) {
        const drone = {
          id: entity.properties.id.getValue(),
          drone_no: entity.properties.drone_no.getValue(),
          status: entity.properties.status.getValue(),
          battery_pct: entity.properties.battery_pct.getValue(),
          current_lng: entity.properties.current_lng.getValue(),
          current_lat: entity.properties.current_lat.getValue(),
          isDrone: true
        }
        mapStore.selectBuilding(drone)
        return
      }

      // 建筑点击
      const buildingType = entity._buildingType
      if (buildingType) {
        const tableName = entity._tableName || getTableNameByType(buildingType)
        const id = entity.properties?.id?.getValue()
        const name = entity.properties?.name?.getValue()
        const height = entity.properties?.height?.getValue()

        const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid)
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
        const lng = Cesium.Math.toDegrees(cartographic.longitude)
        const lat = Cesium.Math.toDegrees(cartographic.latitude)

        try {
          const detail = await pointQuery(tableName, lng, lat)
          if (detail) {
            mapStore.selectBuilding({ ...detail, tableName, buildingType, lng, lat, position: cartesian })
          } else {
            mapStore.selectBuilding({ id, name, height, tableName, buildingType, lng, lat, position: cartesian })
          }
        } catch (e) {
          mapStore.selectBuilding({ id, name, height, tableName, buildingType, lng, lat, position: cartesian })
        }
        return
      }
    }

    // 点击空白处，清除选中
    mapStore.clearSelection()
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

/** 注册自定义事件监听 */
function registerCustomEventListeners(viewer) {
  // 播放动画期间隐藏静态图标，播完恢复（避免出现两个无人机）
  function hideDroneIcon(droneId) {
    const dataSource = mapStore.dataSources.drones
    const entity = dataSource?.entities.getById('drone-' + droneId)
    if (entity) entity.show = false
  }
  function restoreDroneIcon(droneId) {
    if (!droneId) return
    const dataSource = mapStore.dataSources.drones
    const entity = dataSource?.entities.getById('drone-' + droneId)
    if (entity) entity.show = true
  }

  // 在航线坐标中找到离无人机当前位置最近的点索引
  function findNearestIndex(coords, lng, lat) {
    let best = 0
    let bestDist = Infinity
    coords.forEach((c, i) => {
      const d = (c[0] - lng) * (c[0] - lng) + (c[1] - lat) * (c[1] - lat)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    return best
  }

  // 订单分配后：加载航线
  const onOrderAssigned = async (e) => {
    try {
      const route = await getRouteByOrderId(e.detail.orderId)
      if (route) {
        const ds = loadRoute(viewer, route, `订单航线-${e.detail.orderId}`, Cesium.Color.CYAN)
        mapStore.dataSources[`order-route-${e.detail.orderId}`] = ds
      }
    } catch (err) { console.error('加载订单航线失败:', err) }
  }

  // 显示规划的航线
  const onShowPlannedRoute = (e) => {
    // 清除之前的规划航线
    if (mapStore.dataSources['planned-route']) {
      viewer.dataSources.remove(mapStore.dataSources['planned-route'])
    }
    const routeData = {
      route_geom: e.detail.routeGeojson,
      altitude_m: e.detail.altitude || 50,
      id: 'planned'
    }
    const ds = loadRoute(viewer, routeData, '规划航线', Cesium.Color.MAGENTA)
    mapStore.dataSources['planned-route'] = ds
  }

  // 显示订单航线
  const onShowRoute = async (e) => {
    try {
      const route = await getRouteByOrderId(e.detail.orderId)
      if (route) {
        const ds = loadRoute(viewer, route, `航线-${e.detail.orderId}`, Cesium.Color.YELLOW)
        mapStore.dataSources[`route-${e.detail.orderId}`] = ds
        // 飞行到航线中点（目标位于视野中心）
        const coords = parseRouteGeojson(route.route_geom)
        if (coords.length) {
          const mid = coords[Math.floor(coords.length / 2)]
          flyToTarget(viewer, mid[0], mid[1], 200, 1.5)
        }
      }
    } catch (err) { console.error('显示航线失败:', err) }
  }

  // 启动飞行动画：先定位无人机当前位置，从当前位置沿剩余航线继续飞行
  const onStartAnimation = (e) => {
    if (droneAnimation) {
      droneAnimation.stop()
      droneAnimation = null
    }
    currentAnimatedDroneId = e.detail.droneId || null
    // 播放动画期间隐藏静态图标，避免出现两个无人机
    hideDroneIcon(currentAnimatedDroneId)

    // 从无人机当前实时位置构造剩余航线（当前位置 + 其后所有航线点）
    const coords = parseRouteGeojson(e.detail.routeGeojson)
    if (!coords.length) {
      restoreDroneIcon(currentAnimatedDroneId)
      currentAnimatedDroneId = null
      return
    }
    let remaining = coords
    const droneData = mapStore.drones.find(d => d.id === e.detail.droneId)
    if (droneData && droneData.current_lng != null && droneData.current_lat != null) {
      const startIdx = findNearestIndex(coords, droneData.current_lng, droneData.current_lat)
      remaining = [[droneData.current_lng, droneData.current_lat], ...coords.slice(startIdx)]
    }
    const remainingGeojson = JSON.stringify({ type: 'LineString', coordinates: remaining })

    droneAnimation = createDroneAnimation(
      viewer,
      remainingGeojson,
      e.detail.droneId,
      e.detail.altitude || 50, // 飞行高度：建筑高 + 30m（后端动态计算）
      5 // 飞行速度 5m/s，与后端实时推进一致
    )
    if (droneAnimation) {
      // start() 内部会先定位(相机跳转到起点=无人机当前位置)再播放
      droneAnimation.start()
      // 动画结束后自动停止
      const checkFinish = setInterval(() => {
        if (droneAnimation?.isFinished()) {
          clearInterval(checkFinish)
          mapStore.stopAnimation()
          droneAnimation.stop()
          droneAnimation = null
          // 已飞抵终点：更新数据库位置（相机保持跟随，方便确认送达）
          const end = remaining[remaining.length - 1]
          const finishedId = currentAnimatedDroneId
          currentAnimatedDroneId = null
          if (finishedId && end) {
            updateDronePosition(finishedId, end[0], end[1], null)
              .then(() => console.log(`无人机 ${finishedId} 已到达收货点，位置已更新`))
              .catch(err => console.warn('更新无人机到达位置失败:', err))
              .finally(() => restoreDroneIcon(finishedId))
          } else {
            restoreDroneIcon(finishedId)
          }
        }
      }, 500)
    } else {
      restoreDroneIcon(currentAnimatedDroneId)
      currentAnimatedDroneId = null
    }
  }

  // 暂停/继续/停止动画
  const onPauseAnimation = () => droneAnimation?.pause()
  const onResumeAnimation = () => droneAnimation?.resume()
  const onStopAnimation = () => {
    if (droneAnimation) {
      droneAnimation.stop()
      droneAnimation = null
    }
    if (currentAnimatedDroneId) {
      restoreDroneIcon(currentAnimatedDroneId)
      currentAnimatedDroneId = null
    }
  }

  // 订单送达：清除动画并恢复图标
  const onOrderDelivered = () => {
    if (droneAnimation) {
      droneAnimation.stop()
      droneAnimation = null
    }
    if (currentAnimatedDroneId) {
      restoreDroneIcon(currentAnimatedDroneId)
      currentAnimatedDroneId = null
    }
  }

  // 视角切换
  const onChangeView = (e) => {
    if (droneAnimation && droneAnimation.setViewMode) {
      droneAnimation.setViewMode(e.detail.mode)
    }
  }

  // 注册事件
  const events = [
    ['order-assigned', onOrderAssigned],
    ['show-planned-route', onShowPlannedRoute],
    ['show-route', onShowRoute],
    ['start-drone-animation', onStartAnimation],
    ['pause-drone-animation', onPauseAnimation],
    ['resume-drone-animation', onResumeAnimation],
    ['stop-drone-animation', onStopAnimation],
    ['order-delivered', onOrderDelivered],
    ['change-drone-view', onChangeView]
  ]
  events.forEach(([event, handler]) => {
    window.addEventListener(event, handler)
    eventListeners.push({ event, handler })
  })
}

/** 更新航线规划提示 */
function updatePlanHint(viewer, mode) {
  if (planHintLabel) {
    viewer.entities.remove(planHintLabel)
    planHintLabel = null
  }
  if (mode) {
    planHintLabel = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(mapStore.campusCenter[0], mapStore.campusCenter[1], 100),
      label: {
        text: mode === 'selectingStart' ? '请点击地图选择起点' : '请点击地图选择终点',
        font: 'bold 16px sans-serif',
        fillColor: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
        backgroundPadding: new Cesium.Cartesian2(10, 8)
      }
    })
  }
}

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

function stopMeasure() {
  measureController?.stop()
}

defineExpose({ stopMeasure })
</script>

<style scoped>
.cesium-container {
  width: 100%;
  height: 100%;
}
</style>
