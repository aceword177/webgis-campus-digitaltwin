# 文档一致性 + 工程卫生 + 限飞区边级避让 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除文档与代码不一致、补齐滞后文档、清理调试产物、将限飞区避让升级为"节点缓冲 + 边级过滤 + cost 惩罚 + 真实穿越检测"，全部改动纳入 git 版本管理。

**Architecture:** 文档层（README/api.md）对齐代码并补全配送接口；工程层统一 SQL 编码并归档调试产物；算法层改造导航网格生成脚本（05）与路径规划服务（NavigationMapper/RouteServiceImpl），新增响应字段透传真实穿越结果。

**Tech Stack:** Spring Boot 3.2 / MyBatis-Plus / PostgreSQL + PostGIS + pgRouting / Vue3 / git

## Global Constraints

- 数据库：shp_data，PostgreSQL + PostGIS + pgRouting，SRID 4326（来自 spec 与 application.yml）。
- 表名白名单 8 张空间表不变；动态表名防注入逻辑不动。
- 后端全局 Jackson SNAKE_CASE 序列化，前端请求体/字段用下划线命名。
- 不改既有接口签名与返回结构；RoutePlanResponse 只增字段（向后兼容）。
- 05 脚本幂等（DROP + CREATE），重建秒级；执行前可选 pg_dump 备份。
- 转码前备份原文件；只处理确实为 GBK 的文件。
- 每个任务结束必须验证 + git 提交。

---

### Task 0: git 初始化 + 基线提交

**Files:** 无（已完成）

- [x] `git init`，仓库级配置 user.name=campus-dev / user.email=campus-dev@local
- [x] `git add -A` + 首次提交 `2ac3a4e`

### Task 1: 工程卫生 — SQL 转码 + 调试产物归档

**Files:**
- Modify: `docs/sql/01_create_tables.sql`、`02_seed_data.sql`、`03_fix_no_fly_zone.sql`、`04_verify_data.sql`、`05_setup_pgrouting_navigation.sql`（GBK→UTF-8）
- Archive: 根目录 `error1~4.png`、`error_screenshot.png`、`backend_error.log`、`backend_start.log`；`backend/backend.log`、`backend/backend-err.log` → `docs/debug-archive/`
- Create: `docs/debug-archive/README.md`（说明归档来源与时间）

- [ ] **Step 1: 检测 5 个 SQL 文件编码**（PowerShell 读字节判断是否有 GBK 双字节特征）
- [ ] **Step 2: 备份原文件**为 `docs/debug-archive/sql-gbk-backup/` 下同名 `.gbk.bak`
- [ ] **Step 3: 转码**：PowerShell `[System.IO.File]::ReadAllText(path, GBK)` → `WriteAllText(path, text, UTF8)`（保留 BOM 与否：不写 BOM）
- [ ] **Step 4: 归档调试产物**：`New-Item docs/debug-archive -Force` + `Move-Item` 全部 8 个文件
- [ ] **Step 5: 写 `docs/debug-archive/README.md`**（来源文件、归档日期、原编码说明）
- [ ] **Step 6: 验证**：`Get-Content docs/sql/01_create_tables.sql -Encoding UTF8` 无乱码（关键中文注释可读）；根目录无 error*/log 文件
- [ ] **Step 7: 提交**：`git add -A && git commit -m "chore: re-encode SQL to UTF-8, archive debug artifacts to docs/debug-archive"`

### Task 2: docs/api.md 更新（删 IoT + 补配送接口）

**Files:**
- Modify: `docs/api.md`

- [ ] **Step 1: 删除"三、模拟物联网接口"整节（3.1~3.4 与引言）**
- [ ] **Step 2: 章节重新编号**：空间查询=一、MVT=二、统计=三、新增配送业务=四
- [ ] **Step 3: 新增"四、配送业务接口"**，按现有格式补 6 组 23 个接口（无人机 4 / 订单 7 / 航线 4 / 限飞区 2 / 餐厅 3 / 商品 3），含参数表与响应示例；重点：
  - `POST /api/route/plan` 响应含 `avoided_no_fly_zone`、`straight_line_cross_zone`、`route_still_cross_zone`、`crossed_zones`
  - 订单状态机 5 态说明（pending/assigned/delivering/delivered/cancelled）
- [ ] **Step 4: 验证**：grep 全文无 "iot" / "物联网"；章节号连续；接口 URL 与后端 Controller @RequestMapping 逐一核对
- [ ] **Step 5: 提交**：`git commit -m "docs(api): remove IoT section, add delivery business APIs"`

### Task 3: README.md 全量更新

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 技术栈表**数据库行补 `pgRouting`
- [ ] **Step 2: 删除"物联网模拟"节**，新增"无人机配送"节（订单闭环、A* 路径规划、限飞区边级避让、自动调度、飞行动画）
- [ ] **Step 3: 项目结构**补配送相关 backend（Drone/Order/Route/NoFlyZone/Restaurant/Product controller+service）与 frontend（DronePanel/OrderPanel/RoutePlanPanel/DeliveryStats/OrderDetail）
- [ ] **Step 4: 后端接口一览**补六组配送接口表
- [ ] **Step 5: 面试亮点**更新：pgRouting A* 边级避让、cost 惩罚、真实穿越检测、自动调度闭环
- [ ] **Step 6: 扩展方向**追加：更高分辨率导航网格、真实无人机机队接入；环境要求补 pgRouting
- [ ] **Step 7: 验证**：通读全文件，无 IoT 残留、无数字孪生旧描述矛盾
- [ ] **Step 8: 提交**：`git commit -m "docs(readme): sync with drone delivery system v2.0"`

