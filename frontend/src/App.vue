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
        <nav class="view-nav">
          <button
            v-for="v in VIEWS"
            :key="v.id"
            class="nav-btn"
            :class="{ active: view === v.id }"
            @click="switchView(v.id)"
          >
            {{ v.label }}
          </button>
        </nav>
        <span class="current-time" v-if="!isPresent">{{ currentTime }}</span>
        <el-tag size="small" type="success">MVP v2.0</el-tag>
      </div>
    </header>

    <!-- 主内容区：三维孪生 / 二维一张图 / 运营大屏 共用一个入口，靠 ?view= 切换 -->
    <main class="app-main">
      <template v-if="view === 'twin'">
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
        <!-- 食堂缓冲区分析面板 -->
        <div v-if="activePanel === 'canteen'" class="panel-wrapper">
          <CanteenCoverageQuery />
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

        <!-- 底部工具栏 -->
        <div class="bottom-toolbar">
          <MeasureTool />
        </div>

        <!-- 顶部常驻提示区：自动补单横幅 + 航线规划模式提示（纵向堆叠，互不遮挡） -->
        <div class="top-banners">
          <!--
            自动补单横幅：
            - 演示/录屏模式（?present=1）下整块不渲染 —— 录屏时这块红条最容易被误读成"在刷假数据"；
            - 正常使用也只在开启时出现，8 秒后自动收成一个小胶囊，点一下可展开，不再长期占屏。
          -->
          <template v-if="autoOrder.enabled && !isPresent">
            <div v-if="!bannerCollapsed" class="auto-order-banner">
              <el-icon><WarningFilled /></el-icon>
              <span>自动补单已开启 · 每 30 秒生成一单并写入订单表 · 本次已生成 <b>{{ autoOrder.generated }}</b> 单</span>
              <el-button size="small" plain @click="disableAutoOrder">关闭</el-button>
              <el-button size="small" text @click="collapseBanner">收起</el-button>
            </div>
            <div v-else class="auto-order-pill" @click="bannerCollapsed = false">
              自动补单开启中 · 已生成 {{ autoOrder.generated }} 单
            </div>
          </template>
          <div v-if="routePlanMode" class="plan-mode-banner">
            <el-icon><InfoFilled /></el-icon>
            <span>{{ routePlanMode === 'selectingStart' ? '正在选择起点 - 点击地图或在面板中选择餐厅' : '正在选择终点 - 点击地图或在面板中选择宿舍楼' }}</span>
            <el-button size="small" type="danger" plain @click="cancelPlanning">取消</el-button>
          </div>
        </div>
      </div>

      <!-- 右侧：订单详情 -->
      <aside class="right-area" v-if="selectedOrder">
        <OrderDetail />
      </aside>
      </template>

      <AnalysisView v-else-if="view === 'analysis'" />
      <DeliveryDashboard v-else />
    </main>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { MapLocation, InfoFilled, WarningFilled } from '@element-plus/icons-vue'
import { storeToRefs } from 'pinia'
import { useMapStore } from '@/stores/map'
import { useAutoOrderStore } from '@/stores/autoOrder'
import CesiumViewer from '@/components/CesiumViewer.vue'
import AnalysisView from '@/components/AnalysisView.vue'
import DeliveryDashboard from '@/components/DeliveryDashboard.vue'
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
import CanteenCoverageQuery from '@/components/CanteenCoverageQuery.vue'

const mapStore = useMapStore()
const { activePanel, selectedOrder, routePlanMode } = storeToRefs(mapStore)
// 自动补单开关：与「订单管理」面板共享同一份状态
const autoOrder = useAutoOrderStore()

const VIEWS = [
  { id: 'twin', label: '三维孪生' },
  { id: 'analysis', label: '二维一张图' },
  { id: 'dashboard', label: '运营大屏' },
]
const view = ref(new URLSearchParams(location.search).get('view') || 'twin')

/**
 * 演示/录屏模式：`?present=1`
 *
 * 起因：一次录屏里，上一轮手动打开的自动补单开关还留在后端内存里，
 * 于是画面顶部一直挂着红色横幅「自动补单已开启 · 每 30 秒自动生成订单」，
 * 看起来像在刷假数据。这个模式就是给"要上镜"的场景用的：
 *   1. 进场先把自动补单关掉（后端状态是内存态，不会自己回默认值）；
 *   2. 不渲染自动补单横幅；
 *   3. 隐藏右上角实时时钟（录屏里一直在跳，会让画面像"某人的电脑"而不是产品本身）。
 * 只影响显示与这一个开关，不改任何业务数据。
 */
