<template>
  <div ref="cesiumContainer" class="cesium-container"></div>
</template>

<script setup>
import { shallowRef, markRaw, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/map'
import { getGeoJson, getCampusBounds, pointQuery } from '@/api/spatial'
import { getDrones, updateDronePosition } from '@/api/drone'
import { getNoFlyZones } from '@/api/noFlyZone'
import { getActiveRoutes, getRouteByOrderId } from '@/api/route'
import { getRestaurants, getRestaurantDetail, getRestaurantCoverage } from '@/api/restaurant'
import {
  loadBuildings, loadVenues, loadRoads, loadSchoolBoundary,
  loadDrones as loadDroneEntities, createDroneEntity, getDroneColor,
  loadNoFlyZones as loadNoFlyZoneEntities,
  loadRoute, loadRestaurantMarkers, loadDormitoryMarkers, parseRouteGeojson,
  createDroneAnimation, getTableNameByType,
  flyToTarget, loadCanteenBuffer, createDormitoryHighlight
} from '@/utils/cesium'
import { createMeasureController } from '@/utils/measure'
import { shiftFeatureList, shiftPoint } from '@/utils/basemap'

const mapStore = useMapStore()
/**
 * Cesium 容器 DOM。
 *
 * 用 shallowRef 而非 ref：ref 会把 DOM 元素也包成响应式代理，而它会被传进
 * `new Cesium.Viewer(container, ...)` 并被 Viewer 长期持有。
 * 容器本身只用于挂载，不需要响应式，避免把代理对象喂给 Cesium。
 */
const cesiumContainer = shallowRef(null)
const routePlanMode = computed(() => mapStore.routePlanMode)

/**
 * 数据平移量：**恒为不启用**。
 *
 * 本项目 shapefile 虽标注 GCS_WGS_1984，但实际按高德（GCJ-02）底图采集；
 * 底图也用高德，两者同基准 → 不需要任何平移。
 * 曾一度改用天地图（WGS84）底图才出现约 109m 偏移，那个方向是错的。
 *
 * 保留这个函数是为了让加载侧代码统一走 shift* 工具，
 * 万一将来需要处理真正 WGS84 的数据源，只需在这里返回非零偏移即可。
 */
function currentShift() {
  return mapStore.dataShift
}

/** 拉取空间数据并按当前底图坐标系平移 */
async function fetchGeojsonShifted(table) {
  const rows = await getGeoJson(table)
  return shiftFeatureList(rows, currentShift())
}

let handler = null
let measureController = null
let removeHoverHighlight = null // 建筑悬停高亮监听器的移除函数
let dormHighlight = null // 宿舍覆盖高亮 dataSource

/**
 * 建筑悬停高亮色。
 *
 * 用 markRaw 锁死：Cesium 的 Color 实例绝不能进 Vue 响应式状态（见 README
 * "关键实现约束"），markRaw 让它在任何情况下都不会被代理。
 * 复用同一实例，也避免每次悬停都 new 一个 Color。
 */
const HOVER_COLOR = markRaw(Cesium.Color.fromCssColorString('#7EC8FF').withAlpha(0.95))
/** 悬停拾取的 rAF 节流标志：保证每帧最多一次 scene.pick */
let hoverRafPending = false
/** 待执行的悬停 rAF 句柄，卸载时取消，避免回调在组件销毁后仍引用已销毁的 viewer */
let hoverRafId = null

function clearDormHighlight(viewer) {
  if (dormHighlight) {
    viewer.dataSources.remove(dormHighlight)
    dormHighlight = null
  }
}

/**
 * 根据 canteenActiveSelection 设置缓冲圈显隐
 * null=全隐, all=全显, canteen=该食堂3圈, tier=单圈
 */
function applyCanteenSelection(viewer, selection) {
  const ds = mapStore.dataSources.canteenBuffer
  if (!ds) return
  const coverage = mapStore.canteenCoverage || []
  // 先全部隐藏
  for (const c of coverage) {
    for (const t of c.tiers || []) {
      const ent = ds.entities.getById(`canteen-tier-${c.canteen_id}-${t.seconds}`)
      if (ent) ent.show = false
    }
  }
  if (!selection) return
  if (selection.type === 'all') {
    for (const c of coverage) {
      for (const t of c.tiers || []) {
        const ent = ds.entities.getById(`canteen-tier-${c.canteen_id}-${t.seconds}`)
        if (ent) ent.show = true
      }
    }
  } else if (selection.type === 'canteen') {
    const c = coverage.find(x => x.canteen_id === selection.canteenId)
    if (c) {
      for (const t of c.tiers || []) {
        const ent = ds.entities.getById(`canteen-tier-${c.canteen_id}-${t.seconds}`)
        if (ent) ent.show = true
      }
    }
  } else if (selection.type === 'tier') {
    const ent = ds.entities.getById(`canteen-tier-${selection.canteenId}-${selection.seconds}`)
    if (ent) ent.show = true
  }
}
let droneAnimation = null
let droneSyncTimer = null
let animationFinishTimer = null // 动画结束轮询句柄（模块级，手动停止/送达时统一清理，防止泄漏）
let currentAnimatedDroneId = null
let eventListeners = []
let droneTrailData = null
const droneTrails = new Map()
/** smoothMoveEntity 注册的 scene.postUpdate 监听器句柄，卸载时统一注销 */
const smoothMoveRemovers = new Set()

/** 注销全部平滑移动监听器（卸载时调用，避免 postUpdate 上残留闭包） */
function clearSmoothMoveRemovers() {
  smoothMoveRemovers.forEach(remove => {
    try { remove() } catch (e) { /* 已注销则忽略 */ }
  })
  smoothMoveRemovers.clear()
}

/** 清理动画结束轮询定时器（isFinished 轮询与手动停止共用同一清理入口） */
function clearAnimationFinishTimer() {
  if (animationFinishTimer) {
    clearInterval(animationFinishTimer)
    animationFinishTimer = null
  }
}

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

  // 注册建筑悬停高亮
  removeHoverHighlight = registerHoverHighlight(viewer, isBuildingGeometryLoading)

  // 注册自定义事件监听
  registerCustomEventListeners(viewer)

  // 测量接线（内部注册 measureMode watch）
  setupMeasure(viewer)

  // 覆盖浮窗联动：tier 视图高亮宿舍，关闭清除
  watch(() => mapStore.coveragePopup, (v) => {
    clearDormHighlight(viewer)
    if (v?.type === 'tier' && v.dormitories?.length) {
      dormHighlight = createDormitoryHighlight(viewer, v.dormitories)
    }
  })

  // 缓冲圈显隐联动：由 canteenActiveSelection 控制
  watch(() => mapStore.canteenActiveSelection, (sel) => {
    applyCanteenSelection(viewer, sel)
  })

  // 移除 Cesium 默认双击缩放（双击左键=拉远视角），避免测量双击时视角跳变
  viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

  // 监听航线规划模式变化
  watch(routePlanMode, (mode) => {
    updatePlanHint(viewer, mode)
  })
})

