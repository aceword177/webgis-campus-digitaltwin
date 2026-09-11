# 食堂缓冲区圈显隐交互设计

> 日期：2026-09-11
> 状态：已获用户逐节批准（节 1~4）
> 目标：解决 6 个缓冲圈同时叠加导致分层不明显的问题——通过左下角查询组件控制圈显隐，点击食堂名显示该食堂全部 3 层圈，点击档位只显示单个圈，默认不显示圈。

## 0. 已确认决策

1. 显示逻辑：单圈单选 + 只显示一个食堂的全部缓冲区；
2. 交互映射：点击食堂名→该食堂 3 圈；点击档位→单圈 + 高亮宿舍 + 浮窗；标题栏"全部显示"→恢复 6 圈；
3. 默认状态：打开页面不显示圈（用户主动点击才显示）；
4. 点击档位：显示该圈 + 高亮宿舍 + 浮窗（方案 b）。

## 1. 圈显隐控制机制

- 现有 `loadCanteenBuffer` 生成 6 个 ellipse entity（id `canteen-tier-{canteen_id}-{seconds}`），同在 `dataSources.canteenBuffer`；
- 新增 store 状态 `mapStore.canteenActiveSelection`（单一数据源），取值：
  - `null`：全部隐藏（默认）
  - `{type:'all'}`：6 圈全显
  - `{type:'canteen', canteenId}`：只显该食堂 3 层圈
  - `{type:'tier', canteenId, seconds}`：只显这一个圈
- `CesiumViewer` 在 `loadCanteenBuffer` 后 `watch(canteenActiveSelection)`，按 id 查找 entity 设置 `.show`；加载后立即应用一次（默认 null → 全隐藏）；
- 不改动 ellipse 渲染本身。

## 2. 组件交互（CanteenCoverageQuery.vue）

- 点击食堂名 → `canteenActiveSelection = {type:'canteen', canteenId}`（不触发高亮/浮窗）；
- 点击档位 → `canteenActiveSelection = {type:'tier',...}` + `coveragePopup = {type:'tier',...}`（单圈 + 高亮 + 浮窗）；
- 标题栏"全部显示"按钮 → `canteenActiveSelection = {type:'all'}` + `coveragePopup = null`；
- 选中视觉反馈：当前选中的食堂名行/档位加高亮背景（`rgba(64,158,255,0.25)` + 左边框）；
- 默认无选中提示：`canteenActiveSelection` 为 null 时显示淡色小字"点击食堂名查看全部缓冲区，或点击档位查看单圈覆盖"；
- 折叠功能保留。

## 3. 地图点击圈与图层开关联动

- 点击地图上的缓冲圈（`isCanteenTier`）：除现有 `coveragePopup` 外，同步设置 `canteenActiveSelection = {type:'tier',...}`（双向同步）；
- 图层面板开关：关闭 → `dataSource.show = false`（现有）；打开 → `dataSource.show = true`，entity.show 仍由 `canteenActiveSelection` 控制；
- 关闭浮窗/点空白：`coveragePopup = null`（清高亮），`canteenActiveSelection` 保持不变（圈继续显示）。

## 4. 验证

- `npm run build` 0 错误；
- 手动：默认不显示圈（组件有提示）；点食堂名→3 圈；点档位→单圈+高亮+浮窗；全部显示→6 圈；点地图圈→组件同步选中；关/开图层→恢复选中状态；其他功能不受影响。
