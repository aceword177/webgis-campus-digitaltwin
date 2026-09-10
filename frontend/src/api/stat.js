import request from './request'

/** 获取校园概览统计 */
export const getOverview = () => request.get('/api/stat/overview')
