<template>
  <div v-if="building" ref="popupRef" class="building-popup" :style="popupStyle">
    <div class="popup-header">
      <span class="popup-title">{{ building.name || building.typeLabel || '要素详情' }}</span>
      <el-button type="text" class="close-btn" @click="close">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>

    <div class="popup-body">
      <!-- 建筑信息 -->
      <template v-if="!building.isDrone">
        <!-- 建筑照片：按约定路径加载，缺图时回退到样式化占位图 -->
        <div v-if="photoPath" class="photo-box">
          <img
            v-if="!photoFailed"
            class="building-photo"
            :class="{ loaded: photoLoaded }"
            :src="photoPath"
            :alt="building.name || '建筑照片'"
            @load="photoLoaded = true"
            @error="photoFailed = true"
          />
          <div v-else class="photo-placeholder">
            <el-icon class="placeholder-icon"><Picture /></el-icon>
            <span class="placeholder-text">{{ building.name || '暂无照片' }}</span>
          </div>
          <div v-if="!photoLoaded && !photoFailed" class="photo-loading"></div>
        </div>

        <div class="info-row">
          <span class="info-label">类型</span>
          <el-tag :type="buildingTypeTag" size="small">{{ buildingTypeLabel }}</el-tag>
        </div>

        <!-- 教学楼：所属院系 -->
        <div class="info-row" v-if="building.dept_name">
          <span class="info-label">所属院系</span>
          <span class="info-value highlight">{{ building.dept_name }}</span>
        </div>

        <!-- 宿舍楼：男生/女生宿舍 -->
        <div class="info-row" v-if="building.gender">
          <span class="info-label">宿舍类型</span>
          <el-tag :type="genderTag" size="small" effect="dark">{{ genderLabel }}</el-tag>
        </div>

        <div class="info-row" v-if="building.height">
          <span class="info-label">楼层</span>
          <span class="info-value">{{ building.height }} 层（约 {{ (building.height * 3.5).toFixed(1) }} 米）</span>
        </div>
        <div class="info-row" v-if="building.area_sqm != null">
          <span class="info-label">占地面积</span>
          <span class="info-value">{{ formatAreaSqm(building.area_sqm) }}</span>
        </div>
        <div class="info-row" v-else-if="building.shape_area">
          <span class="info-label">占地面积</span>
          <span class="info-value">{{ formatArea(building.shape_area) }}</span>
        </div>
        <div class="info-row" v-if="building.perimeter_m != null">
          <span class="info-label">周长</span>
          <span class="info-value">{{ building.perimeter_m.toFixed(2) }} 米</span>
        </div>

        <!-- 教学楼：学院简介 -->
        <div v-if="building.description" class="intro-block">
          <div class="intro-title">学院简介</div>
          <p class="intro-text">{{ building.description }}</p>
        </div>

        <div class="info-row">
          <span class="info-label">坐标</span>
          <span class="info-value">{{ building.lng?.toFixed(6) }}, {{ building.lat?.toFixed(6) }}</span>
        </div>
      </template>

      <!-- 无人机信息 -->
      <template v-else>
        <div class="info-row">
          <span class="info-label">无人机</span>
          <el-tag :type="droneStatusTag" size="small">{{ building.drone_no }}</el-tag>
        </div>
        <div class="info-row">
          <span class="info-label">状态</span>
          <span class="info-value" :class="droneStatusClass">{{ droneStatusLabel }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">电量</span>
          <span class="info-value" :class="batteryClass">{{ building.battery_pct }}%</span>
        </div>
        <div class="info-row">
          <span class="info-label">坐标</span>
          <span class="info-value">{{ building.current_lng?.toFixed(6) }}, {{ building.current_lat?.toFixed(6) }}</span>
        </div>
      </template>
    </div>

    <div class="popup-footer" v-if="!building.isDrone">
      <el-button size="small" type="primary" @click="locate">定位</el-button>
      <el-button size="small" @click="queryBuffer">周边查询</el-button>
    </div>
    <div class="popup-footer" v-else>
      <el-button size="small" type="primary" @click="locateDrone">定位无人机</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as Cesium from 'cesium'
import { Close, Picture } from '@element-plus/icons-vue'
import { useMapStore } from '@/stores/map'
import { flyToTarget, worldToWindowCoordinates } from '@/utils/cesium'
import {
  computePopupPosition,
  FALLBACK_WIDTH,
  FALLBACK_HEIGHT
} from '@/utils/layout'
import { ElMessage } from 'element-plus'

const mapStore = useMapStore()
const building = computed(() => mapStore.selectedBuilding)

const popupStyle = ref({ left: '0px', top: '0px' })
let postRenderListener = null

// ========== 照片 ==========
// 约定路径：/public/buildings/{表名}-{id}.jpg（构建后即 /buildings/{表名}-{id}.jpg）
//   · 教学楼 → /buildings/teaching_building-3.jpg
//   · 宿舍楼 → /buildings/dormitory-1.jpg
// 文件不存在时 <img> 触发 error，自动回退到样式化占位图，不会出现裂图。
const photoPath = computed(() => {
  const b = building.value
  // 无人机没有照片
  if (!b || b.isDrone || !b.id) return null
  const table = b.tableName || b._tableName
  if (!table) return null
  return `${import.meta.env.BASE_URL}buildings/${table}-${b.id}.jpg`
})

const photoLoaded = ref(false)
const photoFailed = ref(false)

// 切换建筑时重置照片状态，避免上一栋楼的加载结果串到下一栋
watch(building, () => {
  photoLoaded.value = false
  photoFailed.value = false
})

// ========== 建筑类型 ==========
const buildingTypeLabel = computed(() => {
  const map = { teaching: '教学楼', dormitory: '宿舍楼', other: '其他建筑' }
  return map[building.value?.buildingType] || '建筑'
})

const buildingTypeTag = computed(() => {
  // Element Plus 的 type 不接受空串，未命中状态用 info 兜底
  const map = { teaching: 'primary', dormitory: 'warning', other: 'success' }
  return map[building.value?.buildingType] || 'info'
})

// ========== 宿舍性别（数据库 gender 字段：男 / 女）==========
const genderLabel = computed(() => {
  const g = building.value?.gender
  if (!g) return ''
  // 库里存的是"男"/"女"，补全为"男生宿舍"/"女生宿舍"更符合阅读习惯
  return g.includes('宿') ? g : `${g}生宿舍`
})

const genderTag = computed(() => {
  const g = building.value?.gender || ''
  if (g.startsWith('男')) return 'primary'
  if (g.startsWith('女')) return 'danger'
  return 'info'
})

// ========== 无人机状态 ==========
const droneStatusLabel = computed(() => {
  const map = { idle: '空闲', delivering: '配送中', charging: '充电中', maintenance: '维护' }
  return map[building.value?.status] || building.value?.status
})

const droneStatusTag = computed(() => {
  // Element Plus 的 type 不接受空串，未命中状态用 info 兜底
  const map = { idle: 'success', delivering: 'warning', charging: 'info', maintenance: 'danger' }
  return map[building.value?.status] || 'info'
})

const droneStatusClass = computed(() => {
  const map = { idle: 'online', delivering: 'warning', charging: 'online', maintenance: 'offline' }
  return map[building.value?.status] || ''
})

const batteryClass = computed(() => {
  const pct = building.value?.battery_pct
  if (pct < 20) return 'offline'
  if (pct < 50) return 'warning'
  return 'online'
})

// ========== 弹窗定位 ==========
// 定位算法抽在 @/utils/layout.js（纯函数，可单测边界情况）
/** 浮窗 DOM 引用：用于量取真实宽高，进而做边界钳制 */
const popupRef = ref(null)

// 监听选中建筑，更新弹窗位置
watch(building, (val) => {
  if (val && val.position) {
    updatePopupPosition()
    // 注册 postRender 事件，弹窗跟随地球
    const viewer = mapStore.viewer
    if (viewer && !postRenderListener) {
      postRenderListener = viewer.scene.postRender.addEventListener(updatePopupPosition)
    }
  } else {
    if (postRenderListener) {
      postRenderListener()
      postRenderListener = null
    }
  }
})

/**
 * 计算浮窗位置：默认贴在锚点右上，超出视口时钳制/翻转。
 *
 * 背景：原实现只有固定的 `left = x + 15`、`top = y - 50`，完全没有视口约束。
 * 建筑靠下时浮窗顶部就落在屏幕底部附近，整块内容（简介、照片）被裁到看不见。
 * 相机俯角 45° 时锚点与浮窗顶部相差约 50px，很容易把浮窗推到视口外。
 *
 * 策略（按优先级）：
 *   1. 默认放在锚点右上方
 *   2. 右侧放不下 → 翻到锚点左侧
 *   3. 上方放不下 → 翻到锚点下方
 *   4. 仍越界（浮窗比视口还高）→ 钳到视口内并交给 CSS 内部滚动
 */
function updatePopupPosition() {
  const viewer = mapStore.viewer
  if (!viewer) return

  let pos = building.value?.position
  // 无人机没有 position 属性，用 current_lng/current_lat 计算
  if (!pos && building.value?.isDrone && building.value.current_lng && building.value.current_lat) {
    pos = Cesium.Cartesian3.fromDegrees(building.value.current_lng, building.value.current_lat, 50)
  }
  if (!pos) return

  // 走 utils 里的兼容封装：Cesium ≥1.121 把 wgs84ToWindowCoordinates 改名为
  // worldToWindowCoordinates，直接调旧名会抛 TypeError 让弹窗定位失效
  const canvasPosition = worldToWindowCoordinates(viewer.scene, pos)
  if (!canvasPosition) return

  // 视口以画布尺寸为准（浮窗绝对定位在 .map-container 内，canvas 即容器主体）
  const canvas = viewer.scene.canvas
  const viewW = canvas?.clientWidth || 0
  const viewH = canvas?.clientHeight || 0

  // 优先用实际渲染尺寸；首次渲染前拿不到就退回设计尺寸
  const rect = popupRef.value?.getBoundingClientRect()

  popupStyle.value = computePopupPosition({
    anchorX: canvasPosition.x,
    anchorY: canvasPosition.y,
    width: rect?.width || FALLBACK_WIDTH,
    height: rect?.height || FALLBACK_HEIGHT,
    viewWidth: viewW,
    viewHeight: viewH
  })
}

/**
 * 监听浮窗尺寸变化并重新定位。
 *
 * 必要性：浮窗高度不是常量 —— 照片加载完成、简介文案长短、滚动条出现都会改变它。
 * 只在选中建筑的那一刻定位一次的话，内容变高后仍会溢出视口。
 */
let popupResizeObserver = null

function observePopupResize() {
  if (!popupRef.value || typeof ResizeObserver === 'undefined') return
  popupResizeObserver?.disconnect()
  popupResizeObserver = new ResizeObserver(() => updatePopupPosition())
  popupResizeObserver.observe(popupRef.value)
}

// 浮窗挂载/内容变化后重新定位（v-if 切换、照片加载、简介由 pointQuery 补全等）
watch(
  () => [building.value?.id, building.value?.description, photoLoaded.value, photoFailed.value],
  async () => {
    await nextTick()
    observePopupResize()
    updatePopupPosition()
  }
)

onMounted(async () => {
  await nextTick()
  observePopupResize()
  updatePopupPosition()
})

onBeforeUnmount(() => {
  if (postRenderListener) postRenderListener()
  popupResizeObserver?.disconnect()
  popupResizeObserver = null
})

function close() {
  mapStore.clearSelection()
}

function locate() {
  const viewer = mapStore.viewer
  if (!viewer || !building.value) return
  // 相机从建筑南侧俯视，建筑位于视野中心
  flyToTarget(viewer, building.value.lng, building.value.lat, 150, 1.5)
}

function queryBuffer() {
  ElMessage.info('周边查询功能可在测量工具中使用缓冲区查询')
}

function locateDrone() {
  const viewer = mapStore.viewer
  if (!viewer || !building.value) return
  // 相机从无人机南侧俯视，无人机位于视野中心
  flyToTarget(viewer, building.value.current_lng, building.value.current_lat, 150, 1.5)
}

function formatArea(areaDeg) {
  // 面积从平方度转平方米（近似）——仅当后端未返回 area_sqm 时兜底
  const areaSqm = areaDeg * 111000 * 111000 * 0.7
  if (areaSqm >= 10000) {
    return (areaSqm / 10000).toFixed(2) + ' 公顷'
  }
  return areaSqm.toFixed(2) + ' m²'
}

function formatAreaSqm(areaSqm) {
  // 后端 ST_Area(geom::geography) 真实平方米
  if (areaSqm >= 10000) {
    return (areaSqm / 10000).toFixed(2) + ' 公顷'
  }
  return areaSqm.toFixed(2) + ' m²'
}
</script>

<style scoped>
.building-popup {
  position: absolute;
  z-index: 100;
  width: 288px;
  /* 高度上限：视口高减去上下留白（与 utils/layout.js 的 EDGE_PADDING 一致）。
     定位算法已保证落点在界内，这里是第二道防线 —— 字号/行高变化导致
     浮窗比测量时刻更高时，仍由内部滚动兜住，不会溢出屏幕。
     用 dvh 而非 vh：移动端浏览器地址栏收起时 vh 会偏大。 */
  max-height: calc(100dvh - 20px);
  display: flex;
  flex-direction: column;
  background: rgba(20, 30, 48, 0.95);
  border: 1px solid rgba(64, 158, 255, 0.5);
  border-radius: 8px;
  color: #fff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  pointer-events: auto;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(64, 158, 255, 0.2);
  border-radius: 8px 8px 0 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  /* 配合父级 flex 列布局：头部固定，正文区滚动 */
  flex-shrink: 0;
}

.popup-title {
  font-size: 14px;
  font-weight: 600;
}

.close-btn {
  color: #fff;
  padding: 0;
}

.popup-body {
  padding: 10px 14px;
  /* 内容较多时在浮窗内部滚动，而不是把浮窗撑出屏幕 */
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0; /* flex 子项默认 min-height:auto，不置 0 则内部滚动不生效 */
}

/* ===== 照片 ===== */
.photo-box {
  position: relative;
  width: 100%;
  height: 132px;
  margin-bottom: 10px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.building-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.building-photo.loaded {
  opacity: 1;
}

.photo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.22), rgba(64, 158, 255, 0.06));
}

