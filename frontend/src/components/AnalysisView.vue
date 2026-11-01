<template>
  <div class="analysis-view">
    <!-- 顶部工具条 -->
    <div class="toolbar">
      <div class="tb-row">
        <span class="tb-title">二维一张图</span>
        <span class="tb-sub">OpenLayers 10 · ST_AsMVT 矢量瓦片 · 与三维共用同一套 PostGIS 数据</span>
      </div>
      <div class="tb-row">
        <el-radio-group v-model="baseMap" size="small" @change="switchBaseMap">
          <el-radio-button value="road">高德街道</el-radio-button>
          <el-radio-button value="sat">高德影像</el-radio-button>
        </el-radio-group>
        <span class="tb-divider"></span>
        <el-checkbox-group v-model="visibleLayers" size="small" @change="applyLayerVisibility">
          <el-checkbox-button v-for="l in LAYERS" :key="l.table" :value="l.table">{{ l.label }}</el-checkbox-button>
        </el-checkbox-group>
      </div>
    </div>

    <!-- 地图 -->
    <div ref="mapEl" class="ol-map"></div>

    <!-- 左上：交互模式 -->
    <div class="mode-bar">
      <el-radio-group v-model="mode" size="small">
        <el-radio-button value="pick">点选查询</el-radio-button>
        <el-radio-button value="buffer">缓冲区</el-radio-button>
        <el-radio-button value="none">浏览</el-radio-button>
      </el-radio-group>
      <span v-if="mode === 'buffer'" class="radius-box">
        半径
        <el-input-number v-model="radius" :min="20" :max="500" :step="10" size="small" controls-position="right" style="width: 92px" />
        m
      </span>
    </div>

    <!-- 右侧：查询/航线结果 -->
    <aside class="side">
      <div class="card">
        <div class="card-title">
          空间查询
          <span class="tag">{{ mode === 'buffer' ? 'ST_DWithin' : 'ST_Intersects' }}</span>
        </div>
        <template v-if="queryResult">
          <div class="q-line"><b>{{ queryResult.tableLabel }}</b> · {{ queryResult.count }} 个要素</div>
          <div class="q-line dim">{{ queryResult.method }}</div>
          <ul class="q-list">
            <li v-for="(f, i) in queryResult.features.slice(0, 6)" :key="i">
              {{ f.name || '未命名' }}<span v-if="f.height">（{{ f.height }} 层）</span>
            </li>
          </ul>
          <div v-if="queryResult.count > 6" class="q-more">… 其余 {{ queryResult.count - 6 }} 个</div>
        </template>
        <div v-else class="q-empty">在地图上点一下，用 PostGIS 做空间查询</div>
      </div>

      <div class="card" v-if="routeInfo">
        <div class="card-title">
          A* 航线对照
          <span class="tag ok" v-if="routeInfo.avoided">已避让</span>
        </div>
        <div class="kv"><span>直线距离</span><b>{{ fmt(routeInfo.straight) }} m</b></div>
        <div class="kv"><span>规划距离</span><b>{{ fmt(routeInfo.plan) }} m</b></div>
        <div class="kv"><span>绕行增量</span><b class="warn">+{{ fmt(routeInfo.detour) }} m（+{{ Math.round(routeInfo.ratio * 100) }}%）</b></div>
        <div class="kv"><span>途经点 / 预计</span><b>{{ routeInfo.waypoints }} 点 / {{ routeInfo.eta }} s</b></div>
        <div class="kv"><span>直线穿越</span><b class="warn">{{ routeInfo.straightCross ? '是' : '否' }}</b></div>
        <div class="kv"><span>规划路径穿越</span><b class="ok">{{ routeInfo.stillCross ? '是' : '否' }}</b></div>
        <div class="zones" v-if="routeInfo.zones.length">
          绕开的限飞区：{{ routeInfo.zones.join('、') }}
        </div>
        <div class="note">导航网格 15m · pgr_astar · 固定演示起终点（坐标见源码注释）</div>
      </div>

      <div class="card" v-if="clusterInfo">
        <div class="card-title">
          订单点位聚合
          <span class="tag">Cluster</span>
        </div>
        <div class="kv"><span>聚合源</span><b>{{ clusterInfo.buildings }} 栋宿舍楼</b></div>
        <div class="kv"><span>覆盖订单</span><b>{{ clusterInfo.orders }} 单</b></div>
        <div class="kv"><span>当前簇</span><b>{{ clusterInfo.clusters }} 个</b></div>
        <div class="note">点位来自 dormitory 表质心，聚合值 = 订单量</div>
      </div>
    </aside>

    <div class="status-bar" v-if="statusText">{{ statusText }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Map from 'ol/Map.js'
import View from 'ol/View.js'
import TileLayer from 'ol/layer/Tile.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorTileLayer from 'ol/layer/VectorTile.js'
import VectorSource from 'ol/source/Vector.js'
import VectorTileSource from 'ol/source/VectorTile.js'
import Cluster from 'ol/source/Cluster.js'
import XYZ from 'ol/source/XYZ.js'
import MVT from 'ol/format/MVT.js'
import GeoJSON from 'ol/format/GeoJSON.js'
import Feature from 'ol/Feature.js'
import Point from 'ol/geom/Point.js'
import LineString from 'ol/geom/LineString.js'
import Polygon from 'ol/geom/Polygon.js'
import { fromLonLat, toLonLat } from 'ol/proj.js'
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style.js'
import { getGeoJson, pointQuery, bufferQuery } from '@/api/spatial'
import { getNoFlyZones } from '@/api/noFlyZone'
import { planRoute } from '@/api/route'
import { getOrders } from '@/api/order'

/* ---------------- 常量 ---------------- */
const LAYERS = [
  { table: 'teaching_building', label: '教学楼', color: '#3f7fd8' },
  { table: 'dormitory', label: '宿舍楼', color: '#2f9e6f' },
  { table: 'other_buildings', label: '其他建筑', color: '#7a6ad0' },
  { table: 'road', label: '道路', color: '#c9a227' },
  { table: 'playground', label: '运动场地', color: '#3f8f9e' },
]
const ALL_TABLES = ['school', ...LAYERS.map((l) => l.table)]

// 固定演示起终点：4 号教学楼北侧 → 3 号教学楼南侧（直线穿越这两栋楼，互不重叠）
// 换点后作品集/简历里的数字会变，改这里请同步 scripts/portfolio/build-portfolio-html.mjs
const DEMO_ROUTE = {
  start_lng: 114.46651,
  start_lat: 37.9841,
  end_lng: 114.466646,
  end_lat: 37.983,
  altitude: 50,
}
const DEMO_BUFFER = { table: 'dormitory', lng: 114.470542, lat: 37.982518, radius: 180 }

const AMAP = {
  road: (z, x, y) => `https://webrd0${1 + ((x + y) % 4)}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=${x}&y=${y}&z=${z}`,
  sat: (z, x, y) => `https://webst0${1 + ((x + y) % 4)}.is.autonavi.com/appmaptile?style=6&x=${x}&y=${y}&z=${z}`,
}

/* ---------------- 响应式状态 ---------------- */
const mapEl = ref(null)
const baseMap = ref('road')
const mode = ref('pick')
const radius = ref(DEMO_BUFFER.radius)
const visibleLayers = ref(LAYERS.map((l) => l.table))
const queryResult = ref(null)
const routeInfo = ref(null)
const clusterInfo = ref(null)
const statusText = ref('')

let map = null
let baseLayer = null
const mvtLayers = {}
const styleCache = {}
let zoneSource = null
let straightSource = null
let routeSource = null
let bufferSource = null
let clusterSource = null
let clusterLayer = null
let ordersByDorm = {}
let dormNameById = {}

/* ---------------- 样式 ---------------- */

function buildingStyleFactory(color) {
  return (feature) => {
    const h = feature.get('height')
    const key = `${color}-${h || 0}`
    if (!styleCache[key]) {
      styleCache[key] = new Style({
        fill: new Fill({ color: withAlpha(color, h ? 0.55 : 0.38) }),
        stroke: new Stroke({ color: withAlpha(color, 0.95), width: 1 }),
      })
    }
    return styleCache[key]
  }
}

function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

const roadStyle = new Style({ stroke: new Stroke({ color: 'rgba(201, 162, 39, 0.85)', width: 2 }) })
const zoneStyle = new Style({
  stroke: new Stroke({ color: '#ff4d4f', width: 3, lineDash: [4, 3] }),
  fill: new Fill({ color: 'rgba(255, 77, 79, 0.22)' }),
})
const straightStyle = new Style({
  stroke: new Stroke({ color: '#ff6b6b', width: 2.5, lineDash: [10, 8] }),
})
const routeStyle = new Style({ stroke: new Stroke({ color: '#39d98a', width: 4 }) })
const bufferCircleStyle = new Style({
  stroke: new Stroke({ color: '#5aa9ff', width: 2, lineDash: [6, 6] }),
  fill: new Fill({ color: 'rgba(90, 169, 255, 0.10)' }),
})
const bufferHitStyle = new Style({
  fill: new Fill({ color: 'rgba(90, 169, 255, 0.35)' }),
  stroke: new Stroke({ color: '#5aa9ff', width: 2 }),
})

/* ---------------- 初始化 ---------------- */
onMounted(async () => {
  await nextTick()
  const params = new URLSearchParams(location.search)
  const demo = params.get('demo')

  const center = fromLonLat([114.467788, 37.984305])
  baseLayer = new TileLayer({ source: rasterSource('road'), zIndex: 0 })

  zoneSource = new VectorSource()
  straightSource = new VectorSource()
  routeSource = new VectorSource()
  bufferSource = new VectorSource()
  clusterSource = new VectorSource()

  const vectorLayers = ALL_TABLES.map((table) => {
    const meta = LAYERS.find((l) => l.table === table)
    const isLine = table === 'road'
    const layer = new VectorTileLayer({
      source: new VectorTileSource({
        format: new MVT(),
        url: `/tiles/${table}/{z}/{x}/{y}.mvt`,
        maxZoom: 20,
      }),
      style: isLine ? roadStyle : buildingStyleFactory(meta ? meta.color : '#8fa3bf'),
      zIndex: table === 'school' ? 1 : 2,
      declutter: false,
    })
    mvtLayers[table] = layer
    return layer
  })

  map = new Map({
    target: mapEl.value,
    layers: [
      baseLayer,
      ...vectorLayers,
      new VectorLayer({ source: zoneSource, style: zoneStyle, zIndex: 3 }),
      new VectorLayer({ source: bufferSource, style: (f) => (f.get('kind') === 'circle' ? bufferCircleStyle : bufferHitStyle), zIndex: 4 }),
      new VectorLayer({ source: straightSource, style: straightStyle, zIndex: 5 }),
      new VectorLayer({ source: routeSource, style: routeStyle, zIndex: 6 }),
      (clusterLayer = new VectorLayer({
        source: new Cluster({ source: clusterSource, distance: 70 }),
        style: clusterStyle,
        zIndex: 7,
      })),
    ],
    view: new View({ center, zoom: 17.1, minZoom: 13, maxZoom: 19 }),
    controls: [],
  })

  map.on('singleclick', onMapClick)

  // 限飞区 + 聚合点位（都走 GeoJSON 接口，量小；底图与校园边界由 MVT 瓦片负责）
  const [zones, dorm] = await Promise.all([getNoFlyZones(), getGeoJson('dormitory')])
  zoneSource.addFeatures(rowsToFeatures(zones))
  await buildCluster(dorm)

  map.once('rendercomplete', () => {
    statusText.value = ''
    // 截图脚本用这个属性判断"瓦片真的画上去了"，比固定 sleep 可靠
    mapEl.value.setAttribute('data-map-ready', '1')
  })
  statusText.value = '正在加载矢量瓦片…'
  setTimeout(() => { statusText.value = '' }, 2500)

  // 深链演示场景
  if (demo === 'route') await runRouteDemo()
  if (demo === 'buffer') await runBufferDemo()
})

onBeforeUnmount(() => {
  if (map) {
    map.setTarget(null)
    map = null
  }
})

/* ---------------- 数据 → 要素 ---------------- */
function rowsToFeatures(rows) {
  if (!rows) return []
  const fc = { type: 'FeatureCollection', features: rows.map((r) => featureFromRow(r)) }
  return new GeoJSON().readFeatures(fc, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' })
}

function featureFromRow(row) {
  const geom = typeof row.geom === 'string' ? JSON.parse(row.geom) : row.geom
  const props = { ...row }
  delete props.geom
  return { type: 'Feature', geometry: geom, properties: props }
}

async function buildCluster(dormRows) {
  const rows = dormRows || []
  // 订单量按宿舍楼聚合（只用一页数据：500 单）
  try {
    const orders = await getOrders({ page: 1, size: 500 })
    const list = Array.isArray(orders) ? orders : orders?.list || orders?.records || []
    ordersByDorm = list.reduce((acc, o) => {
      acc[o.dormitory_id] = (acc[o.dormitory_id] || 0) + 1
      return acc
    }, {})
  } catch {
    ordersByDorm = {}
  }

  const feats = []
  for (const row of rows) {
    const geom = typeof row.geom === 'string' ? JSON.parse(row.geom) : row.geom
    const c = centroid(geom)
    if (!c) continue
    dormNameById[row.id] = row.name
    feats.push(new Feature({
      geometry: new Point(fromLonLat(c)),
      name: row.name,
      orders: ordersByDorm[row.id] || 0,
    }))
  }
  clusterSource.addFeatures(feats)
  clusterInfo.value = {
    buildings: feats.length,
    orders: Object.values(ordersByDorm).reduce((a, b) => a + b, 0),
    clusters: clusterLayer.getSource().getFeatures().length,
  }
  clusterSource.on('change', () => {
    if (clusterInfo.value) clusterInfo.value.clusters = clusterLayer.getSource().getFeatures().length
  })
}

/** 面要素的顶点均值（校园尺度上足够近似质心，只用于点位聚合的落点） */
function centroid(geom) {
  let ring = null
  if (geom.type === 'Polygon') ring = geom.coordinates[0]
  else if (geom.type === 'MultiPolygon') ring = geom.coordinates[0][0]
  if (!ring || !ring.length) return null
  let sx = 0
  let sy = 0
  for (const p of ring) {
    sx += p[0]
    sy += p[1]
  }
  return [sx / ring.length, sy / ring.length]
}

function clusterStyle(feature) {
  const size = feature.get('features').length
  const orders = feature.get('features').reduce((a, f) => a + (f.get('orders') || 0), 0)
  const r = Math.min(14 + Math.log2(size + 1) * 6, 30)
  return new Style({
    image: new CircleStyle({
      radius: r,
      fill: new Fill({ color: 'rgba(64, 158, 255, 0.85)' }),
      stroke: new Stroke({ color: 'rgba(255,255,255,0.85)', width: 2 }),
    }),
    text: new Text({
      text: String(orders || size),
      fill: new Fill({ color: '#fff' }),
      font: '600 12px "Microsoft YaHei"',
    }),
  })
}

/* ---------------- 交互 ---------------- */
function rasterSource(kind) {
  return new XYZ({
    tileUrlFunction: (tileCoord) => {
      if (!tileCoord) return undefined
      const [z, x, y] = tileCoord
      return AMAP[kind](z, x, y)
    },
    maxZoom: 19,
    crossOrigin: 'anonymous',
  })
}

function switchBaseMap(value) {
  baseLayer.setSource(rasterSource(value === 'sat' ? 'sat' : 'road'))
}

function applyLayerVisibility(active) {
  for (const table of ALL_TABLES) {
    mvtLayers[table]?.setVisible(active.includes(table) || table === 'school')
  }
}

async function onMapClick(evt) {
  if (mode.value === 'none') return
  const [lng, lat] = toLonLat(evt.coordinate)
  if (mode.value === 'pick') {
    await doPointQuery(lng, lat)
  } else {
    await doBufferQuery(LAYERS[0].table, lng, lat, radius.value)
  }
}

async function doPointQuery(lng, lat) {
  // 依次尝试各图层，命中即止（后端 ST_Intersects 单表查询）
  for (const l of LAYERS) {
    try {
      const data = await pointQuery(l.table, lng, lat)
      if (data) {
        queryResult.value = {
          tableLabel: l.label,
          method: `ST_Intersects（点选，${lng.toFixed(6)}, ${lat.toFixed(6)}）`,
          count: 1,
          features: [data],
        }
        return
      }
    } catch {
      /* 该表无命中会抛错或返回空，继续下一层 */
    }
  }
  queryResult.value = { tableLabel: '所有图层', method: `ST_Intersects（${lng.toFixed(6)}, ${lat.toFixed(6)}）`, count: 0, features: [] }
}

async function doBufferQuery(table, lng, lat, r) {
  const rows = await bufferQuery(table, lng, lat, r)
  const label = LAYERS.find((l) => l.table === table)?.label || table
  bufferSource.clear()
  const circle = new Feature({ geometry: circlePolygon(lng, lat, r), kind: 'circle' })
  bufferSource.addFeature(circle)
  const feats = rowsToFeatures(rows).map((f) => {
    f.set('kind', 'hit')
    return f
  })
  for (const f of feats) bufferSource.addFeature(f)
  queryResult.value = {
    tableLabel: label,
    method: `ST_DWithin（${r} m 缓冲，${lng.toFixed(6)}, ${lat.toFixed(6)}）`,
    count: rows.length,
    features: rows,
  }
  return rows
}

/**
 * 米 → 多边形近似（等距圆柱近似 + 1/72 圆周采样）。
 * 只用于画缓冲圈的可视化，不参与任何数值结论；服务端的 ST_DWithin 才是判定口径。
 */
function circlePolygon(lng, lat, r) {
  const pts = []
  const mPerDegLat = 111320
  const mPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180)
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2
    pts.push(fromLonLat([lng + (r * Math.cos(a)) / mPerDegLng, lat + (r * Math.sin(a)) / mPerDegLat]))
  }
  return new Polygon([pts])
}

