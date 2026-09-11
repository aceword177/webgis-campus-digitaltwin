import * as Cesium from 'cesium'

/**
 * Cesium 工具函数封装
 * 包含 GeoJSON 加载、建筑白模拉伸、坐标转换、测量等通用方法
 */

/** 每层楼的高度（米） */
export const FLOOR_HEIGHT = 3.5

/** 建筑类型对应的颜色 */
export const BUILDING_COLORS = {
  teaching: Cesium.Color.fromCssColorString('#4A90D9').withAlpha(0.85),
  dormitory: Cesium.Color.fromCssColorString('#E8943A').withAlpha(0.85),
  other: Cesium.Color.fromCssColorString('#5CB85C').withAlpha(0.85)
}

/** 场地类型对应的颜色 */
export const VENUE_COLORS = {
  playground: Cesium.Color.fromCssColorString('#C0392B').withAlpha(0.4),
  basketball: Cesium.Color.fromCssColorString('#E67E22').withAlpha(0.5),
  tennis: Cesium.Color.fromCssColorString('#27AE60').withAlpha(0.5)
}

/**
 * 相机 flyTo 定位到目标，保证目标位于视野中心
 *
 * 背景：camera.flyTo({ destination }) 的 destination 是"相机位置"而非目标位置。
 * 若把相机放到目标正上方 + heading=0(朝北)/pitch=-45(向下45°)，
 * 视线与地面的交点会落在目标北侧 height 米处，导致视野中心偏移到目标"上面"。
 *
 * 修复：把相机放到目标南侧（纬度向南偏移 height 米，水平距离=height/tan45°=height），
 * 相机朝正北向下 45° 俯视，视线中心恰好落在目标上。
 *
 * @param {Cesium.Viewer} viewer
 * @param {Number} lng 目标经度
 * @param {Number} lat 目标纬度
 * @param {Number} height 相机高度(米)
 * @param {Number} duration 动画时长(秒)
 */
export function flyToTarget(viewer, lng, lat, height, duration = 1.5) {
  const latOffset = height / 111320 // 1度纬度 ≈ 111320m，向南偏移使目标居中
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lng, lat - latOffset, height),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-45),
      roll: 0
    },
    duration
  })
}

/**
 * 将后端返回的要素列表（含 geom GeoJSON 字符串）转为标准 GeoJSON FeatureCollection
 * @param {Array} features - 后端返回的要素列表
 * @returns {Object} GeoJSON FeatureCollection
 */
export function toGeoJsonFeatureCollection(features) {
  return {
    type: 'FeatureCollection',
    features: features.map(f => ({
      type: 'Feature',
      geometry: typeof f.geom === 'string' ? JSON.parse(f.geom) : f.geom,
      properties: { ...f, geom: undefined }
    }))
  }
}

/**
 * 加载建筑 GeoJSON 并拉伸为白模
 * @param {Cesium.Viewer} viewer - Cesium Viewer
 * @param {Array} features - 后端返回的建筑要素列表
 * @param {string} buildingType - 建筑类型 teaching/dormitory/other
 * @param {string} name - DataSource 名称
 * @returns {Promise<Cesium.GeoJsonDataSource>}
 */
export async function loadBuildings(viewer, features, buildingType, name) {
  const geoJson = toGeoJsonFeatureCollection(features)
  const dataSource = await Cesium.GeoJsonDataSource.load(geoJson, {
    stroke: Cesium.Color.WHITE.withAlpha(0.3),
    strokeWidth: 1,
    fill: BUILDING_COLORS[buildingType] || BUILDING_COLORS.other,
    clampToGround: true
  })

  // 拉伸建筑为白模
  const entities = dataSource.entities.values
  for (const entity of entities) {
    const height = entity.properties?.height?.getValue() || 3
    const extrudedHeight = height * FLOOR_HEIGHT
    entity.polygon.extrudedHeight = extrudedHeight
    entity.polygon.height = 0
    entity.polygon.outline = true
    entity.polygon.outlineColor = Cesium.Color.WHITE.withAlpha(0.4)
    // 存储建筑类型，用于点击判断
    entity.billboard = undefined
    entity._buildingType = buildingType
    entity._tableName = getTableNameByType(buildingType)
  }

  dataSource.name = name
  viewer.dataSources.add(dataSource)
  return dataSource
}

