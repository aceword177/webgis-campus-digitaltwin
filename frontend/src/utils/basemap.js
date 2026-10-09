/**
 * 底图配置（高德）
 *
 * ─────────────────────────────────────────────────────────────
 * 为什么这里**不需要**任何坐标平移
 * ─────────────────────────────────────────────────────────────
 *
 * 本项目的业务几何来自 PostGIS，`school` 等 shapefile 的 `.prj` 虽写着
 * GCS_WGS_1984，但**实际是按高德（GCJ-02）底图采集的**——
 * 这与国内很多"从高德/腾讯影像上数字化"的数据一样，是常见的标注与实际不符。
 *
 * 因此：
 *   · 底图用高德（影像 / 矢量）→ 数据与底图同属 GCJ-02 → **天然对齐，零转换**；
 *   · 曾一度改用天地图（WGS84）底图 → 立刻出现约 109m 偏移
 *     （本地实测 GCJ-02 相对 WGS84：东 92.6m / 北 56.8m，合成 108.6m）。
 *
 * 结论：**保持高德底图即可，不要引入坐标平移**。
 *
 * ─────────────────────────────────────────────────────────────
 * 图层说明（高德瓦片接口）
 * ─────────────────────────────────────────────────────────────
 *   影像底图：    webst0N.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}
 *   透明注记叠加：webst0N.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=...
 *   矢量底图：    webrd0N.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x=...
 *
 * ⚠️ 两个 style=8 完全不同，容易踩坑（我已踩过）：
 *   · webst + style=8 → 透明注记叠加层（84% 全透明），只能叠在影像上；
 *   · webrd + style=8 → **不透明**的完整矢量底图（0% 透明），
 *     若把它当注记叠在影像上，会把影像整张盖住。
 */

const AMAP_SUBDOMAINS = ['1', '2', '3', '4']
const MAX_LEVEL = 18

/** 可用底图（高德） */
export const BASEMAP_META = {
  'amap-img': {
    key: 'amap-img',
    label: '高德影像',
    crs: 'GCJ-02',
    note: '高德影像底图。与项目数据同属 GCJ-02，天然对齐。'
  },
  'amap-vec': {
    key: 'amap-vec',
    label: '高德矢量',
    crs: 'GCJ-02',
    note: '高德矢量底图（带地名注记）。与项目数据同属 GCJ-02，天然对齐。'
  }
}

/** 默认底图 */
export const DEFAULT_BASEMAP = 'amap-img'

/** 高德影像瓦片模板（jpeg，不透明底图） */
function amapImageUrl() {
  return 'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'
}

/**
 * 高德**透明注记叠加层**（路网 + 地名，PNG 带 alpha）。
 *
 * ⚠️ 务必用 webst 域名 + `style=8`。
 * 实测（z=16 校园处）：
 *   webst style=8 → 84.1% 全透明 / 12.1% 半透明 / 3.8% 不透明  ← 真正的叠加层
 *   webrd style=8 →  0.0% 全透明 /  0.0% 半透明 / 100% 不透明  ← 是完整矢量底图！
 *
 * 曾误把 webrd style=8 当作注记层叠在影像上，导致影像被整张不透明矢量图完全盖住，
 * 表现为"选了高德影像却显示矢量地图"。
 */
function amapAnnotationUrl() {
  return 'https://webst0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'
}

/** 高德矢量**底图**（不透明，自带中文注记） */
function amapVectorUrl() {
  return 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}'
}

/**
 * 创建底图影像提供者。
 *
 * @param {object} Cesium Cesium 命名空间
 * @param {string} kind   'amap-img'（影像，默认） | 'amap-vec'（矢量，含注记）
 * @returns {{provider: object, kind: string, crs: string}}
 */
export function createBaseImageryProvider(Cesium, kind = DEFAULT_BASEMAP) {
  if (kind === 'amap-vec') {
    return {
      provider: new Cesium.UrlTemplateImageryProvider({
        url: amapVectorUrl(),
        subdomains: AMAP_SUBDOMAINS,
        maximumLevel: MAX_LEVEL
      }),
      kind: 'amap-vec',
      crs: 'GCJ-02'
    }
  }
  return {
    provider: new Cesium.UrlTemplateImageryProvider({
      url: amapImageUrl(),
      subdomains: AMAP_SUBDOMAINS,
      maximumLevel: MAX_LEVEL
    }),
    kind: 'amap-img',
    crs: 'GCJ-02'
  }
}

/**
 * 创建叠加用注记图层（仅影像底图需要；矢量底图自带注记）。
 *
 * @returns {object|null} Cesium imagery provider，或 null
 */
export function createAnnotationImageryProvider(Cesium, kind = DEFAULT_BASEMAP) {
  if (kind === 'amap-vec') return null
  return new Cesium.UrlTemplateImageryProvider({
    url: amapAnnotationUrl(),
    subdomains: AMAP_SUBDOMAINS,
    maximumLevel: MAX_LEVEL
  })
}

// ============================================================
// 数据平移工具（当前恒为恒等变换）
// ============================================================
//
// 背景与结论：本项目数据实际按高德（GCJ-02）采集，底图也用高德，
// 两者同基准 → **不需要平移**，下面的 shift 在 enabled=false 时原样返回。
//
// 之所以保留这套工具而不是删掉：万一将来换成真正 WGS84 的数据源
// （或需要对接天地图等 WGS84 底图），只需把 dataShift 置为 enabled 并给出
// dLng/dLat，加载侧代码无需改动即可生效。

/** 平移一个 [lng, lat] 点 */
export function shiftLngLat(lng, lat, shift) {
  if (!shift || !shift.enabled) return [lng, lat]
  return [lng + shift.dLng, lat + shift.dLat]
}

/**
 * 递归平移 GeoJSON 几何中的坐标（支持任意嵌套 Polygon / MultiPolygon / GeometryCollection）。
 * shift.enabled 为 false 时原样返回。
 */
export function shiftGeometry(geometry, shift) {
  if (!geometry || !shift || !shift.enabled) return geometry
  return { ...geometry, coordinates: shiftCoords(geometry.coordinates, shift) }
}

function shiftCoords(coords, shift) {
  if (!Array.isArray(coords)) return coords
  if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    return [coords[0] + shift.dLng, coords[1] + shift.dLat, ...coords.slice(2)]
  }
  return coords.map(c => shiftCoords(c, shift))
}

/**
 * 平移后端返回的要素列表（每个要素带 geom 字段，GeoJSON 字符串或对象）。
 */
export function shiftFeatureList(features, shift) {
  if (!shift || !shift.enabled || !Array.isArray(features)) return features
  return features.map(f => {
    if (!f || f.geom == null) return f
    try {
      const geo = typeof f.geom === 'string' ? JSON.parse(f.geom) : f.geom
      const moved = shiftGeometry(geo, shift)
      return { ...f, geom: typeof f.geom === 'string' ? JSON.stringify(moved) : moved }
    } catch (e) {
      return f
    }
  })
}

/** 平移 {lng, lat} 形状的对象（餐厅/宿舍标记、无人机位置等） */
export function shiftPoint(obj, shift, lngKey = 'lng', latKey = 'lat') {
  if (!obj || !shift || !shift.enabled) return obj
  const lng = obj[lngKey]
  const lat = obj[latKey]
  if (typeof lng !== 'number' || typeof lat !== 'number') return obj
  return { ...obj, [lngKey]: lng + shift.dLng, [latKey]: lat + shift.dLat }
}
