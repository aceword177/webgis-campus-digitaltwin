<template>
  <div class="panel-container">
    <div class="panel-header">
      <span class="panel-title">订单管理</span>
      <el-button type="primary" size="small" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon> 新建
      </el-button>
    </div>

    <!-- 自动派送新订单提示条 -->
    <div v-if="orderNotify" class="order-notify">
      <div class="notify-title">自动派送新订单 {{ orderNotify.orderNo }}</div>
      <div class="notify-detail">
        {{ orderNotify.text }}<span v-if="orderNotify.droneNo"> · {{ orderNotify.droneNo }}</span>
      </div>
    </div>

    <!-- 状态筛选 -->
    <div class="filter-bar">
      <el-radio-group v-model="filterStatus" size="small" @change="loadOrders()">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="pending">待接单</el-radio-button>
        <el-radio-button value="delivering">配送中</el-radio-button>
        <el-radio-button value="delivered">已送达</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 订单列表 -->
    <div class="order-list" v-loading="loading">
      <div
        v-for="order in orders"
        :key="order.id"
        class="order-item"
        :class="{ selected: selectedOrder?.id === order.id }"
        @click="selectOrder(order)"
      >
        <div class="order-top">
          <span class="order-no">{{ order.order_no }}</span>
          <el-tag :type="statusTagType(order.status)" size="small">{{ statusLabel(order.status) }}</el-tag>
        </div>
        <div class="order-info">
          <span class="info-text">{{ order.restaurant_name || '餐厅' }} → {{ order.dormitory_name || '宿舍楼' }}</span>
        </div>
        <div class="order-bottom">
          <span class="order-amount">¥{{ order.amount }}</span>
          <span class="order-time">{{ formatTime(order.create_time) }}</span>
        </div>
      </div>
      <div v-if="!loading && orders.length === 0" class="empty-tip">暂无订单</div>
    </div>

    <!-- 新建订单弹窗 -->
    <el-dialog v-model="showCreateDialog" title="新建订单" width="400px" append-to-body>
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="餐厅">
          <el-select v-model="createForm.restaurantId" placeholder="选择餐厅" style="width: 100%">
            <el-option v-for="r in restaurants" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="宿舍楼">
          <el-select v-model="createForm.dormitoryId" placeholder="选择宿舍楼" style="width: 100%">
            <el-option v-for="d in dormitories" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="商品">
          <el-input v-model="createForm.itemsText" placeholder="如：黄焖鸡米饭x1" />
        </el-form-item>
        <el-form-item label="金额">
          <el-input-number v-model="createForm.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="收货人">
          <el-input v-model="createForm.receiverName" placeholder="收货人姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="submitCreate" :loading="creating">创建订单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getOrders, createOrder } from '@/api/order'
import { getRestaurants } from '@/api/restaurant'
import { getGeoJson } from '@/api/spatial'
import { useMapStore } from '@/stores/map'
import { ORDER_STATUS_LABELS } from '@/utils/cesium'

const mapStore = useMapStore()
const selectedOrder = computed(() => mapStore.selectedOrder)

const loading = ref(false)
const creating = ref(false)
const orders = ref([])
const restaurants = ref([])
const dormitories = ref([])
const filterStatus = ref('')
const showCreateDialog = ref(false)
const createForm = ref({
  restaurantId: null,
  dormitoryId: null,
  itemsText: '',
  amount: 20,
  receiverName: ''
})

let refreshTimer = null
let firstLoad = true
const orderNotify = ref(null)
let notifyTimer = null

onMounted(async () => {
  await Promise.all([loadOrders(), loadRestaurants(), loadDormitories()])
  // 每 10 秒静默刷新，实时同步自动送达/自动补单的状态变化
  refreshTimer = setInterval(() => {
    loadOrders(false)
  }, 10000)
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (notifyTimer) clearTimeout(notifyTimer)
})

async function loadOrders(showLoading = true) {
  if (showLoading) loading.value = true
  try {
    const params = { page: 1, size: 50 }
    if (filterStatus.value) params.status = filterStatus.value
    const fresh = await getOrders(params)
    // 检测新出现的自动派送订单（生成即配送中），给出提示
    if (!firstLoad) {
      const prevIds = new Set(orders.value.map(o => o.id))
      const newAuto = fresh.find(o => !prevIds.has(o.id) && o.status === 'delivering')
      if (newAuto) {
        const drone = mapStore.drones?.find(d => d.id === newAuto.drone_id)
        showOrderNotify(newAuto, drone?.drone_no)
      }
    }
    firstLoad = false
    orders.value = fresh
  } catch (e) {
    console.error('加载订单失败:', e)
  } finally {
    loading.value = false
  }
}

