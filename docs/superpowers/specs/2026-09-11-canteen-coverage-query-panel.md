# 食堂缓冲区图例升级为查询面板设计

> 日期：2026-09-11
> 状态：已获用户逐节批准（节 1~4）
> 目标：将左下角静态图例（3 色点 + 文本）升级为可折叠的"食堂缓冲区覆盖范围查询"面板组件，展示两个食堂的 3 档覆盖统计，点击档位触发高亮 + 清单浮窗。

## 0. 已确认决策

1. 位置形态：左下角原位升级为可折叠面板（方案 a）；
2. 标题："食堂缓冲区覆盖范围查询"；
3. 内容交互：统计查询型（方案 a）——两食堂各一行 3 档覆盖数，点击档位→高亮+浮窗，底部图例；
4. 默认展开，点击档位不飞相机（方案 a）。

## 1. 组件结构

- 新建 `frontend/src/components/CanteenCoverageQuery.vue`，替换 `App.vue` 中内联的 `coverage-legend` div 及 `.coverage-legend/.cl-*` 样式；
- 标题栏：标题 + 折叠/展开箭头（Element Plus `ArrowDown`/`ArrowUp`）；
- 展开内容（默认展开）：
  - 两食堂各一行：食堂名 + 3 档覆盖数（`30s:N栋 / 60s:N栋 / 90s:N栋`），每档可点击（hover 高亮）；
  - 分隔线 + 3 色图例（绿/橙/红 = 30s·150m / 60s·300m / 90s·450m）+ 说明"圆=时间参考线，高亮点=实际覆盖宿舍"；
- 折叠状态：仅标题栏。

## 2. 数据与交互

- 数据来源：`mapStore.canteenCoverage`（已有，后端 `/api/restaurant/coverage` 返回）；显隐条件 `v-if="mapStore.layers.canteenBuffer && mapStore.canteenCoverage"`（与原图例一致）；
- 点击档位：写入 `mapStore.coveragePopup = { type:'tier', canteenId, canteenName, seconds, dormitories }`，复用 `CesiumViewer` 现有 `watch(coveragePopup)` 高亮联动 + 已有 `CanteenCoveragePanel.vue` 浮窗；
- 折叠状态：组件内部 `ref collapsed = false`，不进 store；
- 不改动后端、`CanteenCoveragePanel.vue`、`CesiumViewer`。

## 3. 样式

- 深色半透明 `rgba(20,30,48,0.92)`、圆角 8px、白字、box-shadow（与现有面板统一）；
- 位置：`position:absolute; left:16px; bottom:120px; z-index:11; width:250px`（与原图例同位置，不遮挡底部工具栏/测量信息条）；
- 标题栏 14px 加粗；食堂行 12px，档位数用对应颜色（绿/橙/红），hover 行背景 `rgba(64,158,255,0.15)`，cursor pointer；
- 折叠用 `v-show` + 简单过渡。

## 4. 验证

- `npm run build` 0 错误；
- 手动：面板默认展开显示 2 食堂统计；折叠/展开正常；点击某档 → 宿舍高亮 + 清单浮窗；关闭浮窗/点空白 → 高亮清除；图层面板关"食堂缓冲区"→ 面板消失；其他功能不受影响。