/**
 * 加载场地（操场/篮球场/网球场）GeoJSON
 */
export async function loadVenues(viewer, features, venueType, name) {
  const geoJson = toGeoJsonFeatureCollection(features)
  const dataSource = await Cesium.GeoJsonDataSource.load(geoJson, {
    stroke: Cesium.Color.WHITE.withAlpha(0.5),
    strokeWidth: 2,
    fill: VENUE_COLORS[venueType] || Cesium.Color.YELLOW.withAlpha(0.3),
    clampToGround: true
  })

  dataSource.name = name
  viewer.dataSources.add(dataSource)
  return dataSource
}

/**
 * 加载道路 GeoJSON（线要素）
 */
export async function loadRoads(viewer, features, name) {
  const geoJson = toGeoJsonFeatureCollection(features)
  const dataSource = await Cesium.GeoJsonDataSource.load(geoJson, {
    stroke: Cesium.Color.fromCssColorString('#888888'),
    strokeWidth: 3,
    clampToGround: true
  })

  dataSource.name = name
  viewer.dataSources.add(dataSource)
  return dataSource
}

/**
 * 加载校园边界（描边，无填充）
 *
 * 实现说明：不能依赖 GeoJsonDataSource 的 stroke 选项——clampToGround=true 时
 * 多边形以 GroundPrimitive 渲染，outline（描边）不生效，且 fill 为透明时整层不可见。
 * 因此手动提取每个多边形外环，改用贴地 polyline（GroundPolylinePrimitive）描边。
 */
export async function loadSchoolBoundary(viewer, features, name) {
  const dataSource = new Cesium.CustomDataSource(name)
  const geoJson = toGeoJsonFeatureCollection(features)

  for (const feature of geoJson.features || []) {
    const geom = feature?.geometry
    if (!geom) continue

    // 提取外环坐标（支持 Polygon / MultiPolygon）
    const rings = []
    if (geom.type === 'Polygon') {
      if (geom.coordinates?.[0]) rings.push(geom.coordinates[0])
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates || []) {
        if (poly?.[0]) rings.push(poly[0])
      }
    }

    for (const ring of rings) {
      if (!ring || ring.length < 3) continue
      dataSource.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(ring.flat()),
          width: 3,
          material: Cesium.Color.YELLOW,
          clampToGround: true
        }
      })
    }
  }

  viewer.dataSources.add(dataSource)
  return dataSource
}

/**
 * 加载设备点位
 */
export function loadDevices(viewer, devices, name) {
  const dataSource = new Cesium.CustomDataSource(name)

  for (const device of devices) {
    const color = device.online
      ? Cesium.Color.fromCssColorString('#00FF00')
      : Cesium.Color.fromCssColorString('#FF0000')

    dataSource.entities.add({
      id: device.id,
      position: Cesium.Cartesian3.fromDegrees(device.lng, device.lat),
      point: {
        pixelSize: 8,
        color: color,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      },
      label: {
        text: device.name,
        font: '10px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -12),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        show: false // 默认不显示标签，hover 时显示
      },
      properties: {
        ...device
      }
    })
  }

  viewer.dataSources.add(dataSource)
  return dataSource
}

/**
 * 根据建筑类型获取表名
 */
export function getTableNameByType(type) {
  const map = {
    teaching: 'teaching_building',
    dormitory: 'dormitory',
    other: 'other_buildings'
  }
  return map[type] || 'other_buildings'
}

/**
 * 计算两点间距离（米）
 */
