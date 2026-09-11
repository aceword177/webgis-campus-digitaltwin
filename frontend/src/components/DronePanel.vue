<template>
  <div class="panel-container">
    <div class="panel-header">
      <span class="panel-title">无人机管理</span>
      <el-button type="text" class="refresh-btn" @click="loadDrones(false)">
        <el-icon><Refresh /></el-icon>
      </el-button>
    </div>

    <!-- 状态统计 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-num">{{ drones.length }}</span>
        <span class="stat-label">总数</span>
      </div>
      <div class="stat-item">
        <span class="stat-num idle">{{ idleCount }}</span>
        <span class="stat-label">空闲</span>
      </div>
      <div class="stat-item">
        <span class="stat-num delivering">{{ deliveringCount }}</span>
        <span class="stat-label">配送中</span>
      </div>
      <div class="stat-item">
        <span class="stat-num charging">{{ chargingCount }}</span>
        <span class="stat-label">充电</span>
      </div>
    </div>

    <!-- 状态筛选 -->
    <div class="filter-bar">
      <el-radio-group v-model="filterStatus" size="small" @change="loadDrones()">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="idle">空闲</el-radio-button>
        <el-radio-button value="delivering">配送中</el-radio-button>
        <el-radio-button value="charging">充电</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 无人机列表 -->
    <div class="drone-list" v-loading="loading">
      <div
        v-for="drone in drones"
        :key="drone.id"
        class="drone-item"
        @click="locateDrone(drone)"
      >
        <div class="drone-left">
          <div class="drone-icon" :class="drone.status">
            <el-icon :size="18"><Monitor /></el-icon>
          </div>
        </div>
        <div class="drone-info">
          <div class="drone-top">
            <span class="drone-no">{{ drone.drone_no }}</span>
            <el-tag :type="statusTagType(drone.status)" size="small">{{ statusLabel(drone.status) }}</el-tag>
          </div>
          <div class="drone-meta">
            <span class="battery" :class="batteryClass(drone.battery_pct)">
              <el-icon><Lightning /></el-icon> {{ drone.battery_pct }}%
            </span>
            <span class="position">{{ drone.current_lng?.toFixed(4) }}, {{ drone.current_lat?.toFixed(4) }}</span>
          </div>
          <!-- 电量条 -->
          <div class="battery-bar">
            <div class="battery-fill" :class="batteryClass(drone.battery_pct)" :style="{ width: drone.battery_pct + '%' }"></div>
          </div>
        </div>
      </div>
      <div v-if="!loading && drones.length === 0" class="empty-tip">暂无无人机</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Refresh, Monitor, Lightning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getDrones } from '@/api/drone'
import { useMapStore } from '@/stores/map'
import { flyToTarget } from '@/utils/cesium'
import * as Cesium from 'cesium'

const mapStore = useMapStore()

const loading = ref(false)
const drones = ref([])
const filterStatus = ref('')

let refreshTimer = null

onMounted(() => {
  loadDrones()
  // 每 5 秒自动刷新，实时展示电量恢复 / 充电完成变空闲的变化
  refreshTimer = setInterval(() => {
    loadDrones(false)
  }, 5000)
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

async function loadDrones(showLoading = true) {
  if (showLoading) loading.value = true
  try {
    drones.value = await getDrones(filterStatus.value || undefined)
  } catch (e) {
    console.error('加载无人机列表失败:', e)
  } finally {
    loading.value = false
  }
}

const idleCount = computed(() => drones.value.filter(d => d.status === 'idle').length)
const deliveringCount = computed(() => drones.value.filter(d => d.status === 'delivering').length)
const chargingCount = computed(() => drones.value.filter(d => d.status === 'charging').length)

function statusLabel(status) {
  const map = { idle: '空闲', delivering: '配送中', charging: '充电中', maintenance: '维护' }
  return map[status] || status
}

function statusTagType(status) {
  // Element Plus 的 type 不接受空串，未命中状态用 info 兜底
  const map = { idle: 'success', delivering: 'warning', charging: 'info', maintenance: 'danger' }
  return map[status] || 'info'
}

function batteryClass(pct) {
  // 电量不足口径：小于等于 30% 即红色
  if (pct <= 30) return 'low'
  if (pct < 50) return 'medium'
  return 'high'
}

function locateDrone(drone) {
  const viewer = mapStore.viewer
  if (!viewer) return
  // 相机从无人机南侧俯视，无人机位于视野中心
  flyToTarget(viewer, drone.current_lng, drone.current_lat, 150, 1.5)
  ElMessage.info(`已定位到 ${drone.drone_no}`)
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
.refresh-btn { color: #fff; padding: 0; }

.stats-bar {
  display: flex;
  padding: 10px 12px;
  gap: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.stat-item {
  flex: 1;
  text-align: center;
  background: rgba(255,255,255,0.05);
  border-radius: 4px;
  padding: 6px 0;
}

.stat-num { display: block; font-size: 16px; font-weight: 700; color: #409EFF; }
.stat-num.idle { color: #67C23A; }
.stat-num.delivering { color: #E6A23C; }
.stat-num.charging { color: #00BFFF; }
.stat-label { font-size: 10px; color: rgba(255,255,255,0.5); }

.filter-bar { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }

.filter-bar :deep(.el-radio-button__inner) {
  background: transparent;
  border-color: rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.7);
  font-size: 11px;
  padding: 4px 8px;
}

.filter-bar :deep(.el-radio-button.is-active .el-radio-button__inner) {
  background: rgba(64, 158, 255, 0.6);
  border-color: #409EFF;
  color: #fff;
}

.drone-list { flex: 1; overflow-y: auto; padding: 8px; }

.drone-item {
  display: flex;
  gap: 10px;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.drone-item:hover { background: rgba(64, 158, 255, 0.1); }

.drone-icon {
  width: 36px; height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.drone-icon.idle { background: rgba(103, 194, 58, 0.2); color: #67C23A; }
.drone-icon.delivering { background: rgba(230, 162, 60, 0.2); color: #E6A23C; }
.drone-icon.charging { background: rgba(0, 191, 255, 0.2); color: #00BFFF; }
.drone-icon.maintenance { background: rgba(245, 108, 108, 0.2); color: #F56C6C; }

.drone-info { flex: 1; min-width: 0; }

.drone-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.drone-no { font-size: 13px; font-weight: 600; }

.drone-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  margin-bottom: 4px;
}

.battery { display: flex; align-items: center; gap: 2px; }
.battery.high { color: #67C23A; }
.battery.medium { color: #E6A23C; }
.battery.low { color: #F56C6C; }

.position { font-family: monospace; font-size: 10px; }

.battery-bar {
  height: 4px;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  overflow: hidden;
}

.battery-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
.battery-fill.high { background: #67C23A; }
.battery-fill.medium { background: #E6A23C; }
.battery-fill.low { background: #F56C6C; }

.empty-tip {
  text-align: center;
  color: rgba(255,255,255,0.4);
  padding: 30px 0;
  font-size: 12px;
}
</style>
