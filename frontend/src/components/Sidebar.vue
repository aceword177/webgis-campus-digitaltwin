<template>
  <div class="sidebar">
    <div
      v-for="item in menuItems"
      :key="item.name"
      class="sidebar-item"
      :class="{ active: activePanel === item.name }"
      @click="togglePanel(item.name)"
      :title="item.label"
    >
      <el-icon :size="22"><component :is="item.icon" /></el-icon>
      <span class="sidebar-label">{{ item.label }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMapStore } from '@/stores/map'
import {
  Menu, List, Monitor, Guide, DataAnalysis, Location
} from '@element-plus/icons-vue'

const mapStore = useMapStore()
const { activePanel } = storeToRefs(mapStore)

const menuItems = [
  { name: 'layer', label: '图层控制', icon: Menu },
  { name: 'order', label: '订单管理', icon: List },
  { name: 'drone', label: '无人机', icon: Monitor },
  { name: 'route', label: '航线规划', icon: Guide },
  { name: 'stats', label: '配送统计', icon: DataAnalysis }
]

function togglePanel(name) {
  mapStore.togglePanel(name)
}
</script>

<style scoped>
.sidebar {
  width: 60px;
  background: rgba(20, 30, 48, 0.95);
  border-radius: 8px;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

.sidebar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 4px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.6);
  transition: all 0.2s;
  border-left: 3px solid transparent;
}

.sidebar-item:hover {
  color: #fff;
  background: rgba(64, 158, 255, 0.15);
}

.sidebar-item.active {
  color: #409EFF;
  background: rgba(64, 158, 255, 0.2);
  border-left-color: #409EFF;
}

.sidebar-label {
  font-size: 10px;
  margin-top: 4px;
  white-space: nowrap;
}
</style>
