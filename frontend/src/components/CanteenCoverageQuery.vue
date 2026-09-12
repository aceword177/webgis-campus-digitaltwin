<template>
  <div class="cq-panel">
    <!-- 标题栏 -->
    <div class="cq-header">
      <span class="cq-title">食堂缓冲区分析</span>
      <div class="cq-header-actions">
        <span class="cq-btn cq-show-all" @click.stop="showAll">全部显示</span>
        <span class="cq-btn cq-hide-all" @click.stop="hideAll">全部关闭</span>
      </div>
    </div>

    <!-- 内容区（可滚动） -->
    <div class="cq-body">
      <!-- 未开启缓冲区图层提示 -->
      <div v-if="!mapStore.layers.canteenBuffer" class="cq-hint cq-hint-warn">
        请先在「图层控制 → 配送标记」中开启「食堂缓冲区」图层
      </div>

      <template v-else>
        <!-- 覆盖数据未加载 -->
        <div v-if="!mapStore.canteenCoverage" class="cq-hint">
          覆盖数据加载中...
        </div>

        <template v-else>
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
                {{ t.seconds }}s · {{ t.dormitories.length }}栋
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
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import { useMapStore } from '@/stores/map'

const mapStore = useMapStore()

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
  width: 260px;
  background: rgba(20, 30, 48, 0.92);
  border-radius: 8px;
  color: #fff;
  font-size: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  /* 与 LayerPanel / .panel-wrapper 高度一致，内容超高时面板内部滚动 */
  max-height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
}

/* 标题栏 */
.cq-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(64, 158, 255, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}
.cq-title {
  font-weight: 600;
  font-size: 13px;
}
.cq-header-actions {
  display: flex;
  gap: 6px;
}
.cq-btn {
  font-size: 11px;
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 4px;
  transition: background 0.15s;
  white-space: nowrap;
}
.cq-show-all {
  color: #79bbff;
  border: 1px solid rgba(64, 158, 255, 0.4);
}
.cq-show-all:hover {
  background: rgba(64, 158, 255, 0.2);
  color: #fff;
}
.cq-hide-all {
  color: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.25);
}
.cq-hide-all:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

/* 内容区 */
.cq-body {
  padding: 10px 12px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* 提示 */
.cq-hint {
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  margin-bottom: 10px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  line-height: 1.6;
}
.cq-hint-warn {
  color: #FFAB00;
  background: rgba(255, 171, 0, 0.08);
  border: 1px solid rgba(255, 171, 0, 0.2);
}

/* 食堂条目 */
.cq-canteen {
  margin-bottom: 10px;
  padding: 6px 8px;
  border-radius: 4px;
  border-left: 3px solid transparent;
}
.cq-canteen-active {
  background: rgba(64, 158, 255, 0.15);
  border-left-color: #409eff;
}
.cq-canteen-name {
  font-weight: 600;
  margin-bottom: 5px;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  font-size: 13px;
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
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 12px;
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

/* 图例 */
.cq-legend {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.cq-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
}
.cq-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.cq-note {
  color: rgba(255, 255, 255, 0.5);
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.5;
}
</style>
