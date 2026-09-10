import request from './request'

/** 产品列表（支持按餐厅/分类/关键词筛选） */
export const getProducts = (params) => request.get('/api/product/list', { params })

/** 产品详情 */
export const getProductDetail = (id) => request.get(`/api/product/${id}`)

/** 热销产品榜 */
export const getHotProducts = (limit = 10) => request.get('/api/product/hot', { params: { limit } })