export function computeDistance(point1, point2) {
  const geodesic = new Cesium.EllipsoidGeodesic(
    Cesium.Cartographic.fromCartesian(point1),
    Cesium.Cartographic.fromCartesian(point2)
  )
  return geodesic.surfaceDistance
}

/**
 * 格式化距离显示
 */
export function formatDistance(meters) {
  if (meters >= 1000) {
    return (meters / 1000).toFixed(2) + ' km'
  }
  return meters.toFixed(2) + ' m'
}

/**
 * 格式化面积显示
 */
export function formatArea(sqm) {
  if (sqm >= 10000) {
    return (sqm / 10000).toFixed(2) + ' 公顷'
  }
  return sqm.toFixed(2) + ' m²'
}

// ============================================================
// 以下为无人机配送系统新增工具函数
// ============================================================

/** 无人机状态对应的颜色 */
export const DRONE_COLORS = {
  idle: Cesium.Color.fromCssColorString('#00FF00'),       // 绿色 - 空闲
  delivering: Cesium.Color.fromCssColorString('#FFD700'),   // 金色 - 配送中
  charging: Cesium.Color.fromCssColorString('#00BFFF'),     // 蓝色 - 充电中
  maintenance: Cesium.Color.fromCssColorString('#FF6347')   // 红色 - 维护
}

/** 航线飞行阶段颜色 */
export const ROUTE_PHASE_COLORS = {
  ascend: Cesium.Color.fromCssColorString('#FF4444'),   // 红色 - 上升
  cruise: Cesium.Color.fromCssColorString('#FFD700'),    // 黄色 - 水平飞行
  descend: Cesium.Color.fromCssColorString('#4444FF')    // 蓝色 - 下降
}

/**
 * 根据无人机状态获取颜色
 */
export function getDroneColor(status) {
  return DRONE_COLORS[status] || Cesium.Color.GRAY
}

/**
 * 创建无人机四旋翼图标（Canvas 绘制，全白剪影，供 billboard.color 染色）
 * 染色后整体呈状态色：绿色=空闲 / 金色=配送中 / 蓝色=充电中 / 红色=电量不足或维护
 */
export function createDroneIcon() {
  const canvas = document.createElement('canvas')
  canvas.width = 64; canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#FFFFFF'

  // 四个旋翼（俯视图：分布在四角）
  const rotorRadius = 11
  const rotors = [[16, 16], [48, 16], [16, 48], [48, 48]]
  for (const [x, y] of rotors) {
    ctx.beginPath(); ctx.arc(x, y, rotorRadius, 0, Math.PI * 2); ctx.fill()
  }

  // 十字机臂（连接旋翼与机身）
  ctx.fillRect(21, 13, 3, 38)   // 左臂（上-下）
  ctx.fillRect(13, 21, 38, 3)   // 右臂（左-右）
  ctx.fillRect(26, 26, 12, 12)  // 中心连接块

  // 中心机身（比旋翼略小的实心圆）
  ctx.beginPath(); ctx.arc(32, 32, 10, 0, Math.PI * 2); ctx.fill()
  // 机头方向标记（上方的突出小圆，帮助识别朝向）
  ctx.beginPath(); ctx.arc(32, 8, 4, 0, Math.PI * 2); ctx.fill()

  return canvas.toDataURL()
}

/**
 * 创建单个无人机实体（四旋翼图标 + 常显编号标签）
 * @param {Object} drone - 无人机数据（snake_case 字段）
 * @returns {Object|null} Cesium 实体配置，坐标缺失时返回 null
 */
