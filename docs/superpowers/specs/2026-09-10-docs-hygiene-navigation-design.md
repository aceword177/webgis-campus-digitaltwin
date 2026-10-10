# 项目优化设计：文档一致性 + 工程卫生 + 限飞区边级避让

> 日期：2026-09-10
> 状态：已获用户逐节批准（节 1~4）
> 目标：消除文档与代码不一致、补齐滞后文档、清理工程调试产物、将限飞区避让从"中心点硬开关 + 距离比推断"升级为"边级过滤 + 成本惩罚 + 真实穿越检测"

## 0. 背景（上轮解析发现的 5 个问题）

| # | 问题 | 已确认处理方向 |
|---|------|----------------|
| 1 | 文档声称有 `/api/iot/*` 模拟物联网接口，代码中不存在 IotController / IoT 实体 / Mapper | A：删除 README 与 api.md 中的"模拟物联网"章节 |
| 2 | docs/api.md 未收录配送业务接口 | 补写完整配送业务接口文档 |
| 3 | README 停留在数字孪生 MVP 版（技术栈缺 pgRouting、无配送模块） | 全量更新 README |
| 4 | docs/sql 为 GBK 编码（UTF-8 下乱码）；根目录遗留调试截图与日志 | C：统一转 UTF-8 + 调试产物归档 docs/debug-archive/ |
| 5 | 限飞区避让仅"网格节点中心点判定 + 距离比(>1.1)推断" | C：完整网格优化（边级过滤 + cost 惩罚 + 真实穿越检测） |

## 1. 设计节 1：限飞区避让 — 完整网格优化

### 1.1 节点生成升级（docs/sql/05_setup_pgrouting_navigation.sql 节点段）

- 新增脚本顶部可调参数：`v_safety_m NUMERIC := 5.0;`（禁飞安全缓冲，默认网格半格）。
- 判定 SQL 从：
  ```sql
  NOT EXISTS (SELECT 1 FROM no_fly_zone nfz
              WHERE ST_Intersects(nfz.geom, ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)))
  ```
  升级为：
  ```sql
  NOT EXISTS (SELECT 1 FROM no_fly_zone nfz
              WHERE ST_DWithin(nfz.geom::geography,
                               ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography,
                               v_safety_m))
  ```
- 效果：节点距限飞区 < 5m 即不可飞，消除边界误标，保留安全间距。

### 1.2 边生成升级（边段）— 边级避让

- 建边前检查源-目标**线段**是否穿越限飞区（含缓冲）：
  ```sql
  NOT EXISTS (SELECT 1 FROM no_fly_zone nfz
              WHERE ST_DWithin(nfz.geom::geography,
                               ST_SetSRID(ST_MakeLine(v_node.geom, v_neighbor.geom), 4326)::geography,
                               v_safety_m))
  ```
  命中则不建边。
- 效果：即使两个端点都在区外，只要连线穿越限飞区，该边不存在 → A* 在拓扑层面绕行。
- 新增统计输出：被过滤的边数（`RAISE NOTICE`）。

### 1.3 成本惩罚（软约束，防贴边飞行）

- `drone_nav_edge` 新增列：`zone_dist_m NUMERIC`（该边到最近限飞区距离，生成时写入）。
- 生成边时计算：
  ```sql
  SELECT MIN(ST_Distance(nfz.geom::geography, edge_geom::geography))
  INTO v_zone_dist
  FROM no_fly_zone nfz
  WHERE ST_DWithin(nfz.geom::geography, edge_geom::geography, v_penalty_range_m);
  -- 未命中（NULL，视为远离）时按 COALESCE 处理为 v_penalty_range_m，惩罚项为 0
  ```
- cost 公式（脚本顶部可调参数：`v_penalty_range_m := 15.0`、`v_penalty_factor := 1.0`）：
  ```
  cost = 原始距离 × (1 + v_penalty_factor × max(0, v_penalty_range_m − COALESCE(v_zone_dist, v_penalty_range_m)) / v_penalty_range_m)
  ```
  `reverse_cost` 同样处理。
- 效果：A* 倾向选远离限飞区的路径，而非贴着边界飞行。

### 1.4 真实穿越检测（NavigationMapper + RouteServiceImpl + DTO）

- **复用**已有 SQL `checkLineCrossNoFlyZone`：检测**直线**（起终点连线）是否穿越限飞区。
- **新增 SQL**（NavigationMapper）：检测 A* 规划出的**实际路径**（节点连接线）是否仍与限飞区相交：
  ```sql
  SELECT nfz.id, nfz.name, nfz.level
  FROM no_fly_zone nfz
  JOIN drone_nav_edge e ON ST_Intersects(nfz.geom, e.geom)
  WHERE e.id = ANY (#{edgeIds}::int[])
  ```
  实现时由 `pgr_astar` 返回的 edge 列表传入。
- `RoutePlanResponse` 新增字段：
  - `straightLineCrossZone: boolean` — 起终点直线是否穿越限飞区；
  - `routeStillCrossZone: boolean` — A* 路径是否仍与限飞区相交（true = 避让不彻底的警告）；
  - `crossedZones: List<Map>` — 直线穿越的限飞区明细（名称/等级），便于展示。
- `avoidedNoFlyZone` 语义更新为真实逻辑：`straightLineCrossZone == true && routeStillCrossZone == false` = 成功避让。
- 前端 `RoutePlanPanel` 结果区文案更新：显示"直线穿越限飞区（X 个）/ 路径已成功绕行"或"路径仍穿越限飞区，请检查"（替代原"实际路径比直线长10%"推断）。

### 1.5 数据重建