.placeholder-icon {
  font-size: 26px;
  color: rgba(255, 255, 255, 0.45);
}

.placeholder-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.photo-loading {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg,
    rgba(255, 255, 255, 0.03) 25%,
    rgba(255, 255, 255, 0.10) 37%,
    rgba(255, 255, 255, 0.03) 63%);
  background-size: 400% 100%;
  animation: photo-shimmer 1.2s ease infinite;
}

@keyframes photo-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

/* ===== 信息行 ===== */
.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}

.info-label {
  color: rgba(255, 255, 255, 0.6);
  min-width: 60px;
  flex-shrink: 0;
}

.info-value {
  color: rgba(255, 255, 255, 0.9);
  flex: 1;
}

.info-value.highlight {
  color: #7EC8FF;
  font-weight: 600;
}

.info-value.online {
  color: #67C23A;
}

.info-value.warning {
  color: #E6A23C;
}

.info-value.offline {
  color: #F56C6C;
}

/* ===== 简介 ===== */
.intro-block {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(64, 158, 255, 0.08);
  border-left: 2px solid rgba(64, 158, 255, 0.6);
}

.intro-title {
  font-size: 12px;
  font-weight: 600;
  color: #7EC8FF;
  margin-bottom: 4px;
}

.intro-text {
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.82);
  margin: 0;
  text-align: justify;
}

.popup-footer {
  display: flex;
  gap: 8px;
  padding: 8px 14px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