export function createDroneEntity(drone) {
  // 防御：坐标缺失时返回 null，由调用方跳过，避免 Cesium.DeveloperError
  if (drone.current_lng == null || drone.current_lat == null) {
    console.warn('无人机坐标缺失，跳过:', drone.drone_no || drone.id)
    return null
  }
  const color = getDroneColor(drone.status)
  // 电量不足判定：小于等于 30% 即视为电量不足（红色显示）
  const lowBattery = drone.battery_pct !== undefined && drone.battery_pct <= 30
  return {
    id: 'drone-' + drone.id,
    position: Cesium.Cartesian3.fromDegrees(drone.current_lng, drone.current_lat, 50),
    billboard: {
      image: createDroneIcon(),
      width: 36,
      height: 36,
      color: lowBattery ? Cesium.Color.RED : color,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      // 图标始终可见，不被建筑白模遮挡
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    },
    label: {
      text: drone.drone_no,
      font: '11px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -26),
      show: true // 编号常显，方便识别
    },
    properties: {
      ...drone,
      isDrone: true
    }
  }
}

/**
 * 加载无人机点位
 */
export function loadDrones(viewer, drones, name) {
  const dataSource = new Cesium.CustomDataSource(name)
  for (const drone of drones) {
    const entity = createDroneEntity(drone)
    if (entity) dataSource.entities.add(entity)
  }
  viewer.dataSources.add(dataSource)
  return dataSource
}

/**
 * 解析航线 GeoJSON 为坐标数组
 */
export function parseRouteGeojson(geojsonStr) {
  if (!geojsonStr) return []
  try {
    const geo = typeof geojsonStr === 'string' ? JSON.parse(geojsonStr) : geojsonStr
    if (geo.type === 'LineString' && geo.coordinates) {
      return geo.coordinates
    }
  } catch (e) {
    console.warn('解析航线 GeoJSON 失败:', e)
  }
  return []
}

/**
 * 加载单条航线（按飞行阶段分色渲染）
 * 简化版：整条航线用一种颜色，后续可按阶段分段
 */
export function loadRoute(viewer, route, name, color) {
  const dataSource = new Cesium.CustomDataSource(name)
  const coords = parseRouteGeojson(route.route_geom || route.routeGeojson)
  if (coords.length < 2) return dataSource

  const positions = coords.map(c => Cesium.Cartesian3.fromDegrees(c[0], c[1], route.altitude_m || 50))

  dataSource.entities.add({
    id: 'route-' + (route.id || route.orderId),
    polyline: {
      positions: positions,
      width: 4,
      material: color || Cesium.Color.YELLOW,
      clampToGround: false
    },
    properties: {
      ...route,
      isRoute: true
    }
  })

  // 起点标记
  dataSource.entities.add({
    position: positions[0],
    point: { pixelSize: 8, color: Cesium.Color.GREEN, outlineColor: Cesium.Color.WHITE, outlineWidth: 1 }
  })
  // 终点标记
  dataSource.entities.add({
    position: positions[positions.length - 1],
    point: { pixelSize: 8, color: Cesium.Color.RED, outlineColor: Cesium.Color.WHITE, outlineWidth: 1 }
  })

  viewer.dataSources.add(dataSource)
  return dataSource
}

/**
 * 加载限飞区
 */
export function loadNoFlyZones(viewer, zones, name) {
  const features = []
  for (const z of zones) {
    // 防御：几何为空或解析失败时跳过该条，避免整批加载崩溃
    let geometry = null
    if (typeof z.geom === 'string') {
      try {
        geometry = JSON.parse(z.geom)
      } catch (e) {
        console.warn('解析限飞区几何失败，跳过:', z.id, e)
        continue
      }
    } else {
      geometry = z.geom
    }
    if (!geometry) continue
    features.push({
      type: 'Feature',
      geometry,
      properties: { ...z, geom: undefined }
    })
  }
  const geoJson = { type: 'FeatureCollection', features }
  const dataSource = Cesium.GeoJsonDataSource.load(geoJson, {
    stroke: Cesium.Color.RED,
    strokeWidth: 2,
    fill: Cesium.Color.RED.withAlpha(0.25),
    clampToGround: true
  })
  dataSource.then(ds => {
    ds.name = name
    for (const entity of ds.entities.values) {
      entity._isNoFlyZone = true
    }
    viewer.dataSources.add(ds)
  })
  return dataSource
}