### Task 4: 05_setup_pgrouting_navigation.sql 改造

**Files:**
- Modify: `docs/sql/05_setup_pgrouting_navigation.sql`

- [ ] **Step 1: 顶部新增可调参数**：`v_safety_m := 5.0`、`v_penalty_range_m := 15.0`、`v_penalty_factor := 1.0`
- [ ] **Step 2: 节点判定升级**：`ST_Intersects(点,面)` → `ST_DWithin(nfz.geom::geography, 点::geography, v_safety_m)`
- [ ] **Step 3: 边表加列** `zone_dist_m NUMERIC`
- [ ] **Step 4: 边生成加线段过滤**：`NOT EXISTS (... ST_DWithin(nfz.geom::geography, ST_MakeLine(起,终)::geography, v_safety_m))`
- [ ] **Step 5: 边生成加 cost 惩罚**：查 `MIN(ST_Distance(...))` 得 `v_zone_dist`；`cost = 原始距离 × (1 + v_penalty_factor × max(0, v_penalty_range_m − COALESCE(v_zone_dist, v_penalty_range_m)) / v_penalty_range_m)`，`reverse_cost` 同
- [ ] **Step 6: 统计输出**：RAISE NOTICE 可飞行/不可飞行节点数、总边数、被过滤边数、受惩罚边数
- [ ] **Step 7: 验证**：SQL 逻辑复核（无占位、变量均有声明与赋值；测试段保留）
- [ ] **Step 8: 提交**：`git commit -m "feat(nav): node safety buffer, edge-level no-fly filtering, cost penalty"`

### Task 5: 后端真实穿越检测

**Files:**
- Modify: `backend/src/main/java/com/campus/twin/mapper/NavigationMapper.java`
- Modify: `backend/src/main/java/com/campus/twin/service/impl/RouteServiceImpl.java`
- Modify: `backend/src/main/java/com/campus/twin/dto/RoutePlanResponse.java`

**Interfaces:**
- 新增 Mapper 方法 `List<Map<String,Object>> checkPathCrossNoFlyZone(@Param("edgeIds") List<Integer> edgeIds)`：`pgr_astar` 返回的 edge 列表传入，`ST_Intersects(zone, edge.geom)` 返回穿越的限飞区
- RoutePlanResponse 新增：`Boolean straightLineCrossZone`、`Boolean routeStillCrossZone`、`List<Map<String,Object>> crossedZones`
- `avoidedNoFlyZone` 语义：`straightLineCrossZone == true && routeStillCrossZone == false`

- [ ] **Step 1: NavigationMapper 新增 checkPathCrossNoFlyZone（注解 SQL）**
- [ ] **Step 2: RoutePlanResponse 新增 3 字段（lombok builder）**
- [ ] **Step 3: RouteServiceImpl.plan 改造**：
  - 起终点直线穿越：调用现有 `checkLineCrossNoFlyZone` → `straightLineCrossZone` + `crossedZones`
  - 从 pgr_astar 结果收集 edge 列表 → 调 `checkPathCrossNoFlyZone` → `routeStillCrossZone`
  - `avoidedNoFlyZone = straightLineCrossZone && !routeStillCrossZone`
  - 删除距离比推断逻辑（保留 straightDistance 计算可删）
- [ ] **Step 4: 验证**：`cd backend && mvn -q compile` 通过
- [ ] **Step 5: 提交**：`git commit -m "feat(route): real no-fly-zone crossing detection replaces distance-ratio heuristic"`

### Task 6: 前端 RoutePlanPanel 文案

**Files:**
- Modify: `frontend/src/components/RoutePlanPanel.vue`

- [ ] **Step 1: 结果区"避让限飞区"项改为三态展示**：
  - `route_still_cross_zone=true` → 红色警告"路径仍穿越限飞区，请调整"
  - `straight_line_cross_zone=true && route_still_cross_zone=false` → 绿色"已成功绕行 N 个限飞区"（N=crossed_zones 长度）
  - 两者都 false → "未穿越限飞区"
- [ ] **Step 2: 验证**：`cd frontend && npm run build` 通过
- [ ] **Step 3: 提交**：`git commit -m "feat(ui): show real no-fly-zone avoidance result in route plan panel"`

### Task 7: 重建导航网格（数据库）

**Files:**
- Run: `docs/sql/05_setup_pgrouting_navigation.sql`

- [ ] **Step 1: 检测 psql 可用性**：`psql --version`；不可用则交付用户手动执行（`psql -U postgres -d shp_data -f docs/sql/05_setup_pgrouting_navigation.sql`）
- [ ] **Step 2: 执行脚本**（密码 postgres，环境变量 PGPASSWORD）
- [ ] **Step 3: 验证统计输出**：节点数/可飞行数/总边数/被过滤边数正常；抽查 `SELECT COUNT(*) FROM drone_nav_edge WHERE zone_dist_m IS NOT NULL`
- [ ] **Step 4: 提交（如有脚本后续修正）**

### Task 8: 最终复核与交付

- [ ] **Step 1: 逐项对照 spec 第 0 节表格**核验 5 个问题全部处理
- [ ] **Step 2: 全量 `git status` 确认工作区干净**；`git log --oneline` 展示提交历史
- [ ] **Step 3: 交付说明**：列出改动文件、验证结果、遗留事项（git 远程托管、仓库级 user 配置可改）