const isPresent = new URLSearchParams(location.search).get('present') === '1'

const cesiumViewerRef = ref(null)
const currentTime = ref('')
const bannerCollapsed = ref(false)
let timeTimer = null
let readyTimer = null
let bannerTimer = null

/** 横幅出现 8 秒后自动收成小胶囊，避免长期占据画面顶部 */
function scheduleBannerCollapse() {
  if (bannerTimer) clearTimeout(bannerTimer)
  bannerCollapsed.value = false
  bannerTimer = setTimeout(() => { bannerCollapsed.value = true }, 8000)
}

function clearBannerTimer() {
  if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null }
}

function collapseBanner() {
  clearBannerTimer()
  bannerCollapsed.value = true
}

// 开关被打开（无论来自本页还是「订单管理」面板）就开始计时收起
watch(() => autoOrder.enabled, (on) => {
  if (on) scheduleBannerCollapse()
  else { clearBannerTimer(); bannerCollapsed.value = false }
})

/** 切换视图时把状态写进 URL —— 截图/演示就是靠这个深链复现的 */
function switchView(id) {
  if (view.value === id) return
  view.value = id
  const url = new URL(location.href)
  if (id === 'twin') url.searchParams.delete('view')
  else url.searchParams.set('view', id)
  history.replaceState(null, '', url)
}

/**
 * 三维场景的"画好了"信号：等 Mapbox/高德底图瓦片与实体都加载完。
 * 截图脚本据此判断时机，避免拍到空白的球。
 */
function pollReady() {
  const viewer = mapStore.viewer
  if (viewer && !viewer.isDestroyed?.() && viewer.scene?.globe?.tilesLoaded) {
    window.__APP_READY__ = true
    if (readyTimer) { clearInterval(readyTimer); readyTimer = null }
  }
}

onMounted(async () => {
  if (!isPresent) {
    updateTime()
    timeTimer = setInterval(updateTime, 1000)
  }
  // 顶部横幅要知道后端真实状态（默认关闭）。只读一次，不轮询。
  await autoOrder.load()
  // 演示模式：进场就把自动补单关掉。后端开关是内存态，可能残留上一轮的开启状态；
  // 关掉它同时能让「累计订单」这个数字在镜头里保持稳定。
  if (isPresent && autoOrder.enabled) {
    const ok = await autoOrder.setEnabled(false)
    if (ok) console.info('[present] 演示模式：已自动关闭自动补单')
  }
  if (view.value === 'twin') readyTimer = setInterval(pollReady, 400)
})

onBeforeUnmount(() => {
  if (timeTimer) clearInterval(timeTimer)
  if (readyTimer) clearInterval(readyTimer)
  clearBannerTimer()
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

/** 横幅上的「关闭」：一键收手，避免开着忘了让业务数据继续涨 */
async function disableAutoOrder() {
  await autoOrder.setEnabled(false)
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

/* 视图切换：三维孪生 / 二维一张图 / 运营大屏 */
.view-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 6px;
  padding: 3px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
}

.nav-btn {
  padding: 5px 12px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.68);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.nav-btn:hover {
  color: #fff;
  background: rgba(64, 158, 255, 0.18);
}

.nav-btn.active {
  color: #fff;
  background: rgba(64, 158, 255, 0.42);
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

/* 顶部常驻提示区：纵向堆叠，两条横幅互不遮挡 */
.top-banners {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  /* 容器本身不拦截地图点击，只有横幅本体可交互 */
  pointer-events: none;
}

.top-banners > * {
  pointer-events: auto;
}

/* 自动补单已开启横幅（默认关闭时不渲染；演示模式下整块不渲染） */
.auto-order-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: rgba(230, 162, 60, 0.94);
  border: 1px solid rgba(255, 209, 102, 0.5);
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

.auto-order-banner b {
  font-size: 15px;
}

/* 8 秒后收起的胶囊：只保留状态与计数，点一下展开 */
.auto-order-pill {
  padding: 5px 12px;
  border-radius: 14px;
  background: rgba(230, 162, 60, 0.9);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.28);
  user-select: none;
}

.auto-order-pill:hover {
  background: rgba(230, 162, 60, 1);
}

/* 航线规划模式横幅 */
.plan-mode-banner {
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

</style>