/**
 * 加载餐厅标记（在建筑位置上方加 billboard）
 */
export function loadRestaurantMarkers(viewer, restaurants, name) {
  const dataSource = new Cesium.CustomDataSource(name)
  for (const r of restaurants) {
    if (!r.center_lng || !r.center_lat) continue
    dataSource.entities.add({
      id: 'restaurant-' + r.id,
      position: Cesium.Cartesian3.fromDegrees(r.center_lng, r.center_lat, 30),
      billboard: {
        image: createRestaurantIcon(),
        width: 32,
        height: 32,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
      },
      label: {
        text: r.name,
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -36)
      },
      properties: { ...r, isRestaurant: true }
    })
  }
  viewer.dataSources.add(dataSource)
  return dataSource
}

/**
 * 加载宿舍楼标记
 */
export function loadDormitoryMarkers(viewer, dormitories, name) {
  const dataSource = new Cesium.CustomDataSource(name)
  for (const d of dormitories) {
    let lng, lat
    // 1) 优先取接口返回的质心字段
    if (d.centroid) {
      try {
        const c = typeof d.centroid === 'string' ? JSON.parse(d.centroid) : d.centroid
        lng = c.coordinates[0]; lat = c.coordinates[1]
      } catch (e) {
        console.warn('解析宿舍楼质心失败，跳过:', d.id, e)
        continue
      }
    } else {
      // 2) 无质心字段时，从 Polygon/MultiPolygon 的 GeoJSON 取外环坐标平均（近似质心）
      let geo = null
      try {
        geo = typeof d.geom === 'string' ? JSON.parse(d.geom) : d.geom
      } catch (e) {
        geo = null
      }
      let ring = null
      if (geo) {
        if (geo.type === 'Polygon') ring = geo.coordinates?.[0]
        else if (geo.type === 'MultiPolygon') ring = geo.coordinates?.[0]?.[0]
        else if (geo.type === 'LineString') ring = geo.coordinates
      }
      if (!ring || !ring.length) continue
      lng = ring.reduce((s, c) => s + c[0], 0) / ring.length
      lat = ring.reduce((s, c) => s + c[1], 0) / ring.length
    }
    if (lng == null || lat == null) continue
    dataSource.entities.add({
      id: 'dormitory-' + d.id,
      position: Cesium.Cartesian3.fromDegrees(lng, lat, 20),
      billboard: {
        image: createDormitoryIcon(),
        width: 28,
        height: 28,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
      },
      properties: { ...d, isDormitory: true }
    })
  }
  viewer.dataSources.add(dataSource)
  return dataSource
}

/**
 * 创建餐厅图标（Canvas 绘制）
 */
function createRestaurantIcon() {
  const canvas = document.createElement('canvas')
  canvas.width = 64; canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#FF6B35'
  ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#FFF'
  ctx.font = 'bold 28px sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('餐', 32, 34)
  return canvas.toDataURL()
}

/**
 * 创建宿舍楼图标（Canvas 绘制）
 */
