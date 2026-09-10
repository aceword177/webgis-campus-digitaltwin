import request from './request'

/** 无人机列表（含实时位置和电量） */
export const getDrones = (status) => request.get('/api/drone/list', { params: { status } })

/** 无人机详情 */
export const getDroneDetail = (id) => request.get(`/api/drone/${id}`)

/** 无人机状态统计 */
export const getDroneStats = () => request.get('/api/drone/stats')

/** 更新无人机位置和电量（模拟实时上报） */
export const updateDronePosition = (id, lng, lat, battery) =>
  request.post(`/api/drone/${id}/update-position`, null, { params: { lng, lat, battery } })
