import request from './request'

/** 获取所有图层元数据 */
export const getLayers = () => request.get('/api/spatial/layers')

/** 点选查询 */
export const pointQuery = (table, lng, lat) =>
  request.get('/api/spatial/point-query', { params: { table, lng, lat } })

/** 缓冲区查询 */
export const bufferQuery = (table, lng, lat, radius = 100) =>
  request.get('/api/spatial/buffer', { params: { table, lng, lat, radius } })

/** 按表名获取 GeoJSON */
export const getGeoJson = (table) =>
  request.get(`/api/spatial/geojson/${table}`)

/** 根据 ID 查询要素详情 */
export const getBuildingById = (table, id) =>
  request.get(`/api/spatial/building/${table}/${id}`)

/** 获取校园边界和中心点 */
export const getCampusBounds = () =>
  request.get('/api/spatial/campus-bounds')