/** 显示"自动派送新订单"提示条，5 秒后自动消失 */
function showOrderNotify(order, droneNo) {
  if (notifyTimer) clearTimeout(notifyTimer)
  orderNotify.value = {
    orderNo: order.order_no,
    text: `${order.restaurant_name || '餐厅'} → ${order.dormitory_name || '宿舍楼'}`,
    droneNo: droneNo || ''
  }
  notifyTimer = setTimeout(() => {
    orderNotify.value = null
  }, 5000)
}

async function loadRestaurants() {
  try {
    restaurants.value = await getRestaurants()
  } catch (e) { console.error(e) }
}

async function loadDormitories() {
  try {
    dormitories.value = await getGeoJson('dormitory')
  } catch (e) { console.error(e) }
}

function selectOrder(order) {
  mapStore.selectOrder(order)
}

function statusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status
}

function statusTagType(status) {
  // el-tag 的 type 合法值为 primary / success / info / warning / danger
  // （已核对 element-plus/es/components/tag/src/tag.mjs 的 values 定义）。
  // 未命中状态一律回退 info，避免传入非法值触发 "Invalid prop: type" 告警。
  const map = { pending: 'warning', assigned: 'primary', delivering: 'success', delivered: 'info', cancelled: 'danger' }
  return map[status] || 'info'
}

function formatTime(time) {
  if (!time) return ''
  return time.substring(5, 16).replace('T', ' ')
}

async function submitCreate() {
  if (!createForm.value.restaurantId || !createForm.value.dormitoryId) {
    ElMessage.warning('请选择餐厅和宿舍楼')
    return
  }
  creating.value = true
  try {
    // 注意：后端全局 SNAKE_CASE，请求体字段必须用下划线命名
    const form = createForm.value
    await createOrder({
      restaurant_id: form.restaurantId,
      dormitory_id: form.dormitoryId,
      items_text: form.itemsText,
      amount: form.amount,
      receiver_name: form.receiverName
    })
    ElMessage.success('订单创建成功')
    showCreateDialog.value = false
    createForm.value = { restaurantId: null, dormitoryId: null, itemsText: '', amount: 20, receiverName: '' }
    await loadOrders()
  } catch (e) {
    ElMessage.error('创建失败: ' + (e.message || '未知错误'))
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.panel-container {
  width: 300px;
  background: rgba(20, 30, 48, 0.95);
  border-radius: 8px;
  overflow: hidden;
  color: #fff;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(64, 158, 255, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-title { font-size: 14px; font-weight: 600; }

.filter-bar {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.order-notify {
  margin: 8px 12px 0;
  padding: 8px 12px;
  background: rgba(64, 158, 255, 0.15);
  border: 1px solid rgba(64, 158, 255, 0.5);
  border-radius: 6px;
  animation: notify-in 0.3s ease;
}

@keyframes notify-in {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.notify-title { font-size: 12px; font-weight: 600; color: #79bbff; margin-bottom: 2px; }
.notify-detail { font-size: 11px; color: rgba(255,255,255,0.7); }

.filter-bar :deep(.el-radio-button__inner) {
  background: transparent;
  border-color: rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.7);
  font-size: 11px;
  padding: 4px 10px;
}

.filter-bar :deep(.el-radio-button.is-active .el-radio-button__inner) {
  background: rgba(64, 158, 255, 0.6);
  border-color: #409EFF;
  color: #fff;
}

.order-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.order-item {
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.order-item:hover {
  background: rgba(64, 158, 255, 0.1);
}

.order-item.selected {
  border-color: #409EFF;
  background: rgba(64, 158, 255, 0.15);
}

.order-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.order-no { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.9); }
.order-info { margin-bottom: 6px; }
.info-text { font-size: 12px; color: rgba(255,255,255,0.6); }

.order-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.order-amount { font-size: 14px; font-weight: 700; color: #E6A23C; }
.order-time { font-size: 11px; color: rgba(255,255,255,0.4); }

.empty-tip {
  text-align: center;
  color: rgba(255,255,255,0.4);
  padding: 30px 0;
  font-size: 12px;
}
</style>