function createDormitoryIcon() {
  const canvas = document.createElement('canvas')
  canvas.width = 64; canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#4A90D9'
  ctx.beginPath(); ctx.arc(32, 32, 26, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#FFF'
  ctx.font = 'bold 24px sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('宿', 32, 34)
  return canvas.toDataURL()
}

/**
 * 创建无人机沿航线飞行动画
 * 使用 SampledPositionProperty 实现平滑移动
 * @returns {Object} 动画控制器 { start, pause, resume, stop, entity }
 */
export function createDroneAnimation(viewer, routeGeojson, droneId, altitude = 50, speed = 8) {
  const coords = parseRouteGeojson(routeGeojson)
  if (coords.length < 2) {
    console.warn('航线坐标不足，无法创建动画')
    return null
  }

  const positions = coords.map(c => Cesium.Cartesian3.fromDegrees(c[0], c[1], altitude))

  // 计算总距离和总时长
  let totalDistance = 0
  for (let i = 1; i < positions.length; i++) {
    totalDistance += Cesium.Cartesian3.distance(positions[i - 1], positions[i])
  }
  const totalSeconds = totalDistance / speed

  // 创建 SampledPositionProperty
  const property = new Cesium.SampledPositionProperty()
  property.setInterpolationOptions({
    interpolationDegree: 2,
    interpolationAlgorithm: Cesium.HermitePolynomialApproximation
  })

  let accumulatedDistance = 0
  const start = Cesium.JulianDate.now()
  property.addSample(start, positions[0])

  for (let i = 1; i < positions.length; i++) {
    const segDistance = Cesium.Cartesian3.distance(positions[i - 1], positions[i])
    accumulatedDistance += segDistance
    const time = Cesium.JulianDate.addSeconds(start, accumulatedDistance / speed, new Cesium.JulianDate())
    property.addSample(time, positions[i])
  }

  const stopTime = Cesium.JulianDate.addSeconds(start, totalSeconds, new Cesium.JulianDate())

  // 创建无人机模型（黄色四旋翼图标，与静态图标同款、与尾迹/配送状态同色系）
  const entity = viewer.entities.add({
    id: 'animation-drone-' + droneId,
    position: property,
    billboard: {
      image: createDroneIcon(),
      width: 40,
      height: 40,
      color: Cesium.Color.fromCssColorString('#FFD700'),
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      // 图标始终可见，不被建筑白模遮挡
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    },
    label: {
      text: '🚁 配送中',
      font: 'bold 13px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -30),
      showBackground: true,
      backgroundColor: new Cesium.Color(0, 0, 0, 0.6),
      backgroundPadding: new Cesium.Cartesian2(8, 4)
    },
    availability: new Cesium.TimeIntervalCollection([
      new Cesium.TimeInterval({ start: start, stop: stopTime })
    ])
  })

  // ========== 相机跟随系统 ==========
  // 视角模式: 'follow' 第三人称跟随 | 'fpv' 第一人称 | 'overview' 俯瞰
  let viewMode = 'follow'
  let lastPosition = null
  let currentHeading = 0
  let cameraReady = false // 相机是否已飞入到起点

  // 计算两点之间的 heading（方位角）
  function computeHeading(from, to) {
    const fromCartographic = Cesium.Cartographic.fromCartesian(from)
    const toCartographic = Cesium.Cartographic.fromCartesian(to)
    const lng1 = fromCartographic.longitude
    const lat1 = fromCartographic.latitude
    const lng2 = toCartographic.longitude
    const lat2 = toCartographic.latitude
    const dLng = lng2 - lng1
    const y = Math.sin(dLng) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
    return Math.atan2(y, x)
  }

  // 根据无人机位置和 heading 更新相机
  function updateCamera(dronePos) {
    if (!dronePos) return

    // 计算 heading（朝向飞行方向）
    if (lastPosition) {
      const dist = Cesium.Cartesian3.distance(lastPosition, dronePos)
      if (dist > 0.5) {
        currentHeading = computeHeading(lastPosition, dronePos)
      }
    }
    lastPosition = dronePos.clone()

    const cartographic = Cesium.Cartographic.fromCartesian(dronePos)

    if (viewMode === 'follow') {
      // 第三人称跟随：相机在无人机后上方 30m，朝向飞行方向
      const cameraDistance = 35 // 后方距离
      const cameraHeight = 18   // 上方高度
      const pitch = Cesium.Math.toRadians(-15) // 略微向下看

      // 计算相机位置：无人机位置 + 后方偏移 + 上方偏移
      const headingOpposite = currentHeading + Math.PI
      const eastOffset = Math.sin(headingOpposite) * cameraDistance
      const northOffset = Math.cos(headingOpposite) * cameraDistance

      const cameraCartographic = new Cesium.Cartographic(
        cartographic.longitude + eastOffset / (111320 * Math.cos(cartographic.latitude)),
        cartographic.latitude + northOffset / 111320,
        cartographic.height + cameraHeight
      )
      const cameraPosition = Cesium.Cartographic.toCartesian(cameraCartographic)

      viewer.camera.setView({
        destination: cameraPosition,
        orientation: {
          heading: currentHeading,
          pitch: pitch,
          roll: 0
        }
      })
    } else if (viewMode === 'fpv') {
      // 第一人称：相机在无人机位置，朝向飞行方向
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          Cesium.Math.toDegrees(cartographic.longitude),
          Cesium.Math.toDegrees(cartographic.latitude),
          cartographic.height + 2
        ),
        orientation: {
          heading: currentHeading,
          pitch: Cesium.Math.toRadians(-5),
          roll: 0
        }
      })
    } else if (viewMode === 'overview') {
      // 俯瞰：固定在无人机上方 120m
      viewer.camera.lookAt(dronePos, new Cesium.HeadingPitchRange(
        currentHeading,
        Cesium.Math.toRadians(-55),
        120
      ))
    }
  }

  // 复位全局时钟到真实时间（动画结束后恢复 viewer 时钟的默认行为，避免残留动画时钟）
  function resetClock() {
    const now = Cesium.JulianDate.now()
    viewer.clock.currentTime = now
    viewer.clock.startTime = Cesium.JulianDate.addSeconds(now, -10, new Cesium.JulianDate())
    viewer.clock.stopTime = Cesium.JulianDate.addDays(now, 1, new Cesium.JulianDate())
    viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED
    viewer.clock.multiplier = 1
    viewer.clock.shouldAnimate = true
  }

  const controller = {
    entity,
    totalSeconds,
    start() {
      // 先飞入到起点上方，再开始动画
      const startPos = positions[0]
      const startCartographic = Cesium.Cartographic.fromCartesian(startPos)
      // 计算初始 heading（用前两个点）
      if (positions.length >= 2) {
        currentHeading = computeHeading(positions[0], positions[1])
      }

      // 相机先 flyTo 到起点后上方
      const cameraDistance = 35
      const cameraHeight = 18
      const headingOpposite = currentHeading + Math.PI
      const eastOffset = Math.sin(headingOpposite) * cameraDistance
      const northOffset = Math.cos(headingOpposite) * cameraDistance

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          Cesium.Math.toDegrees(startCartographic.longitude) + eastOffset / (111320 * Math.cos(startCartographic.latitude)),
          Cesium.Math.toDegrees(startCartographic.latitude) + northOffset / 111320,
          startCartographic.height + cameraHeight
        ),
        orientation: {
          heading: currentHeading,
          pitch: Cesium.Math.toRadians(-15),
          roll: 0
        },
        duration: 1.8,
        complete: () => {
          cameraReady = true
          // 飞入完成后开始时钟动画
          viewer.clock.startTime = start.clone()
          viewer.clock.stopTime = stopTime.clone()
          viewer.clock.currentTime = start.clone()
          viewer.clock.clockRange = Cesium.ClockRange.CLAMPED
          viewer.clock.multiplier = 1
          viewer.clock.shouldAnimate = true
        }
      })

      // 即使飞入未完成，也注册 tick 监听（飞入完成后才真正跟随）
      this._removeListener = viewer.clock.onTick.addEventListener(() => {
        if (!cameraReady) return
        if (entity.position) {
          const pos = entity.position.getValue(viewer.clock.currentTime)
          if (pos) updateCamera(pos)
        }
      })
    },
    pause() {
      viewer.clock.shouldAnimate = false
    },
    resume() {
      viewer.clock.shouldAnimate = true
    },
    stop() {
      if (this._removeListener) this._removeListener()
      viewer.entities.remove(entity)
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
      lastPosition = null
      cameraReady = false
      // 复位时钟到真实时间（动画开始会重新设置时钟区间，stop 时恢复默认状态）
      resetClock()
    },
    setViewMode(mode) {
      viewMode = mode
      if (mode === 'overview') {
        // 切换到俯瞰时重置 lookAt
      } else {
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
      }
    },
    getViewMode() {
      return viewMode
    },
    isFinished() {
      return Cesium.JulianDate.greaterThanOrEquals(viewer.clock.currentTime, stopTime)
    }
  }

  return controller
}

