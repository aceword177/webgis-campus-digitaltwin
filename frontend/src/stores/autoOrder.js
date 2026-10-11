import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getAutoOrderStatus, setAutoOrderEnabled } from '@/api/order'

/**
 * 自动补单开关（后端默认关闭，状态不持久化，重启后端回到关闭）。
 *
 * 为什么放在 store 而不是组件里：两个地方要共享它 ——
 * 「订单管理」面板里的开关控件，和页面顶部的常驻提示横幅。
 * 刻意不用 window 自定义事件总线：README 已记录它"无类型约束、事件名散落、改名即静默失效"。
 */
export const useAutoOrderStore = defineStore('autoOrder', () => {
  const enabled = ref(false)
  const generated = ref(0)
  const loading = ref(false)
  /** 是否已从后端读到过真实状态（避免刷新瞬间横幅闪一下） */
  const ready = ref(false)

  /** 读取后端当前状态（进页面时调一次；不做轮询，避免无谓请求） */
  async function load() {
    try {
      const data = await getAutoOrderStatus()
      enabled.value = !!data?.enabled
      generated.value = data?.generated || 0
      ready.value = true
    } catch (e) {
      console.error('读取自动补单开关失败:', e)
    }
  }

  /** 切换开关；返回是否成功 */
  async function setEnabled(next) {
    loading.value = true
    try {
      const data = await setAutoOrderEnabled(next)
      enabled.value = !!data?.enabled
      generated.value = data?.generated || 0
      ready.value = true
      return true
    } catch (e) {
      console.error('切换自动补单开关失败:', e)
      return false
    } finally {
      loading.value = false
    }
  }

  return { enabled, generated, loading, ready, load, setEnabled }
})