/* ---------------- 演示场景 ---------------- */
async function runRouteDemo() {
  const res = await planRoute({ ...DEMO_ROUTE })
  const plan = JSON.parse(res.route_geojson)
  routeSource.clear()
  straightSource.clear()
  routeSource.addFeature(
    new Feature({ geometry: new LineString(plan.coordinates.map((c) => fromLonLat(c))) })
  )
  straightSource.addFeature(
    new Feature({
      geometry: new LineString([
        fromLonLat([DEMO_ROUTE.start_lng, DEMO_ROUTE.start_lat]),
        fromLonLat([DEMO_ROUTE.end_lng, DEMO_ROUTE.end_lat]),
      ]),
    })
  )
  routeInfo.value = {
    straight: res.straight_distance_m,
    plan: res.distance_m,
    detour: res.detour_m,
    ratio: res.detour_ratio,
    waypoints: res.waypoints_count,
    eta: res.estimated_seconds,
    avoided: res.avoided_no_fly_zone,
    straightCross: res.straight_line_cross_zone,
    stillCross: res.route_still_cross_zone,
    zones: (res.crossed_zones || []).map((z) => z.name),
  }
  map.getView().fit(
    new LineString([
      fromLonLat([DEMO_ROUTE.start_lng, DEMO_ROUTE.start_lat]),
      fromLonLat([DEMO_ROUTE.end_lng, DEMO_ROUTE.end_lat]),
    ]).getExtent(),
    { padding: [140, 470, 140, 470], maxZoom: 18.4 }
  )
  await new Promise((r) => setTimeout(r, 900))
  mapEl.value.setAttribute('data-shot', 'route-result')
}

