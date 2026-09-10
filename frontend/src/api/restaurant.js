import request from './request'

/** 餐厅列表 */
export const getRestaurants = () => request.get('/api/restaurant/list')

/** 餐厅详情（含建筑坐标） */
export const getRestaurantDetail = (id) => request.get(`/api/restaurant/${id}`)

/** 餐厅的产品列表 */
export const getRestaurantProducts = (id, category) =>
  request.get(`/api/restaurant/${id}/products`, { params: { category } })
