import request from './request'

/** 规划航线（核心算法：pgr_astar 最短路径 + 限飞区避让） */
export const planRoute = (data) => request.post('/api/route/plan', data)

/** 航线详情 */
export const getRouteDetail = (id) => request.get(`/api/route/${id}`)

/** 根据订单ID查询航线 */
export const getRouteByOrderId = (orderId) => request.get(`/api/route/order/${orderId}`)

/** 当前飞行中的航线列表 */
export const getActiveRoutes = () => request.get('/api/route/active')
