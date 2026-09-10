<template>
  <div class="panel-container">
    <div class="panel-header">
      <span class="panel-title">航线规划</span>
      <el-button type="text" class="close-btn" @click="close">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>

    <div class="panel-body">
      <!-- 起点选择 -->
      <div class="form-section">
        <div class="form-label">
          <span class="label-text">起点（餐厅）</span>
          <el-button
            type="primary"
            size="small"
            plain
            :class="{ active: routePlanMode === 'selectingStart' }"
            @click="startSelectStart"
          >
            <el-icon><Location /></el-icon> 地图拾取
          </el-button>
        </div>
        <el-select v-model="startRestaurantId" placeholder="选择餐厅" style="width: 100%" @change="onRestaurantChange">
          <el-option v-for="r in restaurants" :key="r.id" :label="r.name" :value="r.id" />
        </el-select>
        <div v-if="isValidLng(planStartPoint)" class="selected-point">
          <el-icon><MapLocation /></el-icon>
          {{ planStartPoint.name }} ({{ Number(planStartPoint.lng).toFixed(4) }}, {{ Number(planStartPoint.lat).toFixed(4) }})
        </div>
      </div>

      <!-- 终点选择 -->
      <div class="form-section">
        <div class="form-label">
          <span class="label-text">终点（宿舍楼）</span>
          <el-button
            type="primary"
            size="small"
            plain
            :class="{ active: routePlanMode === 'selectingEnd' }"
            @click="startSelectEnd"
          >
            <el-icon><Location /></el-icon> 地图拾取
          </el-button>
        </div>
        <el-select v-model="endDormitoryId" placeholder="选择宿舍楼" style="width: 100%" @change="onDormitoryChange">
          <el-option v-for="d in dormitories" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
        <div v-if="isValidLng(planEndPoint)" class="selected-point">
          <el-icon><MapLocation /></el-icon>
          {{ planEndPoint.name }} ({{ Number(planEndPoint.lng).toFixed(4) }}, {{ Number(planEndPoint.lat).toFixed(4) }})
        </div>
      </div>

      <!-- 飞行高度 -->
      <div class="form-section">
        <div class="form-label"><span class="label-text">飞行高度</span></div>
        <el-slider v-model="altitude" :min="20" :max="100" :step="10" show-input :show-input-controls="false" />
      </div>

      <!-- 规划按钮 -->
      <el-button
        type="primary"
        style="width: 100%; margin: 12px 0"
        :disabled="!canPlan"
        :loading="planning"
        @click="planRoute"
      >
        <el-icon><Guide /></el-icon> 规划航线
      </el-button>

      <!-- 规划结果 -->
      <div class="result-section" v-if="planResult">
        <div class="result-title">规划结果</div>
        <div class="result-grid">
          <div class="result-item">
            <span class="result-value">{{ planResult.distance_m?.toFixed(1) }}</span>
            <span class="result-label">距离(米)</span>
          </div>
          <div class="result-item">
            <span class="result-value">{{ formatDuration(planResult.estimated_seconds) }}</span>
            <span class="result-label">预计时长</span>
          </div>
          <div class="result-item">
            <span class="result-value" :class="{ warning: planResult.avoided_no_fly_zone }">
              {{ planResult.avoided_no_fly_zone ? '是' : '否' }}
            </span>
            <span class="result-label">避让限飞区</span>
          </div>
          <div class="result-item">
            <span class="result-value">{{ planResult.waypoints_count }}</span>
            <span class="result-label">途径点</span>
          </div>
        </div>
        <el-button size="small" style="width: 100%; margin-top: 8px" @click="showRouteOnMap">
          在地图上显示航线
        </el-button>
      </div>

      <!-- 提示 -->
      <div class="tip" v-if="routePlanMode">
        <el-icon><InfoFilled /></el-icon>
        {{ routePlanMode === 'selectingStart' ? '请在地图上点击选择起点' : '请在地图上点击选择终点' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Close, Location, MapLocation, Guide, InfoFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getRestaurants, getRestaurantDetail } from '@/api/restaurant'
import { getGeoJson } from '@/api/spatial'
import { planRoute as apiPlanRoute } from '@/api/route'
import { useMapStore } from '@/stores/map'
import { formatDuration as fmtDur } from '@/utils/cesium'

const mapStore = useMapStore()
const routePlanMode = computed(() => mapStore.routePlanMode)
const planStartPoint = computed(() => mapStore.planStartPoint)
const planEndPoint = computed(() => mapStore.planEndPoint)

const restaurants = ref([])
const dormitories = ref([])
const startRestaurantId = ref(null)
const endDormitoryId = ref(null)
const altitude = ref(50)
const planning = ref(false)
const planResult = ref(null)

onMounted(async () => {
  await Promise.all([loadRestaurants(), loadDormitories()])
})

async function loadRestaurants() {
  try { restaurants.value = await getRestaurants() } catch (e) { console.error(e) }
}

async function loadDormitories() {
  try { dormitories.value = await getGeoJson('dormitory') } catch (e) { console.error(e) }
}

const canPlan = computed(() => {
  return (planStartPoint.value || startRestaurantId.value) &&
         (planEndPoint.value || endDormitoryId.value)
})

function startSelectStart() {
  mapStore.startRoutePlanning()
}

function startSelectEnd() {
  if (!planStartPoint.value && !startRestaurantId.value) {
    ElMessage.warning('请先选择起点')
    return
  }
  mapStore.routePlanMode = 'selectingEnd'
}

async function onRestaurantChange(id) {
  if (!id) return
  try {
    const detail = await getRestaurantDetail(id)
    if (detail?.center_lng && detail?.center_lat) {
      mapStore.setPlanStart({ lng: detail.center_lng, lat: detail.center_lat, name: detail.name })
    }
  } catch (e) {
    ElMessage.warning('获取餐厅坐标失败: ' + (e.message || '未知错误'))
  }
}

/** 校验坐标是否可显示（防御 toFixed 崩溃） */
function isValidLng(point) {
  if (!point || point.lng == null || point.lat == null) return false
  return !Number.isNaN(Number(point.lng)) && !Number.isNaN(Number(point.lat))
}

function onDormitoryChange(id) {
  const dorm = dormitories.value.find(d => d.id === id)
  if (dorm) {
    try {
      const geo = typeof dorm.geom === 'string' ? JSON.parse(dorm.geom) : dorm.geom
      let lng, lat
      let ring = null
      if (geo.type === 'Polygon') {
        ring = geo.coordinates[0]
      } else if (geo.type === 'MultiPolygon') {
        ring = geo.coordinates[0][0]
      }
      if (ring && ring.length) {
        lng = ring.reduce((s, c) => s + c[0], 0) / ring.length
        lat = ring.reduce((s, c) => s + c[1], 0) / ring.length
        mapStore.setPlanEnd({ lng, lat, name: dorm.name })
      }
    } catch (e) { console.error('解析宿舍楼坐标失败:', e) }
  }
}

async function planRoute() {
  const start = planStartPoint.value
  const end = planEndPoint.value
  if (!start || !end) {
    ElMessage.warning('请选择起点和终点')
    return
  }

  planning.value = true
  try {
    // 注意：后端全局 SNAKE_CASE，请求体字段必须用下划线命名
    planResult.value = await apiPlanRoute({
      start_lng: start.lng,
      start_lat: start.lat,
      end_lng: end.lng,
      end_lat: end.lat,
      altitude: altitude.value
    })
    ElMessage.success('航线规划成功')
    // 自动在地图上显示
    showRouteOnMap()
  } catch (e) {
    ElMessage.error('航线规划失败: ' + (e.message || '未知错误'))
  } finally {
    planning.value = false
  }
}

function showRouteOnMap() {
  if (!planResult.value?.route_geojson) return
  window.dispatchEvent(new CustomEvent('show-planned-route', {
    detail: {
      routeGeojson: planResult.value.route_geojson,
      altitude: altitude.value
    }
  }))
}

function formatDuration(seconds) {
  return fmtDur(seconds)
}

function close() {
  mapStore.closePanel()
  mapStore.cancelRoutePlanning()
}

// 监听地图拾取事件
watch(routePlanMode, (val) => {
  if (!val && planStartPoint.value && !planEndPoint.value) {
    // 起点选完，自动进入终点选择
    // mapStore.routePlanMode = 'selectingEnd'
  }
})
</script>

<style scoped>
.panel-container {
  width: 300px;
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

.form-section { margin-bottom: 14px; }

.form-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.label-text { font-size: 12px; color: rgba(255,255,255,0.7); }

.form-label .el-button {
  padding: 4px 8px;
  font-size: 11px;
}

.form-label .el-button.active {
  background: rgba(64, 158, 255, 0.4);
  border-color: #409EFF;
}

.selected-point {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #67C23A;
  margin-top: 6px;
  padding: 4px 8px;
  background: rgba(103, 194, 58, 0.1);
  border-radius: 4px;
}

.result-section {
  margin-top: 12px;
  padding: 12px;
  background: rgba(255,255,255,0.05);
  border-radius: 6px;
}

.result-title {
  font-size: 12px;
  color: rgba(255,255,255,0.7);
  margin-bottom: 10px;
}

.result-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.result-item {
  text-align: center;
  padding: 6px;
  background: rgba(255,255,255,0.05);
  border-radius: 4px;
}

.result-value {
  display: block;
  font-size: 16px;
  font-weight: 700;
  color: #409EFF;
}

.result-value.warning { color: #E6A23C; }
.result-label { font-size: 10px; color: rgba(255,255,255,0.5); }

.tip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(64, 158, 255, 0.15);
  border-radius: 4px;
  font-size: 12px;
  color: #409EFF;
  margin-top: 12px;
}

:deep(.el-select .el-input__wrapper) {
  background: rgba(255,255,255,0.08);
  box-shadow: none;
}

:deep(.el-select .el-input__inner) {
  color: #fff;
}

:deep(.el-slider__runway) {
  background: rgba(255,255,255,0.15);
}
</style>