/**
 * 格式化时长显示
 */
export function formatDuration(seconds) {
  if (seconds < 60) return seconds + '秒'
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return sec > 0 ? min + '分' + sec + '秒' : min + '分钟'
}

/**
 * 订单状态标签映射
 */
export const ORDER_STATUS_LABELS = {
  pending: '待接单',
  assigned: '已分配',
  delivering: '配送中',
  delivered: '已送达',
  cancelled: '已取消'
}

/**
 * 订单状态颜色映射
 */
export const ORDER_STATUS_COLORS = {
  pending: '#E6A23C',
  assigned: '#409EFF',
  delivering: '#67C23A',
  delivered: '#909399',
  cancelled: '#F56C6C'
}

/**
 * 加载食堂缓冲区（3 层同心圆形参考圈：30s/60s/90s）
 * 圈=时间参考线（直线半径），实际覆盖宿舍由点击时高亮表达
 */
export function loadCanteenBuffer(viewer, coverage, name) {
  const dataSource = new Cesium.CustomDataSource(name)
  // 绿/黄/红（交通灯语义，差异最大）；内层圈后加（在上层，不被外层覆盖）
  const TIER_STYLE = [
    { seconds: 30, color: Cesium.Color.fromCssColorString('#00E676') },
    { seconds: 60, color: Cesium.Color.fromCssColorString('#FFAB00') },
    { seconds: 90, color: Cesium.Color.fromCssColorString('#FF1744') }
  ]
  for (const c of coverage || []) {
    if (c.center_lng == null || c.center_lat == null) continue
    // 倒序：90s 先加（底层），30s 后加（上层），避免内层被外层填充覆盖
    const tiersDesc = [...(c.tiers || [])].sort((a, b) => b.seconds - a.seconds)
    for (const tier of tiersDesc) {
      const style = TIER_STYLE.find(t => t.seconds === tier.seconds) || TIER_STYLE[0]
      const r = tier.radius || 0
      dataSource.entities.add({
        id: `canteen-tier-${c.canteen_id}-${tier.seconds}`,
        position: Cesium.Cartesian3.fromDegrees(c.center_lng, c.center_lat, 0),
        ellipse: {
          semiMajorAxis: r,
          semiMinorAxis: r,
          height: 2, // 贴地（不用 clampToGround，避免 GroundPrimitive 描边渲染问题）
          material: style.color.withAlpha(0.22),
          outline: true,
          outlineColor: style.color.withAlpha(1.0),
          outlineWidth: 3
        },
        properties: {
          isCanteenTier: true,
          canteenId: c.canteen_id,
          seconds: tier.seconds
        }
      })
    }
  }
  viewer.dataSources.add(dataSource)
  return dataSource
}

/**
 * 创建宿舍覆盖高亮（红色标记点 + 名称标签），返回 dataSource 供清除
 */
export function createDormitoryHighlight(viewer, dormList) {
  const dataSource = new Cesium.CustomDataSource('宿舍覆盖高亮')
  for (const d of dormList || []) {
    if (d.lng == null || d.lat == null) continue
    dataSource.entities.add({
      position: Cesium.Cartesian3.fromDegrees(d.lng, d.lat, 30),
      point: {
        pixelSize: 14,
        color: Cesium.Color.RED.withAlpha(0.85),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2
      },
      label: {
        text: d.name,
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.RED,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -20)
      }
    })
  }
  viewer.dataSources.add(dataSource)
  return dataSource
}