async function runBufferDemo() {
  await doBufferQuery(DEMO_BUFFER.table, DEMO_BUFFER.lng, DEMO_BUFFER.lat, DEMO_BUFFER.radius)
  map.getView().animate({ center: fromLonLat([DEMO_BUFFER.lng, DEMO_BUFFER.lat]), zoom: 17.2, duration: 400 })
  await new Promise((r) => setTimeout(r, 700))
  mapEl.value.setAttribute('data-shot', 'buffer-result')
}

const fmt = (v) => (v == null ? '-' : Number(v).toFixed(1))

defineExpose({ map })
</script>

<style scoped>
.analysis-view {
  position: absolute;
  inset: 0;
  background: #0a0e1a;
  overflow: hidden;
}

.ol-map {
  position: absolute;
  inset: 0;
  background: #0b1424;
}

.toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 20;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 10px 14px;
  background: rgba(16, 26, 44, 0.92);
  border: 1px solid rgba(64, 158, 255, 0.28);
  border-radius: 8px;
  color: #dfe8f5;
  flex-wrap: wrap;
}

.tb-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tb-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #fff;
}

.tb-sub {
  font-size: 12px;
  color: rgba(223, 232, 245, 0.6);
}

.tb-divider {
  width: 1px;
  height: 18px;
  background: rgba(255, 255, 255, 0.18);
}