onBeforeUnmount(() => {
  if (handler) handler.destroy()
  if (removeHoverHighlight) removeHoverHighlight()
  stopMeasure()
  clearAnimationFinishTimer()
  clearSmoothMoveRemovers()
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

/**
 * 加载一个建筑图层，并把它对应的描边 dataSource 一并登记进图层注册表。
 *
 * 描边是独立的 CustomDataSource（key = outline-<type>），必须登记，
 * 否则图层面板关掉"教学楼"时描边会残留 —— setLayerVisible 正是按 key 找 dataSource 的。
 */
async function loadBuildingLayer(viewer, table, buildingType, name) {
  const features = await fetchGeojsonShifted(table)
  if (!features?.length) return
  mapStore.dataSources[buildingType] = await loadBuildings(viewer, features, buildingType, name)
  const outlineName = 'outline-' + buildingType
  const outlines = viewer.dataSources.getByName(outlineName)
  if (outlines?.length) {
    mapStore.dataSources[outlineName] = outlines[0]
    // 新建 dataSource 默认 show=true，需按当前图层开关回写，
    // 否则用户在数据加载完成前就关掉的图层会被"擅自点亮"
    outlines[0].show = mapStore.layers[buildingType]
  }
}

/** 加载所有空间数据（按当前底图坐标系平移后再渲染） */
async function loadAllSpatialData(viewer) {
  try {
    const schoolData = await fetchGeojsonShifted('school')
    if (schoolData?.length) mapStore.dataSources.school = await loadSchoolBoundary(viewer, schoolData, '校园边界')

    await loadBuildingLayer(viewer, 'teaching_building', 'teaching', '教学楼')
    await loadBuildingLayer(viewer, 'dormitory', 'dormitory', '宿舍楼')
    await loadBuildingLayer(viewer, 'other_buildings', 'other', '其他建筑')

    const roadData = await fetchGeojsonShifted('road')
    if (roadData?.length) mapStore.dataSources.road = await loadRoads(viewer, roadData, '道路')

    const playgroundData = await fetchGeojsonShifted('playground')
    if (playgroundData?.length) mapStore.dataSources.playground = await loadVenues(viewer, playgroundData, 'playground', '操场')

    const basketballData = await fetchGeojsonShifted('basketball_court')
    if (basketballData?.length) mapStore.dataSources.basketball = await loadVenues(viewer, basketballData, 'basketball', '篮球场')

    const tennisData = await fetchGeojsonShifted('tennis_court')
    if (tennisData?.length) mapStore.dataSources.tennis = await loadVenues(viewer, tennisData, 'tennis', '网球场')
  } catch (e) {
    console.error('加载空间数据失败:', e)
  }
}

/** 加载配送相关数据（同样按当前底图坐标系平移） */
async function loadDeliveryData(viewer) {
  const shift = currentShift()

  // 加载限飞区
  try {
    const zonesRaw = await getNoFlyZones()
    const zones = shiftFeatureList(zonesRaw, shift)
    if (zones?.length) {
      mapStore.noFlyZones = zones
      const ds = await loadNoFlyZoneEntities(viewer, zones, '限飞区')
      mapStore.dataSources.noFlyZones = ds
    }
  } catch (e) { console.warn('加载限飞区失败:', e) }

  // 加载无人机（坐标来自后端实时推进，同样需要平移）
  try {
    const dronesRaw = await getDrones()
    const drones = shiftFeatureList(dronesRaw, shift)
      .map(d => shiftPoint(d, shift, 'current_lng', 'current_lat'))
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

  // 加载当前飞行中的航线（route_geom 需平移）
  try {
    const routesRaw = await getActiveRoutes()
    const routes = shiftFeatureList(routesRaw, shift)
      .map(r => shiftRouteGeom(r, shift))
    if (routes?.length) {
      mapStore.routes = routes
      routes.forEach((route, idx) => {
        const ds = loadRoute(viewer, route, `航线-${route.id || idx}`, Cesium.Color.YELLOW)
        registerRouteDataSource(`route-${route.id || idx}`, ds)
      })
    }
  } catch (e) { console.warn('加载航线失败:', e) }

  // 加载餐厅标记
  try {
    const restaurantsRaw = await getRestaurants()
    if (restaurantsRaw?.length) {
      // 获取餐厅详情（含坐标），统一走 axios 封装
      const details = await Promise.all(
        restaurantsRaw.map(r => getRestaurantDetail(r.id).catch(() => null))
      ).catch(() => [])
      const validDetails = details.filter(Boolean).map(d => shiftPoint(d, shift, 'center_lng', 'center_lat'))
      if (validDetails.length) {
        mapStore.dataSources.restaurants = loadRestaurantMarkers(viewer, validDetails, '餐厅标记')
      }
    }
  } catch (e) { console.warn('加载餐厅标记失败:', e) }

  // 加载食堂缓冲区覆盖（center 与 reach_geojson 都要平移）
  try {
    const coverageRaw = await getRestaurantCoverage()
    const coverage = shiftCoverage(coverageRaw, shift)
    if (coverage?.length) {
      mapStore.canteenCoverage = coverage
      mapStore.dataSources.canteenBuffer = loadCanteenBuffer(viewer, coverage, '食堂缓冲区')
      // 默认全隐藏，由 canteenActiveSelection 控制显隐
      applyCanteenSelection(viewer, mapStore.canteenActiveSelection)
    }
  } catch (e) { console.warn('加载食堂缓冲区失败:', e) }

  // 加载宿舍楼标记（图层面板开关）
  try {
    const dormitories = await fetchGeojsonShifted('dormitory')
    if (dormitories?.length) {
      mapStore.dataSources.dormitoryMarkers = loadDormitoryMarkers(viewer, dormitories, '宿舍楼标记')
    }
  } catch (e) { console.warn('加载宿舍楼标记失败:', e) }
}

/** 平移航线对象的 route_geom（GeoJSON 字符串） */
function shiftRouteGeom(route, shift) {
  if (!route || !shift?.enabled || !route.route_geom) return route
  return shiftFeatureList([{ geom: route.route_geom }], shift)
    .map(x => ({ ...route, route_geom: x.geom }))[0]
}

/** 平移食堂覆盖数据的中心点与可达区几何 */
function shiftCoverage(list, shift) {
  if (!Array.isArray(list) || !shift?.enabled) return list
  return list.map(c => {
    const moved = shiftPoint(c, shift, 'center_lng', 'center_lat')
    return {
      ...moved,
      tiers: (c.tiers || []).map(t => ({
        ...t,
        reach_geojson: t.reach_geojson
          ? shiftFeatureList([{ geom: t.reach_geojson }], shift)[0].geom
          : t.reach_geojson
      }))
    }
  })
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
    // 播放飞行动画期间不做位置同步：
    // 动画控制器通过 viewer.clock 驱动实体位置，而本函数的 smoothMoveEntity
    // 用 Cesium.JulianDate.now() 驱动同一个实体的 position，两个写入方会互相覆盖，
    // 表现为动画中的无人机位置跳变。宁可暂停同步 1~2 个周期，也不能让两者打架。
    if (mapStore.animationState !== 'idle') {
      return
    }
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
      smoothMoveRemovers.delete(remove)
      entity.position = targetCartesian
    }
  })
  // 登记句柄，组件卸载时统一注销；否则 entity 被移除后监听器仍会在 postUpdate 里空跑
  smoothMoveRemovers.add(remove)
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

/**
 * 取屏幕点击位置对应的**地表**世界坐标（用于反查经纬度）。
 *
 * 三级兜底，按精度从高到低：
 *   1. scene.pickPosition —— 深度缓冲反投影，能取到 3D Tiles / 建筑表面的真实点
 *      （仅当场景支持 pickPosition 时才可用，Cesium 对地形/深度纹理有要求）
 *   2. globe.pick(ray)    —— 相机射线与地形的交点，最贴合"点在哪个建筑轮廓里"
 *   3. pickEllipsoid      —— 只跟椭球面求交，无地形时的历史行为
 *
 * 之所以要换掉纯 pickEllipsoid：点击楼体上部时，射线与海拔 0 椭球面的交点
 * 落在建筑后方地面，很可能已经出了建筑轮廓，pointQuery 就查不到要素了。
 *
 * @returns {Cesium.Cartesian3|null} 交点的世界坐标，三级全失败时返回 null
 */
function resolvePickPosition(viewer, windowPosition) {
  const scene = viewer.scene
  try {
    if (scene.pickPositionSupported) {
      const picked = scene.pickPosition(windowPosition)
      // 交点落在地球背面时 Cesium 会返回原点附近的坐标，用 magnitude 排除掉
      if (Cesium.defined(picked) && Cesium.Cartesian3.magnitude(picked) > 1) return picked
    }
  } catch (e) { /* 无深度纹理等情况下 pickPosition 会抛错，忽略并降级 */ }

  try {
    const ray = viewer.camera.getPickRay(windowPosition)
    if (ray) {
      const onGlobe = scene.globe.pick(ray, scene)
      if (Cesium.defined(onGlobe)) return onGlobe
    }
  } catch (e) { /* 同上，继续降级 */ }

  return viewer.camera.pickEllipsoid(windowPosition, scene.globe.ellipsoid) || null
}

/**
 * 建筑悬停高亮：鼠标移到可点击的楼体上时加一层描边 + 提亮填充。
 *
 * 用 MOUSE_MOVE 而非 LEFT_CLICK，是为了让"能点"这件事在点击之前就有视觉反馈。
 * 无副作用：不改实体属性，只在 WeakMap 里暂存原始颜色，移开时还原。
 *
 * @param {Function} isPickingSuspended 返回 true 时跳过本次拾取，
 *        用于在几何尚未建完（俯视视角、建筑还在异步生成）时避免空跑
 * @returns {Function} 移除该监听器的函数
 */
function registerHoverHighlight(viewer, isPickingSuspended) {
  const hoveredState = new WeakMap() // entity -> { material, outlineColor, outlineWidth }
  let hovered = null
  let lastCursor = null

  function setCursor(cursor) {
    if (lastCursor === cursor) return
    lastCursor = cursor
    viewer.scene.canvas.style.cursor = cursor
  }

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction((movement) => {
    // 俯视视角下鼠标划过屏幕的每个像素都会触发一次拾取，而 scene.pick 内部会
    // 跑一遍渲染 pass（Primitive.update → 几何任务）。用 rAF 把拾取压到每帧一次：
    // 鼠标事件可达上百 Hz，而屏幕刷新只有 60 Hz，多余的拾取纯属浪费。
    if (hoverRafPending) return
    hoverRafPending = true
    hoverRafId = requestAnimationFrame(() => {
      hoverRafPending = false
      hoverRafId = null
      // 几何还在异步构建时快速掠过：拾取既拿不到结果，又会和几何任务抢时间，
      // 直接跳过（下一帧再试），比强行 pick 更省也更稳
      if (isPickingSuspended?.()) {
        setCursor('')
        return
      }
      doHoverPick(movement.endPosition)
    })
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

  function doHoverPick(windowPosition) {
    // 测量/航线规划模式下不介入，避免与取点交互抢反馈
    if (mapStore.measureMode || routePlanMode.value) {
      setCursor('')
      return
    }

    let target = null
    try {
      const picked = viewer.scene.pick(windowPosition)
      const entity = picked?.id
      if (entity?._buildingType) target = entity
    } catch (e) { /* 拾取异常时静默降级为无高亮 */ }

    if (target === hovered) return

    // 还原上一个
    if (hovered) {
      const saved = hoveredState.get(hovered)
      if (saved && hovered.polygon) {
        hovered.polygon.material = saved.material
        hovered.polygon.outlineColor = saved.outlineColor
        hovered.polygon.outlineWidth = saved.outlineWidth
      }
      hoveredState.delete(hovered)
    }

    hovered = target
    if (hovered) {
      const polygon = hovered.polygon
      if (polygon) {
        hoveredState.set(hovered, {
          material: polygon.material,
          outlineColor: polygon.outlineColor,
          outlineWidth: polygon.outlineWidth
        })
        // 复用同一份 Color 常量，避免每次悬停都新建对象
        polygon.material = HOVER_COLOR
        polygon.outlineColor = Cesium.Color.WHITE
        polygon.outlineWidth = 2
      }
      setCursor('pointer')
    } else {
      setCursor('')
    }
  }

  function restoreHovered() {
    if (!hovered) return
    const saved = hoveredState.get(hovered)
    if (saved && hovered.polygon) {
      hovered.polygon.material = saved.material
      hovered.polygon.outlineColor = saved.outlineColor
      hovered.polygon.outlineWidth = saved.outlineWidth
    }
    hoveredState.delete(hovered)
    hovered = null
  }

  return () => {
    restoreHovered()
    setCursor('')
    handler.destroy()
    // 取消待执行的 rAF：否则回调可能在 viewer 销毁后仍被调用
    if (hoverRafId !== null) {
      cancelAnimationFrame(hoverRafId)
      hoverRafId = null
      hoverRafPending = false
    }
  }
}

/**
 * 建筑几何是否还在异步构建中。
 *
 * ⚠️ Cesium 的 `dataSource.isLoading` 是**布尔属性**，不是方法。
 * 写成 `isLoading?.()` 会抛 TypeError（`?.` 只对 null/undefined 短路，
 * 对"非函数值"照样调用）—— 而点击回调是 async，异常会变成未处理的
 * Promise rejection，整个点击处理器就此中断，弹窗再也不会出现。
 *
 * 三个建筑 dataSource 共用同一套 Worker 几何任务，任意一个未加载完即视为加载中。
 * 只用于悬停反馈降噪；**不要**用它挡住点击（见 registerClickHandler 里的说明）。
 *
 * @returns {boolean}
 */
function isBuildingGeometryLoading() {
  for (const key of ['teaching', 'dormitory', 'other']) {
    const ds = mapStore.dataSources[key]
    // 必须显式判类型：属性存在但是布尔值时，?.() 依然会抛错
    if (ds && ds.isLoading === true) return true
  }
  return false
}

/** 注册点击事件 */
function registerClickHandler(viewer) {
  handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

  handler.setInputAction(async (movement) => {
    try {
      await handleLeftClick(viewer, movement)
    } catch (e) {
      // async 监听器里抛出的异常会变成未处理的 Promise rejection：
      // 不报错、不提示，点击功能直接静默失效（本项目踩过这个坑）。
      // 这里兜住，保证任何异常都不会让后续点击失灵。
      console.error('[click] 处理点击失败:', e)
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

/** 左键点击的完整处理逻辑（由 registerClickHandler 包在 try/catch 里调用） */
async function handleLeftClick(viewer, movement) {
  {
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

      // 食堂缓冲圈：该档覆盖宿舍 + 高亮（高亮由 coveragePopup watch 统一处理）
      if (entity.properties?.isCanteenTier?.getValue()) {
        const canteenId = entity.properties.canteenId?.getValue()
        const seconds = entity.properties.seconds?.getValue()
        const canteen = (mapStore.canteenCoverage || []).find(c => c.canteen_id === canteenId)
        const tier = canteen?.tiers?.find(t => t.seconds === seconds)
        if (tier) {
          mapStore.canteenActiveSelection = { type: 'tier', canteenId, seconds }
          mapStore.coveragePopup = {
            type: 'tier',
            canteenId,
            canteenName: canteen.name,
            seconds,
            dormitories: tier.dormitories
          }
        }
        return
      }

      // 食堂标记：3 档覆盖概览（联动显示该食堂 3 个缓冲圈，与查询面板行为一致）
      if (entity.properties?.isRestaurant?.getValue()) {
        const canteen = (mapStore.canteenCoverage || []).find(
          c => c.canteen_id === entity.properties.id?.getValue()
        )
        if (canteen) {
          mapStore.canteenActiveSelection = { type: 'canteen', canteenId: canteen.canteen_id }
          mapStore.coveragePopup = {
            type: 'overview',
            canteenId: canteen.canteen_id,
            canteenName: canteen.name
          }
        }
        return
      }

      // 建筑点击：弹出建筑信息浮窗（院系/性别/简介/照片）
      const buildingType = entity._buildingType
      if (buildingType) {
        await selectBuildingByEntity(viewer, entity, buildingType, movement.position)
        return
      }
    }

    // 点击空白处，清除选中
    mapStore.clearSelection()
    mapStore.coveragePopup = null
  }
}

/**
 * 弹出建筑信息浮窗。
 *
 * 属性来源分两层，**属性在前、反查在后**：
 *   1. 实体自身 properties —— loadBuildings 加载的整表 GeoJSON 已含
 *      name/height/dept_name/gender/description/geom，点击时立即可用
 *   2. pointQuery 按点击坐标反查 —— 补 area_sqm/perimeter_m 这类由 PostGIS 现算的字段
 *
 * 这样即使地表点解析失败或后端暂时不可用，弹窗依然能显示院系/性别/简介。
 */
async function selectBuildingByEntity(viewer, entity, buildingType, windowPosition) {
  const props = {}
  for (const key of ['id', 'name', 'height', 'dept_name', 'gender', 'description', 'area_sqm', 'perimeter_m']) {
    const v = entity.properties?.[key]?.getValue()
    if (v !== undefined) props[key] = v
  }

  const tableName = entity._tableName || getTableNameByType(buildingType)

  // 用射线求交取真实地表点。**不能**用 pickEllipsoid：
  // 它是「相机射线与 WGS84 椭球面（海拔 0）的交点」，点在楼体上部时
  // 交点到的是楼后方的地面，很容易落在建筑轮廓之外，于是 pointQuery 查空。
  const cartesian = resolvePickPosition(viewer, windowPosition)

  // 兜底：连地表交点都取不到时，用建筑形心（loadBuildings 已预存）
  let lng = entity._centroidLng
  let lat = entity._centroidLat
  if (cartesian) {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
    lng = Cesium.Math.toDegrees(cartographic.longitude)
    lat = Cesium.Math.toDegrees(cartographic.latitude)
  }
  const position = cartesian || (lng != null && lat != null ? Cesium.Cartesian3.fromDegrees(lng, lat) : null)

  // 基础信息先备好，接口查空/失败时直接用它，浮窗至少有名有层数
  const base = { ...props, tableName, buildingType, lng, lat, position }
  if (base.id == null) base.id = entity.id

  let detail = null
  if (lng != null && lat != null) {
    try {
      detail = await pointQuery(tableName, lng, lat)
    } catch (e) {
      console.warn('[click] pointQuery 失败，改用实体属性展示:', e)
    }
  }

  // 只接受真正查到的要素（后端查空时返回 null）。base 在前：
  // detail 里的 area_sqm/perimeter_m 以数据库为准，缺字段时被 base 补齐
  mapStore.selectBuilding(detail ? { ...base, ...detail } : base)
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
        registerRouteDataSource(`order-route-${e.detail.orderId}`, ds)
      }
    } catch (err) { console.error('加载订单航线失败:', err) }
  }

  // 显示规划的航线
  const onShowPlannedRoute = (e) => {
    // 清除之前的规划航线（同时从 viewer 与 store 移除，避免 store 里残留失效引用）
    const prev = mapStore.dataSources['route-planned']
    if (prev) {
      viewer.dataSources.remove(prev)
      delete mapStore.dataSources['route-planned']
    }
    const routeData = {
      route_geom: e.detail.routeGeojson,
      altitude_m: e.detail.altitude || 50,
      id: 'planned'
    }
    // key 必须落在 setLayerVisible('routes') 识别的 `route-` 前缀内，
    // 否则"飞行航线"图层开关管不到规划航线（关掉后它仍然显示）
    const ds = loadRoute(viewer, routeData, '规划航线', Cesium.Color.MAGENTA)
    registerRouteDataSource('route-planned', ds)
  }

  // 显示订单航线
  const onShowRoute = async (e) => {
    try {
      const route = await getRouteByOrderId(e.detail.orderId)
      if (route) {
        const ds = loadRoute(viewer, route, `航线-${e.detail.orderId}`, Cesium.Color.YELLOW)
        registerRouteDataSource(`route-${e.detail.orderId}`, ds)
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
      // 动画结束后自动停止（句柄模块级：手动停止/订单送达时也必须清理，否则轮询永不退出）
      clearAnimationFinishTimer()
      animationFinishTimer = setInterval(() => {
        if (droneAnimation?.isFinished()) {
          clearAnimationFinishTimer()
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
    clearAnimationFinishTimer()
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
    clearAnimationFinishTimer()
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

/**
 * 把 loadRoute 产出的 dataSource 登记进 store，并同步当前图层显隐状态。
 *
 * 注意：loadRoute 内部已经 viewer.dataSources.add(ds)，此处**不能**重复 add。
 * 新建的 dataSource 默认 show=true，若用户已关闭"飞行航线"图层，
 * 新增航线会违反该开关擅自显示，因此需要按 layers.routes 回写 show。
 */
function registerRouteDataSource(key, ds) {
  mapStore.dataSources[key] = ds
  if (ds) ds.show = mapStore.layers.routes
  return ds
}

/** 更新航线规划提示 */function updatePlanHint(viewer, mode) {
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
      measureController?.clear() // 清上一轮残留实体，避免新旧叠加
      measureController = createMeasureController(viewer, mode)
      mapStore.measureController = measureController
      measureController.onUpdate((snap) => {
        mapStore.measureSnapshot = { ...snap, phase: 'placing' }
      })
      measureController.onEnd((snap) => {
        mapStore.measureSnapshot = { ...snap, phase: 'done' }
        mapStore.setMeasureMode(null) // 确认结束即退出测量态，实体保留
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
