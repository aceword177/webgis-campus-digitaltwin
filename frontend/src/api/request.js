import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  baseURL: '/',
  timeout: 30000
})

// 请求拦截器
request.interceptors.request.use(
  config => {
    return config
  },
  error => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器 - 统一处理 {code, message, data} 格式
request.interceptors.response.use(
  response => {
    const res = response.data
    // MVT 瓦片等二进制响应直接返回
    if (response.config.responseType === 'arraybuffer') {
      return response
    }
    if (res.code === 200) {
      return res.data
    } else {
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message || '请求失败'))
    }
  },
  error => {
    console.error('响应错误:', error)
    ElMessage.error('网络请求失败，请检查后端服务是否启动')
    return Promise.reject(error)
  }
)

export default request