.mode-bar {
  position: absolute;
  top: 92px;
  left: 12px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(16, 26, 44, 0.92);
  border: 1px solid rgba(64, 158, 255, 0.28);
  border-radius: 8px;
  color: #dfe8f5;
  font-size: 12px;
}

.radius-box {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(223, 232, 245, 0.8);
}

.side {
  position: absolute;
  top: 92px;
  right: 12px;
  z-index: 20;
  width: 268px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: calc(100% - 110px);
  overflow-y: auto;
}

.card {
  background: rgba(16, 26, 44, 0.94);
  border: 1px solid rgba(64, 158, 255, 0.28);
  border-radius: 8px;
  padding: 12px;
  color: #dfe8f5;
  font-size: 12px;
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.tag {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(64, 158, 255, 0.2);
  color: #7cc0ff;
}

.tag.ok {
  background: rgba(57, 217, 138, 0.18);
  color: #6fe3ac;
}

.q-line { margin-bottom: 4px; }
.q-line.dim { color: rgba(223, 232, 245, 0.55); margin-bottom: 8px; }
.q-list { margin: 0; padding-left: 16px; color: rgba(223, 232, 245, 0.85); }
.q-list li { margin-bottom: 3px; }
.q-more { margin-top: 6px; color: rgba(223, 232, 245, 0.5); }
.q-empty { color: rgba(223, 232, 245, 0.5); line-height: 1.6; }

.kv {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  color: rgba(223, 232, 245, 0.75);
}

.kv b { color: #fff; font-weight: 600; }
.kv b.warn { color: #ffb454; }
.kv b.ok { color: #6fe3ac; }

.zones {
  margin-top: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255, 107, 107, 0.12);
  color: #ffb1b1;
  line-height: 1.5;
}

.note {
  margin-top: 8px;
  font-size: 11px;
  color: rgba(223, 232, 245, 0.45);
  line-height: 1.5;
}

.status-bar {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  padding: 6px 14px;
  border-radius: 6px;
  background: rgba(16, 26, 44, 0.9);
  color: #9fc4ea;
  font-size: 12px;
}

:deep(.ol-attribution) { display: none; }
</style>
