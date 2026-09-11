<template>
  <div v-if="mapStore.layers.canteenBuffer && mapStore.canteenCoverage" class="cq-panel">
    <!-- 标题栏 -->
    <div class="cq-header">
      <span class="cq-title">食堂缓冲区覆盖范围查询</span>
      <div class="cq-header-actions">
        <span class="cq-show-all" @click.stop="showAll">全部显示</span>
        <span class="cq-hide-all" @click.stop="hideAll">全部关闭</span>
        <el-icon class="cq-arrow" @click.stop="collapsed = !collapsed">
          <ArrowUp v-if="!collapsed" />
          <ArrowDown v-else />
        </el-icon>
      </div>
    </div>

    <!-- 展开内容 -->
    <div v-show="!collapsed" class="cq-body">
      <!-- 默认无选中提示 -->
      <div v-if="!mapStore.canteenActiveSelection" class="cq-hint">
        点击食堂名查看全部缓冲区，或点击档位查看单圈覆盖
      </div>

      <!-- 两个食堂的 3 档覆盖统计 -->
      <div
        v-for="c in mapStore.canteenCoverage"
        :key="c.canteen_id"
        class="cq-canteen"
        :class="{ 'cq-canteen-active': isCanteenActive(c.canteen_id) }"
      >
        <div class="cq-canteen-name" @click="selectCanteen(c)">{{ c.name }}</div>
        <div class="cq-tiers">
          <span
            v-for="t in c.tiers"
            :key="t.seconds"
            class="cq-tier"
            :class="{ 'cq-tier-active': isTierActive(c.canteen_id, t.seconds) }"
            :style="{ color: tierColor(t.seconds) }"
            @click="showTier(c, t)"
          >
            {{ t.seconds }}s:{{ t.dormitories.length }}栋
          </span>
        </div>
      </div>

      <!-- 图例 -->
      <div class="cq-legend">
        <div class="cq-legend-item">
          <span class="cq-dot" style="background:#00E676"></span>30s · 150m
        </div>
        <div class="cq-legend-item">
          <span class="cq-dot" style="background:#FFAB00"></span>60s · 300m
        </div>
        <div class="cq-legend-item">
          <span class="cq-dot" style="background:#FF1744"></span>90s · 450m
        </div>
        <div class="cq-note">圆=时间参考线 · 高亮点=实际覆盖宿舍</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ArrowUp, ArrowDown } from '@element-plus/icons-vue'
import { useMapStore } from '@/stores/map'

const mapStore = useMapStore()
const collapsed = ref(false) // 默认展开

const TIER_COLORS = { 30: '#00E676', 60: '#FFAB00', 90: '#FF1744' }
function tierColor(seconds) {
  return TIER_COLORS[seconds] || '#fff'
}

// 选中状态判断
function isCanteenActive(canteenId) {
  const s = mapStore.canteenActiveSelection
  return s?.type === 'canteen' && s.canteenId === canteenId
}
function isTierActive(canteenId, seconds) {
  const s = mapStore.canteenActiveSelection
  return s?.type === 'tier' && s.canteenId === canteenId && s.seconds === seconds
}

// 点击食堂名：只显示该食堂 3 层圈
function selectCanteen(canteen) {
  mapStore.canteenActiveSelection = { type: 'canteen', canteenId: canteen.canteen_id }
}

// 点击档位：只显示该圈 + 高亮宿舍 + 浮窗
function showTier(canteen, tier) {
  mapStore.canteenActiveSelection = { type: 'tier', canteenId: canteen.canteen_id, seconds: tier.seconds }
  mapStore.coveragePopup = {
    type: 'tier',
    canteenId: canteen.canteen_id,
    canteenName: canteen.name,
    seconds: tier.seconds,
    dormitories: tier.dormitories
  }
}

// 全部显示：恢复 6 圈，清高亮
function showAll() {
  mapStore.canteenActiveSelection = { type: 'all' }
  mapStore.coveragePopup = null
}

// 全部关闭：隐藏所有圈，清高亮
function hideAll() {
  mapStore.canteenActiveSelection = null
  mapStore.coveragePopup = null
}
</script>

<style scoped>
.cq-panel {
  position: absolute;
  left: 16px;
  bottom: 120px;
  z-index: 11;
  width: 260px;
  background: rgba(20, 30, 48, 0.92);
  border-radius: 8px;
  color: #fff;
  font-size: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}
.cq-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.cq-header:hover {
  background: rgba(64, 158, 255, 0.1);
}
.cq-title {
  font-weight: 600;
  font-size: 13px;
}
.cq-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cq-show-all {
  font-size: 11px;
  color: #79bbff;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(64, 158, 255, 0.4);
}
.cq-show-all:hover {
  background: rgba(64, 158, 255, 0.2);
  color: #fff;
}
.cq-hide-all {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.25);
}
.cq-hide-all:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.cq-arrow {
  color: rgba(255, 255, 255, 0.7);
}
.cq-body {
  padding: 8px 12px 10px;
}
.cq-hint {
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  margin-bottom: 8px;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}
.cq-canteen {
  margin-bottom: 8px;
  padding: 4px 6px;
  border-radius: 4px;
  border-left: 3px solid transparent;
}
.cq-canteen-active {
  background: rgba(64, 158, 255, 0.15);
  border-left-color: #409eff;
}
.cq-canteen-name {
  font-weight: 600;
  margin-bottom: 3px;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}
.cq-canteen-name:hover {
  color: #79bbff;
}
.cq-tiers {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.cq-tier {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  transition: background 0.15s;
  border: 1px solid transparent;
}
.cq-tier:hover {
  background: rgba(255, 255, 255, 0.12);
}
.cq-tier-active {
  background: rgba(64, 158, 255, 0.25);
  border-color: rgba(64, 158, 255, 0.6);
}
.cq-legend {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.cq-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.8);
}
.cq-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.cq-note {
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
  font-size: 11px;
}
</style>
