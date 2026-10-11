import request from './request'

/** 订单列表（支持状态筛选和分页） */
export const getOrders = (params) => request.get('/api/order/list', { params })

/** 订单详情（含餐厅/宿舍楼/无人机/航线信息） */
export const getOrderDetail = (id) => request.get(`/api/order/${id}`)

/** 创建订单 */
export const createOrder = (data) => request.post('/api/order/create', data)

/** 分配无人机（自动调度，同时规划航线） */
export const assignDrone = (orderId, droneId) =>
  request.post(`/api/order/${orderId}/assign`, null, { params: { droneId } })

/** 确认送达 */
export const confirmDeliver = (orderId) => request.post(`/api/order/${orderId}/deliver`)

/** 取消订单 */
export const cancelOrder = (orderId, reason) =>
  request.post(`/api/order/${orderId}/cancel`, null, { params: { reason } })

/** 配送统计 */
export const getDeliveryStats = () => request.get('/api/order/stats')

/**
 * 自动补单开关状态（默认关闭）。
 * 路径是两段式 —— 后端 @GetMapping("/{id}") 会抢单段的 /auto-order。
 */
export const getAutoOrderStatus = () => request.get('/api/order/auto-order/status')

/** 开关自动补单（全局 SNAKE_CASE，字段名 enabled 不受影响） */
export const setAutoOrderEnabled = (enabled) =>
  request.put('/api/order/auto-order/status', { enabled })
