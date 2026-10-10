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

        <!-- 直线 vs 规划路径：量化 A* 为避让限飞区多飞的距离 -->
        <div class="detour-box" :class="detourClass" v-if="hasDetour">
          <div class="detour-head">{{ detourHeadline }}</div>
          <div class="detour-rows">
            <div class="detour-row">
              <span class="k">直线距离</span>
              <span class="v">{{ planResult.straight_distance_m?.toFixed(1) }} m</span>
            </div>
            <div class="detour-row">
              <span class="k">规划距离</span>
              <span class="v strong">{{ planResult.distance_m?.toFixed(1) }} m</span>
            </div>
            <div class="detour-row">
              <span class="k">绕行增量</span>
              <span class="v">{{ formatDetour(planResult.detour_m) }}</span>
            </div>
          </div>
          <div class="detour-foot" v-if="planResult.detour_ratio != null">
            为避让限飞区多飞 {{ (planResult.detour_ratio * 100).toFixed(0) }}%
          </div>
        </div>

        <div class="result-grid">
          <div class="result-item">
            <span class="result-value">{{ planResult.estimated_seconds != null ? formatDuration(planResult.estimated_seconds) : '-' }}</span>
            <span class="result-label">预计时长</span>
          </div>
          <div class="result-item">
            <span class="result-value" :class="avoidanceClass">
              {{ avoidanceText }}
            </span>
            <span class="result-label">限飞区</span>
          </div>
          <div class="result-item">
            <span class="result-value">{{ planResult.waypoints_count }}</span>
            <span class="result-label">途径点</span>
          </div>
          <div class="result-item">
            <span class="result-value">{{ planResult.altitude_m?.toFixed(0) }}</span>
            <span class="result-label">高度(米)</span>
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
import { ref, computed, onMounted } from 'vue'
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
  mapStore.startSelectingEnd()
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
  // 复用与模板一致的坐标有效性判断（isValidLng），避免 NaN/undefined 被 POST 到后端。
  // 下拉选择宿舍楼时走的是"外环坐标平均"路径，几何异常时可能算出 NaN。
  if (!isValidLng(start) || !isValidLng(end)) {
    ElMessage.error('起点或终点坐标无效，请重新选择')
    return
  }

  planning.value = true
  try {
    // 注意：后端全局 SNAKE_CASE，请求体字段必须用下划线命名
    planResult.value = await apiPlanRoute({
      start_lng: Number(start.lng),
      start_lat: Number(start.lat),
      end_lng: Number(end.lng),
      end_lat: Number(end.lat),
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

/** 限飞区避让结果三态文案（真实穿越检测） */
const avoidanceText = computed(() => {
  const r = planResult.value
  if (!r) return '-'
  if (r.route_still_cross_zone) return '路径仍穿越'
  if (r.straight_line_cross_zone) {
    const n = (r.crossed_zones && r.crossed_zones.length) || 0
    return `已绕行 ${n} 个`
  }
  return '未穿越'
})

const avoidanceClass = computed(() => {
  const r = planResult.value
  if (!r) return ''
  if (r.route_still_cross_zone) return 'danger'
  if (r.straight_line_cross_zone) return 'success'
  return ''
})

// ---------- 绕行对比（直线 vs 规划路径） ----------
// 后端 RoutePlanResponse 已返回 straightDistanceM / detourM / detourRatio，
// JSON 经 SNAKE_CASE 策略序列化为 snake_case，故前端读 straight_distance_m。
// 存在该字段说明后端已升级（旧响应无此字段，此时整块不渲染，避免显示 undefined）。
const hasDetour = computed(() => {
  const v = planResult.value?.straight_distance_m
  return typeof v === 'number' && isFinite(v)
})

const detourClass = computed(() => {
  if (planResult.value?.route_still_cross_zone) return 'danger'
  return ''
})

/** 一句话结论：这段航线是否真的绕开了限飞区 */
const detourHeadline = computed(() => {
  const r = planResult.value
  if (!r) return ''
  if (r.route_still_cross_zone) {
    return '⚠ 规划路径仍穿越限飞区'
  }
  if (r.straight_line_cross_zone) {
    const n = (r.crossed_zones && r.crossed_zones.length) || 0
    return `直线穿越 ${n} 个限飞区 → 规划路径已全部绕开`
  }
  return '起终点直线未穿越限飞区，无需绕行'
})

function formatDetour(v) {
  if (typeof v !== 'number' || !isFinite(v)) return '-'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)} m`
}

function close() {
  mapStore.closePanel()
  mapStore.cancelRoutePlanning()
}
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

/* ---------- 绕行对比块：直线 vs 规划路径 ---------- */
.detour-box {
  margin: 8px 0 10px;
  padding: 9px 11px;
  border-radius: 6px;
  background: rgba(64, 158, 255, 0.12);
  border-left: 3px solid #409eff;
}
.detour-box.danger {
  background: rgba(245, 108, 108, 0.14);
  border-left-color: #f56c6c;
}
.detour-head {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  margin-bottom: 7px;
  color: #fff;
}
.detour-box.danger .detour-head { color: #ffb4b4; }
.detour-rows { display: flex; flex-direction: column; gap: 4px; }
.detour-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  line-height: 1.5;
}
.detour-row .k { color: rgba(255, 255, 255, 0.62); }
.detour-row .v { color: #fff; font-variant-numeric: tabular-nums; }
.detour-row .v.strong { font-weight: 600; color: #7ddc8a; }
.detour-box.danger .detour-row .v.strong { color: #ffb4b4; }
.detour-foot {
  margin-top: 7px;
  padding-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.16);
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.82);
}

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
.result-value.success { color: #67C23A; }
.result-value.danger { color: #F56C6C; }
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
