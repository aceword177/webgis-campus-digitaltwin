<template>
  <div class="panel-container">
    <div class="panel-header">
      <span class="panel-title">配送统计</span>
      <el-button type="text" class="refresh-btn" @click="loadData">
        <el-icon><Refresh /></el-icon>
      </el-button>
    </div>
    <div class="panel-body" v-loading="loading">
      <!-- 今日概览 -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-value">{{ stats?.today_orders || '-' }}</div>
          <div class="stat-label">今日订单</div>
        </div>
        <div class="stat-card">
          <div class="stat-value success">{{ stats?.today_delivered || '-' }}</div>
          <div class="stat-label">已送达</div>
        </div>
        <div class="stat-card">
          <div class="stat-value warning">{{ stats?.today_delivering || '-' }}</div>
          <div class="stat-label">配送中</div>
        </div>
        <div class="stat-card">
          <div class="stat-value info">{{ stats?.today_pending || '-' }}</div>
          <div class="stat-label">待接单</div>
        </div>
      </div>

      <!-- 效率指标 -->
      <div class="efficiency-section">
        <div class="section-title">配送效率</div>
        <div class="eff-row">
          <span class="eff-label">完成率</span>
          <div class="eff-bar">
            <div class="eff-fill" :style="{ width: deliveryRate + '%' }"></div>
          </div>
          <span class="eff-value">{{ deliveryRate }}%</span>
        </div>
        <div class="eff-row">
          <span class="eff-label">平均时长</span>
          <span class="eff-value">{{ stats?.avg_delivery_minutes || '-' }} 分钟</span>
        </div>
      </div>

      <!-- 订单状态分布 -->
      <div class="status-section">
        <div class="section-title">订单状态分布</div>
        <div class="status-row" v-for="(count, status) in stats?.order_status_count" :key="status">
          <span class="status-dot" :style="{ background: statusColor(status) }"></span>
          <span class="status-label">{{ statusLabel(status) }}</span>
          <span class="status-count">{{ count }}</span>
        </div>
      </div>

      <!-- 餐厅订单量 -->
      <div class="restaurant-section" v-if="stats?.orders_by_restaurant">
        <div class="section-title">各餐厅订单量</div>
        <div class="rest-row" v-for="(count, name) in stats.orders_by_restaurant" :key="name">
          <span class="rest-name">{{ name }}</span>
          <div class="rest-bar">
            <div class="rest-fill" :style="{ width: restaurantBarWidth(count) + '%' }"></div>
          </div>
          <span class="rest-count">{{ count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { getDeliveryStats } from '@/api/order'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/utils/cesium'

const loading = ref(false)
const stats = ref(null)

onMounted(() => {
  loadData()
})

async function loadData() {
  loading.value = true
  try {
    stats.value = await getDeliveryStats()
  } catch (e) {
    console.error('加载配送统计失败:', e)
  } finally {
    loading.value = false
  }
}

const deliveryRate = computed(() => {
  return stats.value?.delivery_rate ? Math.round(stats.value.delivery_rate * 100) : 0
})

function statusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status
}

function statusColor(status) {
  return ORDER_STATUS_COLORS[status] || '#909399'
}

function restaurantBarWidth(count) {
  const max = Math.max(...Object.values(stats.value?.orders_by_restaurant || {}))
  return max > 0 ? (count / max) * 100 : 0
}
</script>

<style scoped>
.panel-container {
  width: 280px;
  background: rgba(20, 30, 48, 0.95);
  border-radius: 8px;
  overflow: hidden;
  color: #fff;
  max-height: 80vh;
  overflow-y: auto;
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
.refresh-btn { color: #fff; padding: 0; }
.panel-body { padding: 12px; }

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 10px;
  text-align: center;
}

.stat-value { font-size: 20px; font-weight: 700; color: #409EFF; }
.stat-value.success { color: #67C23A; }
.stat-value.warning { color: #E6A23C; }
.stat-value.info { color: #909399; }
.stat-label { font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 2px; }

.section-title {
  font-size: 12px;
  color: rgba(255,255,255,0.7);
  margin: 12px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.eff-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}

.eff-label { color: rgba(255,255,255,0.6); min-width: 50px; }
.eff-bar { flex: 1; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; }
.eff-fill { height: 100%; background: linear-gradient(90deg, #409EFF, #67C23A); border-radius: 4px; transition: width 0.3s; }
.eff-value { min-width: 50px; text-align: right; font-weight: 600; }

.status-row, .rest-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 12px;
}

.status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.status-label { color: rgba(255,255,255,0.7); flex: 1; }
.status-count { font-weight: 600; }

.rest-name { color: rgba(255,255,255,0.7); min-width: 50px; }
.rest-bar { flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; }
.rest-fill { height: 100%; background: #E6A23C; border-radius: 3px; }
.rest-count { min-width: 30px; text-align: right; font-weight: 600; }
</style>
