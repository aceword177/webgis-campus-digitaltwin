import request from './request'

/** 限飞区列表（GeoJSON） */
export const getNoFlyZones = (level) => request.get('/api/no-fly-zone/list', { params: { level } })

/** 检测线段是否穿越限飞区 */
export const checkLineCross = (startLng, startLat, endLng, endLat) =>
  request.post('/api/no-fly-zone/check', null, { params: { startLng, startLat, endLng, endLat } })
