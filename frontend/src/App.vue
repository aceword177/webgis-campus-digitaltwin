<template>
  <div class="app-container">
    <!-- 顶部导航栏 -->
    <header class="app-header">
      <div class="header-left">
        <el-icon class="logo-icon"><MapLocation /></el-icon>
        <h1 class="app-title">校园无人机外卖配送系统</h1>
        <el-tag size="small" type="warning">数字孪生平台</el-tag>
      </div>
      <div class="header-right">
        <span class="current-time">{{ currentTime }}</span>
        <el-tag size="small" type="success">MVP v2.0</el-tag>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="app-main">
      <!-- 左侧：侧边栏 + 展开面板 -->
      <aside class="left-area">
        <Sidebar />
        <!-- 图层面板 -->
        <div v-if="activePanel === 'layer'" class="panel-wrapper">
          <LayerPanel />
        </div>
        <!-- 订单面板 -->
        <div v-if="activePanel === 'order'" class="panel-wrapper">
          <OrderPanel />
        </div>
        <!-- 无人机面板 -->
        <div v-if="activePanel === 'drone'" class="panel-wrapper">
          <DronePanel />
        </div>
        <!-- 航线规划面板 -->
        <div v-if="activePanel === 'route'" class="panel-wrapper">
          <RoutePlanPanel />
        </div>
        <!-- 配送统计面板 -->
        <div v-if="activePanel === 'stats'" class="panel-wrapper">
          <DeliveryStats />
        </div>
      </aside>

      <!-- 中间三维场景 -->
      <div class="map-container">
        <CesiumViewer ref="cesiumViewerRef" />

        <!-- 建筑/无人机弹窗 -->
        <BuildingPopup />

        <!-- 测量信息条（实时汇总） -->
        <div class="measure-info-slot">
          <MeasureInfo />
        </div>

        <!-- 食堂覆盖浮窗 -->
        <CanteenCoveragePanel />

        <!-- 食堂缓冲区图例 -->
        <div v-if="mapStore.layers.canteenBuffer && mapStore.canteenCoverage" class="coverage-legend">
          <div class="cl-item"><span class="cl-dot" style="background:#2ECC40"></span>30s · 150m</div>
          <div class="cl-item"><span class="cl-dot" style="background:#FF851B"></span>60s · 300m</div>
          <div class="cl-item"><span class="cl-dot" style="background:#FF4136"></span>90s · 450m</div>
          <div class="cl-note">圆=时间参考线 · 高亮点=实际覆盖宿舍</div>
        </div>

        <!-- 底部工具栏 -->
        <div class="bottom-toolbar">
          <MeasureTool />
        </div>

        <!-- 航线规划模式提示 -->
        <div v-if="routePlanMode" class="plan-mode-banner">
          <el-icon><InfoFilled /></el-icon>
          <span>{{ routePlanMode === 'selectingStart' ? '正在选择起点 - 点击地图或在面板中选择餐厅' : '正在选择终点 - 点击地图或在面板中选择宿舍楼' }}</span>
          <el-button size="small" type="danger" plain @click="cancelPlanning">取消</el-button>
        </div>
      </div>

      <!-- 右侧：订单详情 -->
      <aside class="right-area" v-if="selectedOrder">
        <OrderDetail />
      </aside>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { MapLocation, InfoFilled } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useMapStore } from '@/stores/map'
import CesiumViewer from '@/components/CesiumViewer.vue'
import Sidebar from '@/components/Sidebar.vue'
import LayerPanel from '@/components/LayerPanel.vue'
import OrderPanel from '@/components/OrderPanel.vue'
import OrderDetail from '@/components/OrderDetail.vue'
import DronePanel from '@/components/DronePanel.vue'
import RoutePlanPanel from '@/components/RoutePlanPanel.vue'
import DeliveryStats from '@/components/DeliveryStats.vue'
import BuildingPopup from '@/components/BuildingPopup.vue'
import MeasureTool from '@/components/MeasureTool.vue'
import MeasureInfo from '@/components/MeasureInfo.vue'
import CanteenCoveragePanel from '@/components/CanteenCoveragePanel.vue'

const mapStore = useMapStore()
const { activePanel, selectedOrder, routePlanMode } = storeToRefs(mapStore)

const cesiumViewerRef = ref(null)
const currentTime = ref('')
let timeTimer = null

onMounted(() => {
  updateTime()
  timeTimer = setInterval(updateTime, 1000)
})

onBeforeUnmount(() => {
  if (timeTimer) clearInterval(timeTimer)
})

function updateTime() {
  const now = new Date()
  currentTime.value = now.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

function cancelPlanning() {
  mapStore.cancelRoutePlanning()
}
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0a0e1a;
}

.app-header {
  height: 50px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  background: linear-gradient(90deg, rgba(20, 30, 48, 0.98), rgba(30, 50, 80, 0.98));
  border-bottom: 1px solid rgba(64, 158, 255, 0.3);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 24px;
  color: #409EFF;
}

.app-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin: 0;
  letter-spacing: 1px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.current-time {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Consolas', monospace;
}

.app-main {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

/* 左侧区域 */
.left-area {
  position: absolute;
  left: 12px;
  top: 12px;
  bottom: 12px;
  z-index: 10;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.panel-wrapper {
  max-height: calc(100vh - 100px);
  overflow: hidden;
}

/* 中间地图 */
.map-container {
  flex: 1;
  position: relative;
}

.bottom-toolbar {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.measure-info-slot {
  position: absolute;
  bottom: 64px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 11;
  pointer-events: none;
}

/* 航线规划模式横幅 */
.plan-mode-banner {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: rgba(230, 162, 60, 0.9);
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

/* 右侧订单详情 */
.right-area {
  position: absolute;
  right: 12px;
  top: 12px;
  bottom: 12px;
  z-index: 10;
}

/* 食堂缓冲区图例 */
.coverage-legend {
  position: absolute;
  left: 16px;
  bottom: 120px;
  z-index: 11;
  background: rgba(20, 30, 48, 0.9);
  border-radius: 8px;
  padding: 8px 12px;
  color: #fff;
  font-size: 12px;
  pointer-events: none;
}
.cl-item { display: flex; align-items: center; gap: 6px; line-height: 1.8; }
.cl-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.cl-note { color: rgba(255,255,255,0.55); margin-top: 4px; font-size: 11px; }
</style>