- 修改后的 05 脚本幂等（DROP TABLE + CREATE 已具备），重建秒级。
- 执行方式：由代理尝试 `psql` 连接本机 PostgreSQL（localhost:5432/shp_data）；连接失败则交付脚本由用户手动执行。

## 2. 设计节 2：文档更新

### 2.1 README.md 全量更新

- 技术栈表数据库行补 `pgRouting`；
- 删除"物联网模拟"整节（核心功能章节）；
- 新增"无人机配送"章节：订单闭环、A* 路径规划、限飞区边级避让、自动调度、飞行动画；
- 项目结构补充配送相关 backend/frontend 文件；
- 后端接口一览补六组配送接口（drone/order/route/restaurant/product/no-fly-zone）；
- 面试亮点更新：pgRouting A* 边级避让、成本惩罚、真实穿越检测、自动调度闭环；
- 扩展方向追加：更高分辨率导航网格、真实无人机机队接入；
- 环境要求补 pgRouting 扩展；
- 版本标注：MVP v2.0（与 App.vue 一致）。

### 2.2 docs/api.md 更新

- 删除"三、模拟物联网接口"及 3.1~3.4 小节，章节重新编号（空间查询 → 一、MVT → 二、统计 → 三、配送业务 → 四）；
- 新增"配送业务接口"章节，按现有格式补全：
  - 无人机：`GET /api/drone/list`、`GET /api/drone/{id}`、`GET /api/drone/stats`、`POST /api/drone/{id}/update-position`
  - 订单：`GET /api/order/list`、`GET /api/order/{id}`、`POST /api/order/create`、`POST /api/order/{id}/assign`、`POST /api/order/{id}/deliver`、`POST /api/order/{id}/cancel`、`GET /api/order/stats`
  - 航线：`POST /api/route/plan`、`GET /api/route/{id}`、`GET /api/route/order/{orderId}`、`GET /api/route/active`
  - 限飞区：`GET /api/no-fly-zone/list`、`POST /api/no-fly-zone/check`
  - 餐厅：`GET /api/restaurant/list`、`GET /api/restaurant/{id}`、`GET /api/restaurant/{id}/products`
  - 商品：`GET /api/product/list`、`GET /api/product/{id}`、`GET /api/product/hot`
- 每个接口含 URL、方法、参数表、响应示例（与现有章节格式一致）。

## 3. 设计节 3：工程卫生

- `docs/sql/01_create_tables.sql`、`02_seed_data.sql`、`03_fix_no_fly_zone.sql`、`04_verify_data.sql`、`05_setup_pgrouting_navigation.sql`：GBK → UTF-8 转码（转码前确认文件编码，只处理确实为 GBK 的文件）。
- 根目录调试产物移入 `docs/debug-archive/`：
  - `error1.png`、`error2.png`、`error3.png`、`error4.png`、`error_screenshot.png`
  - `backend_error.log`、`backend_start.log`
- `backend/backend.log`、`backend/backend-err.log` 一并移入归档。
- 根目录最终仅保留：代码目录、docs、README.md、.gitignore、启动脚本（`start-backend.bat`、`start-frontend.bat`）。
  （原同时保留中文命名的 `启动后端.bat` / `启动前端.bat`，两者功能完全重复；后续清理中已删除，仅保留 ASCII 命名的一份。）

## 4. 设计节 4：执行顺序与验证

1. 文档更新（README、api.md）；
2. 工程卫生（SQL 转码、调试产物归档）；
3. 代码修改：05 脚本 → NavigationMapper → RouteServiceImpl → RoutePlanResponse → 前端 RoutePlanPanel；
4. 重建导航网格：尝试 psql 执行 05 脚本；失败则交付用户手动执行；
5. 验证：
   - 后端：`mvn compile` 编译通过；
   - 前端：`npx vue-tsc --noEmit` 或 vite build 语法检查（视项目是否配置 TS 而定，项目为 JS 项目则用 `npm run build` 冒烟）；
   - 文档：逐项核对删除/新增内容与代码一致；
   - SQL：在 04_verify_data.sql 基础上确认重建结果统计。

## 5. 风险与回滚

- **数据库重建**：05 脚本为 DROP + CREATE，重建后原导航网格丢失；脚本幂等且可重跑，风险低。执行前可先 `pg_dump` 备份 drone_nav_node/drone_nav_edge（可选）。
- **转码**：转码前先备份原 GBK 文件（副本存入 debug-archive 或 .bak），转码后对比内容一致。
- **文档删除**：api.md 删除 IoT 章节前无需备份（git 可追溯；项目尚未 git init，故在 debug-archive 中保留 api.md 原文副本）。
- **代码修改**：只新增/修改方法，不改既有接口签名与返回结构（RoutePlanResponse 为新增字段，向后兼容）。

## 6. 已验证事实（来自代码阅读）

- 后端 controller 共 9 个：Spatial/Tile/Stat/Drone/Order/Route/NoFlyZone/Restaurant/Product，无 IoT 控制器。
- NavigationMapper 已存在 `checkLineCrossNoFlyZone`（起终点直线穿越检测）但 RouteServiceImpl 未使用。
- RouteServiceImpl 现用 `distanceM > straightDistance * 1.1` 推断避让。
- 05 脚本节点判定用 `ST_Intersects(点, 面)`；边段仅按"两端可飞行 + 8 邻域"建边，无线段过滤、无 cost 惩罚。
- 前端 RoutePlanPanel 结果区展示 `avoided_no_fly_zone`（布尔），无真实穿越信息。
- 项目根目录存在 .gitignore 但未初始化 git 仓库（`git status` 报 not a git repository）。
