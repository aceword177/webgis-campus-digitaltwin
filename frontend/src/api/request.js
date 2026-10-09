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

/**
 * 从错误响应中提取服务端返回的业务消息。
 *
 * 背景：后端现在按业务语义返回真实 HTTP 状态码（400/404/500），
 * 不再像以前那样一律返回 HTTP 200 + body 内 code。因此失败分支
 * **必须解析 body**，否则用户只会看到一句无用的
 * "网络请求失败，请检查后端服务是否启动"。
 */
function extractServerMessage(error) {
  const res = error?.response?.data
  if (res && typeof res === 'object' && typeof res.message === 'string' && res.message) {
    return res.message
  }
  if (typeof res === 'string' && res.trim()) {
    return res.trim()
  }
  return null
}

/**
 * 把后端返回的字段级校验明细拼成可读文案。
 * 校验失败时后端的 data 形如 { startLng: "起点经度不能为空" }。
 */
function extractFieldErrors(error) {
  const data = error?.response?.data?.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const entries = Object.entries(data)
    if (entries.length) {
      return entries.map(([k, v]) => `${k}: ${v}`).join('; ')
    }
  }
  return null
}

// 响应拦截器 - 统一处理 {code, message, data} 格式
request.interceptors.response.use(
  response => {
    // MVT 瓦片等二进制响应直接返回
    if (response.config.responseType === 'arraybuffer') {
      return response
    }
    const res = response.data
    // 非标准响应体（例如直接返回字符串/数组）原样返回，避免误判为失败
    if (!res || typeof res !== 'object' || !('code' in res)) {
      return res
    }
    if (res.code === 200) {
      return res.data
    }
    ElMessage.error(res.message || '请求失败')
    return Promise.reject(new Error(res.message || '请求失败'))
  },
  error => {
    // 请求被取消（组件卸载 / 主动 abort）不弹提示
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }

    // 无响应 = 真正的网络层问题（后端未启动、断网、超时）
    if (!error.response) {
      console.error('网络请求失败:', error.message)
      ElMessage.error('网络请求失败，请检查后端服务是否启动')
      return Promise.reject(error)
    }

    const status = error.response.status
    const fieldErrors = extractFieldErrors(error)
    const serverMessage = extractServerMessage(error)
    const message = fieldErrors
      ? `${serverMessage || '请求参数校验失败'}（${fieldErrors}）`
      : (serverMessage || `请求失败（HTTP ${status}）`)

    console.error(`响应错误 HTTP ${status}:`, serverMessage || error.message)
    ElMessage.error(message)

    // 让调用方拿到可读的 message，便于 ElMessage.error('分配失败: ' + e.message) 之类的拼接
    const wrapped = new Error(message)
    wrapped.status = status
    wrapped.code = error.response.data?.code
    return Promise.reject(wrapped)
  }
)

export default request
