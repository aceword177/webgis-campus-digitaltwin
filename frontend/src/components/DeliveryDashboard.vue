<template>
  <div class="dashboard" :data-shot="ready ? 'dashboard-ready' : null">
    <header class="dash-head">
      <div class="dh-left">
        <h2>配送运营大屏</h2>
        <span class="dh-sub">ECharts · 指标全部取自 PostGIS 业务表（订单由模拟调度生成，无硬编码）</span>
      </div>
      <div class="dh-right">
        <span class="dh-time">{{ now }}</span>
      </div>
    </header>

    <div class="kpi-row">
      <div class="kpi" v-for="k in kpis" :key="k.label">
        <span class="kpi-n" :style="{ color: k.color }">{{ k.value }}</span>
        <span class="kpi-l">{{ k.label }}</span>
        <span class="kpi-h" v-if="k.hint">{{ k.hint }}</span>
      </div>
    </div>

    <div class="grid">
      <div class="panel">
        <div class="panel-title">订单状态分布（累计）</div>
        <div ref="pieEl" class="chart"></div>
      </div>
      <div class="panel">
        <div class="panel-title">各餐厅订单量</div>
        <div ref="restEl" class="chart"></div>
      </div>
      <div class="panel">
        <div class="panel-title">无人机机队状态</div>
        <div ref="droneEl" class="chart"></div>
      </div>
      <div class="panel">
        <div class="panel-title">A* 航线：直线 vs 规划</div>
        <div ref="routeEl" class="chart"></div>
      </div>
      <div class="panel wide">
        <div class="panel-title">空间数据资产（自主矢量化生产）</div>
        <div ref="layerEl" class="chart tall"></div>
      </div>
    </div>

    <div class="dash-foot" v-if="err">{{ err }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import { getDeliveryStats } from '@/api/order'
import { getDroneStats } from '@/api/drone'
import { getOverview } from '@/api/stat'
import { getLayers } from '@/api/spatial'
import { planRoute } from '@/api/route'

/* 与 AnalysisView 的演示起终点保持一致：换点请两处同改 */
const DEMO_ROUTE = {
  start_lng: 114.46651,
  start_lat: 37.9841,
  end_lng: 114.466646,
  end_lat: 37.983,
  altitude: 50,
}

const pieEl = ref(null)
const restEl = ref(null)
const droneEl = ref(null)
const routeEl = ref(null)
const layerEl = ref(null)
const ready = ref(false)
const err = ref('')
const now = ref(new Date().toLocaleString('zh-CN', { hour12: false }))
const stats = ref(null)
const drone = ref(null)
const overview = ref(null)

const chartColor = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#7a6ad0', '#39d98a', '#5aa9ff']
const axisStyle = {
  axisLine: { lineStyle: { color: 'rgba(255,255,255,0.18)' } },
  axisLabel: { color: 'rgba(223,232,245,0.7)', fontSize: 11 },
  splitLine: { lineStyle: { color: 'rgba(255,255,255,0.07)' } },
}

const kpis = computed(() => {
  const s = stats.value || {}
  const d = drone.value || {}
  const total = Object.values(s.order_status_count || {}).reduce((a, b) => a + Number(b || 0), 0)
  const delivered = s.order_status_count?.delivered || 0
  const cancelled = s.order_status_count?.cancelled || 0
  const rate = total ? ((delivered / total) * 100).toFixed(1) : '0.0'
  return [
    { label: '累计订单', value: total.toLocaleString(), color: '#409EFF' },
    { label: '已送达', value: Number(delivered).toLocaleString(), color: '#67C23A' },
    { label: '已取消', value: Number(cancelled).toLocaleString(), color: '#F56C6C' },
    { label: '完单率', value: `${rate}%`, color: '#E6A23C', hint: 'delivered / 全部' },
    { label: '平均配送时长', value: `${s.avg_delivery_minutes ?? '-'} min`, color: '#7a6ad0' },
    { label: '无人机在线', value: `${d.idle ?? 0}/${d.total ?? 0}`, color: '#39d98a', hint: `平均电量 ${d.avg_battery ?? '-'}%` },
  ]
})

let charts = []

function make(el, option) {
  if (!el) return
  const c = echarts.init(el)
  c.setOption(option)
  charts.push(c)
  return c
}

async function load() {
  try {
    const [s, d, o] = await Promise.all([
      getDeliveryStats(),
      getDroneStats(),
      getOverview(),
    ])
    stats.value = s
    drone.value = d
    overview.value = o
    await nextTick()
    renderAll()
    ready.value = true
  } catch (e) {
    err.value = `加载失败：${e.message}`
  }
}

function renderAll() {
  const s = stats.value || {}
  const statusRows = Object.entries(s.order_status_count || {}).map(([k, v]) => ({
    name: { delivered: '已送达', cancelled: '已取消', delivering: '配送中', pending: '待接单' }[k] || k,
    value: Number(v),
  }))
  make(pieEl.value, {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: 'rgba(223,232,245,0.75)', fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    title: {
      text: '累计 ' + statusRows.reduce((a, r) => a + r.value, 0).toLocaleString(),
      subtext: '单',
      left: 'center',
      top: '38%',
      textStyle: { color: '#fff', fontSize: 15, fontWeight: 600 },
      subtextStyle: { color: 'rgba(223,232,245,0.55)', fontSize: 11 },
      itemGap: 2,
    },
    series: [{
      type: 'pie',
      radius: ['46%', '70%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#0e1728', borderWidth: 2 },
      label: { show: false },
      labelLine: { show: false },
      data: statusRows,
    }],
    color: ['#67C23A', '#F56C6C', '#E6A23C', '#909399'],
  })

  const rests = Object.entries(s.orders_by_restaurant || {}).sort((a, b) => a[1] - b[1])
  make(restEl.value, {
    grid: { left: 78, right: 28, top: 16, bottom: 18 },
    xAxis: { type: 'value', ...axisStyle },
    yAxis: { type: 'category', data: rests.map((r) => r[0]), ...axisStyle },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    series: [{
      type: 'bar',
      data: rests.map((r) => r[1]),
      barWidth: 18,
      itemStyle: { borderRadius: [0, 4, 4, 0], color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
        { offset: 0, color: '#2f6fb5' }, { offset: 1, color: '#409EFF' },
      ]) },
      label: { show: true, position: 'right', color: '#dfe8f5', fontSize: 11 },
    }],
  })

  const d = drone.value || {}
  const droneRows = Object.entries(d.by_status || {}).map(([k, v]) => ({
    name: { idle: '空闲', delivering: '配送中', charging: '充电', maintenance: '维护' }[k] || k,
    value: Number(v),
  }))
  make(droneEl.value, {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: 'rgba(223,232,245,0.75)', fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    series: [{
      type: 'pie',
      roseType: 'radius',
      radius: ['26%', '66%'],
      center: ['50%', '44%'],
      itemStyle: { borderColor: '#0e1728', borderWidth: 2 },
      label: { color: '#dfe8f5', fontSize: 11, formatter: '{b} {c}' },
      data: droneRows.length ? droneRows : [{ name: '无数据', value: 1 }],
    }],
    color: ['#39d98a', '#409EFF', '#E6A23C', '#F56C6C'],
  })
}

