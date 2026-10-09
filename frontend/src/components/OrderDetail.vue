<template>
  <div class="panel-container" v-if="orderDetail">
    <div class="panel-header">
      <span class="panel-title">订单详情</span>
      <el-button type="text" class="close-btn" @click="close">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>

    <div class="panel-body">
      <!-- 订单状态 -->
      <div class="status-banner" :class="orderDetail.status">
        <el-tag :type="statusTagType" size="large" effect="dark">{{ statusLabel }}</el-tag>
        <span class="order-no">{{ orderDetail.order_no }}</span>
      </div>

      <!-- 基本信息 -->
      <div class="info-section">
        <div class="info-row">
          <span class="info-label">餐厅</span>
          <span class="info-value">{{ orderDetail.restaurant_name }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">送达宿舍楼</span>
          <span class="info-value">{{ orderDetail.dormitory_name }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">商品</span>
          <span class="info-value">{{ orderDetail.items_text }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">金额</span>
          <span class="info-value amount">¥{{ orderDetail.amount }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">收货人</span>
          <span class="info-value">{{ orderDetail.receiver_name }}</span>
        </div>
        <div class="info-row" v-if="orderDetail.remark">
          <span class="info-label">备注</span>
          <span class="info-value">{{ orderDetail.remark }}</span>
        </div>
      </div>

      <!-- 无人机信息 -->
      <div class="info-section" v-if="orderDetail.drone_no">
        <div class="section-title">配送无人机</div>
        <div class="info-row">
          <span class="info-label">编号</span>
          <span class="info-value">{{ orderDetail.drone_no }}</span>
        </div>
      </div>

      <!-- 航线信息 -->
      <div class="info-section" v-if="orderDetail.route">
        <div class="section-title">航线信息</div>
        <div class="info-row">
          <span class="info-label">航线距离</span>
          <span class="info-value">{{ orderDetail.route.distance_m?.toFixed(1) }} 米</span>
        </div>
        <div class="info-row">
          <span class="info-label">预计时长</span>
          <span class="info-value">{{ formatDuration(orderDetail.route.estimated_seconds) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">航线状态</span>
          <span class="info-value">{{ routeStatusLabel(orderDetail.route.status) }}</span>
        </div>
        <el-button size="small" type="primary" plain @click="showRouteOnMap" style="margin-top: 8px; width: 100%">
          查看航线
        </el-button>
      </div>

      <!-- 时间线 -->
      <div class="info-section">
        <div class="section-title">时间线</div>
        <div class="timeline">
          <div class="timeline-item" v-if="orderDetail.create_time">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <span class="timeline-label">下单时间</span>
              <span class="timeline-time">{{ formatTime(orderDetail.create_time) }}</span>
            </div>
          </div>
          <div class="timeline-item" v-if="orderDetail.assign_time">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <span class="timeline-label">分配时间</span>
              <span class="timeline-time">{{ formatTime(orderDetail.assign_time) }}</span>
            </div>
          </div>
          <div class="timeline-item" v-if="orderDetail.deliver_time">
            <div class="timeline-dot success"></div>
            <div class="timeline-content">
              <span class="timeline-label">送达时间</span>
              <span class="timeline-time">{{ formatTime(orderDetail.deliver_time) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-section">
        <!-- 待接单：分配无人机 -->
        <template v-if="orderDetail.status === 'pending'">
          <el-button type="primary" style="width: 100%" @click="handleAssign" :loading="assigning">
            <el-icon><Promotion /></el-icon> 分配无人机开始配送
          </el-button>
          <el-button style="width: 100%; margin-top: 8px" @click="handleCancel">取消订单</el-button>
        </template>

        <!-- 配送中：飞行动画控制 + 确认送达 -->
        <template v-if="orderDetail.status === 'delivering'">
          <div class="animation-controls" v-if="animationState !== 'idle'">
            <div class="view-mode-switch">
              <span class="view-label">视角</span>
              <el-radio-group v-model="viewMode" size="small" @change="changeViewMode">
                <el-radio-button value="follow">跟随</el-radio-button>
                <el-radio-button value="fpv">第一人称</el-radio-button>
                <el-radio-button value="overview">俯瞰</el-radio-button>
              </el-radio-group>
            </div>
            <div class="anim-buttons">
              <el-button size="small" @click="toggleAnimation">
                <el-icon><component :is="animationState === 'flying' ? VideoPause : VideoPlay" /></el-icon>
                {{ animationState === 'flying' ? '暂停' : '继续' }}
              </el-button>
              <el-button size="small" type="danger" @click="stopAnimation">停止</el-button>
            </div>
          </div>
          <el-button v-else type="warning" style="width: 100%" @click="startFlightAnimation">
            <el-icon><VideoPlay /></el-icon> 播放飞行动画
          </el-button>
          <el-button type="success" style="width: 100%; margin-top: 8px" @click="handleDeliver" :loading="delivering">
            <el-icon><CircleCheck /></el-icon> 确认送达
          </el-button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { Close, Promotion, CircleCheck, VideoPlay, VideoPause } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getOrderDetail, assignDrone, confirmDeliver, cancelOrder } from '@/api/order'
import { useMapStore } from '@/stores/map'
import { ORDER_STATUS_LABELS, formatDuration as fmtDur } from '@/utils/cesium'

const mapStore = useMapStore()
const selectedOrder = computed(() => mapStore.selectedOrder)
const animationState = computed(() => mapStore.animationState)
const viewMode = ref('follow')

const orderDetail = ref(null)
const assigning = ref(false)
const delivering = ref(false)
let detailRefreshTimer = null

watch(selectedOrder, (val) => {
  if (val) loadDetail(val.id)
}, { immediate: true })

async function loadDetail(id) {
  try {
    orderDetail.value = await getOrderDetail(id)
    // 配送中的订单每 10 秒自动刷新，实时同步"自动送达"状态变化
    startDetailRefreshIfNeeded()
  } catch (e) {
    console.error('加载订单详情失败:', e)
  }
}

function startDetailRefreshIfNeeded() {
  stopDetailRefresh()
  if (orderDetail.value?.status === 'delivering') {
    detailRefreshTimer = setInterval(async () => {
      try {
        const detail = await getOrderDetail(orderDetail.value.id)
        orderDetail.value = detail
        // 已送达/已取消后停止自动刷新
        if (detail.status !== 'delivering') stopDetailRefresh()
      } catch (e) {
        console.warn('自动刷新订单详情失败:', e)
      }
    }, 10000)
  }
}

function stopDetailRefresh() {
  if (detailRefreshTimer) {
    clearInterval(detailRefreshTimer)
    detailRefreshTimer = null
  }
}

onBeforeUnmount(() => {
  stopDetailRefresh()
})

const statusLabel = computed(() => ORDER_STATUS_LABELS[orderDetail.value?.status] || '')
const statusTagType = computed(() => {
  // Element Plus 的 type 不接受空串，未命中状态用 info 兜底
  const map = { pending: 'warning', assigned: 'primary', delivering: 'success', delivered: 'info', cancelled: 'danger' }
  return map[orderDetail.value?.status] || 'info'
})

function routeStatusLabel(status) {
  const map = { planned: '已规划', flying: '飞行中', completed: '已完成' }
  return map[status] || status
}

function formatTime(time) {
  if (!time) return ''
  return time.substring(5, 16).replace('T', ' ')
}

function formatDuration(seconds) {
  return fmtDur(seconds)
}

function close() {
  stopDetailRefresh()
  mapStore.clearSelectedOrder()
  orderDetail.value = null
}

async function handleAssign() {
  assigning.value = true
  try {
    await assignDrone(orderDetail.value.id)
    ElMessage.success('无人机分配成功，航线已规划')
    await loadDetail(orderDetail.value.id)
    // 触发事件通知 CesiumViewer 加载航线
    window.dispatchEvent(new CustomEvent('order-assigned', { detail: { orderId: orderDetail.value.id } }))
  } catch (e) {
    ElMessage.error('分配失败: ' + (e.message || '未知错误'))
  } finally {
    assigning.value = false
  }
}

async function handleDeliver() {
  try {
    await ElMessageBox.confirm('确认订单已送达？', '提示', { type: 'info' })
  } catch { return }

  delivering.value = true
  try {
    await confirmDeliver(orderDetail.value.id)
    ElMessage.success('订单已送达')
    mapStore.stopAnimation()
    await loadDetail(orderDetail.value.id)
    window.dispatchEvent(new CustomEvent('order-delivered', { detail: { orderId: orderDetail.value.id } }))
  } catch (e) {
    const msg = e.message || '操作失败'
    // 无人机未到达收货地点：弹窗说明，不改变订单状态
    if (msg.includes('未到达收货地点')) {
      ElMessageBox.alert(msg, '无法确认送达', { type: 'warning', confirmButtonText: '知道了' })
    } else {
      ElMessage.error('操作失败: ' + msg)
    }
  } finally {
    delivering.value = false
  }
}

async function handleCancel() {
  try {
    await ElMessageBox.confirm('确定取消该订单？', '提示', { type: 'warning' })
  } catch { return }

  try {
    await cancelOrder(orderDetail.value.id, '用户取消')
    ElMessage.success('订单已取消')
    await loadDetail(orderDetail.value.id)
  } catch (e) {
    ElMessage.error('取消失败')
  }
}

function showRouteOnMap() {
  window.dispatchEvent(new CustomEvent('show-route', { detail: { orderId: orderDetail.value.id } }))
  ElMessage.info('航线已在地图上显示')
}

function startFlightAnimation() {
  if (!orderDetail.value.route?.route_geojson) {
    ElMessage.warning('航线数据不存在')
    return
  }
  mapStore.startAnimation(orderDetail.value.id)
  window.dispatchEvent(new CustomEvent('start-drone-animation', {
    detail: {
      orderId: orderDetail.value.id,
      routeGeojson: orderDetail.value.route.route_geojson,
      droneId: orderDetail.value.drone_id,
      // 飞行高度 = 建筑高 + 30m（后端按订单起终点建筑动态计算）
      altitude: orderDetail.value.route.altitude_m || 50
    }
  }))
}

function toggleAnimation() {
  if (animationState.value === 'flying') {
    mapStore.pauseAnimation()
    window.dispatchEvent(new CustomEvent('pause-drone-animation'))
  } else {
    mapStore.resumeAnimation()
    window.dispatchEvent(new CustomEvent('resume-drone-animation'))
  }
}

function stopAnimation() {
  mapStore.stopAnimation()
  window.dispatchEvent(new CustomEvent('stop-drone-animation'))
  viewMode.value = 'follow'
}

function changeViewMode(mode) {
  window.dispatchEvent(new CustomEvent('change-drone-view', { detail: { mode } }))
}
</script>

<style scoped>
.panel-container {
  width: 320px;
  background: rgba(20, 30, 48, 0.95);
  border-radius: 8px;
  overflow: hidden;
  color: #fff;
  max-height: 85vh;
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
.close-btn { color: #fff; padding: 0; }
.panel-body { flex: 1; overflow-y: auto; padding: 12px; }

.status-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
  margin-bottom: 12px;
}

.status-banner .order-no { font-size: 12px; color: rgba(255,255,255,0.6); }

.section-title {
  font-size: 12px;
  color: rgba(255,255,255,0.7);
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.info-section { margin-bottom: 14px; }

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;
}

.info-label { color: rgba(255,255,255,0.5); }
.info-value { color: rgba(255,255,255,0.9); text-align: right; max-width: 60%; }
.info-value.amount { color: #E6A23C; font-weight: 700; font-size: 14px; }

.timeline { padding-left: 8px; }
.timeline-item {
  display: flex;
  gap: 10px;
  padding: 4px 0;
  position: relative;
}

.timeline-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #409EFF;
  margin-top: 5px;
  flex-shrink: 0;
}

.timeline-dot.success { background: #67C23A; }

.timeline-content {
  display: flex;
  justify-content: space-between;
  flex: 1;
  font-size: 12px;
}

.timeline-label { color: rgba(255,255,255,0.6); }
.timeline-time { color: rgba(255,255,255,0.8); font-family: monospace; }

.action-section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.1);
}

.animation-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.view-mode-switch {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-label {
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  flex-shrink: 0;
}

.view-mode-switch :deep(.el-radio-group) {
  flex: 1;
}

.view-mode-switch :deep(.el-radio-button__inner) {
  padding: 5px 10px;
  font-size: 12px;
}

.anim-buttons {
  display: flex;
  gap: 8px;
}

.anim-buttons .el-button { flex: 1; }
</style>
