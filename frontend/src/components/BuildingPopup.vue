<template>
  <div v-if="building" class="building-popup" :style="popupStyle">
    <div class="popup-header">
      <span class="popup-title">{{ building.name || building.typeLabel || '要素详情' }}</span>
      <el-button type="text" class="close-btn" @click="close">
        <el-icon><Close /></el-icon>
      </el-button>
    </div>

    <div class="popup-body">
      <!-- 建筑信息 -->
      <template v-if="!building.isDrone">
        <div class="info-row">
          <span class="info-label">类型</span>
          <el-tag :type="buildingTypeTag" size="small">{{ buildingTypeLabel }}</el-tag>
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
        <div class="info-row" v-else-if="building.shape_leng">
          <span class="info-label">周长</span>
          <span class="info-value">{{ (building.shape_leng * 111000).toFixed(2) }} 米</span>
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
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import * as Cesium from 'cesium'
import { Close } from '@element-plus/icons-vue'
import { useMapStore } from '@/stores/map'
import { flyToTarget } from '@/utils/cesium'
import { ElMessage } from 'element-plus'

const mapStore = useMapStore()
const building = computed(() => mapStore.selectedBuilding)

const popupStyle = ref({ left: '0px', top: '0px' })
let postRenderListener = null

// 建筑类型标签
const buildingTypeLabel = computed(() => {
  const map = { teaching: '教学楼', dormitory: '宿舍楼', other: '其他建筑' }
  return map[building.value?.buildingType] || '建筑'
})

const buildingTypeTag = computed(() => {
  // Element Plus 的 type 不接受空串，未命中状态用 info 兜底
  const map = { teaching: 'primary', dormitory: 'warning', other: 'success' }
  return map[building.value?.buildingType] || 'info'
})

// 无人机状态相关
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

function updatePopupPosition() {
  const viewer = mapStore.viewer
  if (!viewer) return

  let pos = building.value?.position
  // 无人机没有 position 属性，用 current_lng/current_lat 计算
  if (!pos && building.value?.isDrone && building.value.current_lng && building.value.current_lat) {
    pos = Cesium.Cartesian3.fromDegrees(building.value.current_lng, building.value.current_lat, 50)
  }
  if (!pos) return

  const canvasPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, pos)
  if (canvasPosition) {
    popupStyle.value = {
      left: canvasPosition.x + 15 + 'px',
      top: canvasPosition.y - 30 + 'px'
    }
  }
}

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

onBeforeUnmount(() => {
  if (postRenderListener) postRenderListener()
})
</script>

<style scoped>
.building-popup {
  position: absolute;
  z-index: 100;
  width: 260px;
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
}

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

.info-value.online {
  color: #67C23A;
}

.info-value.offline {
  color: #F56C6C;
}

.popup-footer {
  display: flex;
  gap: 8px;
  padding: 8px 14px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