async function renderRoute() {
  try {
    const r = await planRoute({ ...DEMO_ROUTE })
    make(routeEl.value, {
      grid: { left: 52, right: 24, top: 30, bottom: 24 },
      tooltip: { trigger: 'axis', valueFormatter: (v) => `${v} m` },
      legend: { top: 0, textStyle: { color: 'rgba(223,232,245,0.75)', fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
      xAxis: { type: 'category', data: ['直线距离', '规划距离'], ...axisStyle },
      yAxis: { type: 'value', name: 'm', nameTextStyle: { color: 'rgba(223,232,245,0.6)', fontSize: 11 }, ...axisStyle },
      series: [{
        type: 'bar',
        barWidth: 44,
        data: [
          { value: Number(r.straight_distance_m.toFixed(1)), itemStyle: { color: '#F56C6C', borderRadius: [4, 4, 0, 0] } },
          { value: Number(r.distance_m.toFixed(1)), itemStyle: { color: '#39d98a', borderRadius: [4, 4, 0, 0] } },
        ],
        label: { show: true, position: 'top', color: '#dfe8f5', fontSize: 12, formatter: '{c} m' },
        markPoint: {
          symbolSize: 0,
          label: {
            show: true,
            position: 'insideTop',
            offset: [0, 26],
            color: '#ffb454',
            fontSize: 11,
            formatter: `绕行 +${r.detour_m.toFixed(1)} m（+${Math.round(r.detour_ratio * 100)}%）`,
          },
          data: [{ coord: [1, Number(r.distance_m.toFixed(1))] }],
        },
      }],
    })
  } catch (e) {
    err.value = `航线数据加载失败：${e.message}`
  }
}

function renderLayers(layers) {
  const rows = layers.filter((l) => l.count > 0).sort((a, b) => a.count - b.count)
  make(layerEl.value, {
    grid: { left: 92, right: 40, top: 12, bottom: 20 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', ...axisStyle },
    yAxis: { type: 'category', data: rows.map((l) => l.label), ...axisStyle },
    series: [{
      type: 'bar',
      barWidth: 14,
      data: rows.map((l, i) => ({
        value: l.count,
        itemStyle: { color: chartColor[i % chartColor.length], borderRadius: [0, 3, 3, 0] },
      })),
      label: { show: true, position: 'right', color: '#dfe8f5', fontSize: 11 },
    }],
  })
}

let resizeHandler = null
onMounted(async () => {
  await load()
  await renderRoute()
  const layers = await getLayers().catch(() => [])
  renderLayers(layers || [])
  resizeHandler = () => charts.forEach((c) => c.resize())
  window.addEventListener('resize', resizeHandler)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeHandler)
  charts.forEach((c) => c.dispose())
  charts = []
})
</script>

<style scoped>
.dashboard {
  position: absolute;
  inset: 0;
  overflow: auto;
  padding: 14px 18px 18px;
  background:
    radial-gradient(1200px 500px at 12% -10%, rgba(64, 158, 255, 0.16), transparent 60%),
    radial-gradient(900px 400px at 92% 0%, rgba(57, 217, 138, 0.1), transparent 60%),
    #0a0e1a;
  color: #dfe8f5;
}

.dash-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 12px;
}

.dash-head h2 {
  margin: 0;
  font-size: 20px;
  letter-spacing: 2px;
  color: #fff;
}

.dh-sub {
  margin-left: 12px;
  font-size: 12px;
  color: rgba(223, 232, 245, 0.55);
}

.dh-time {
  font-family: 'Consolas', monospace;
  font-size: 13px;
  color: rgba(223, 232, 245, 0.7);
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

.kpi {
  position: relative;
  padding: 12px 14px;
  border-radius: 8px;
  background: rgba(16, 26, 44, 0.9);
  border: 1px solid rgba(64, 158, 255, 0.22);
  overflow: hidden;
}

.kpi::after {
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 2px;
  background: linear-gradient(90deg, rgba(64, 158, 255, 0.8), transparent);
}

.kpi-n {
  display: block;
  font-size: 24px;
  font-weight: 700;
  font-family: 'Consolas', 'Microsoft YaHei', monospace;
  line-height: 1.1;
}

.kpi-l {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: rgba(223, 232, 245, 0.65);
}

.kpi-h {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: rgba(223, 232, 245, 0.4);
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.panel {
  border-radius: 8px;
  background: rgba(16, 26, 44, 0.9);
  border: 1px solid rgba(64, 158, 255, 0.2);
  padding: 10px 12px 4px;
  min-height: 290px;
}

.panel.wide {
  grid-column: span 4;
  min-height: 262px;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 4px;
}

.chart {
  width: 100%;
  height: 244px;
}

.chart.tall {
  height: 212px;
}

.dash-foot {
  margin-top: 10px;
  font-size: 12px;
  color: #ffb1b1;
}
</style>
