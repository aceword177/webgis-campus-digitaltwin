# WebGIS 开发工程师 30 天学习日志（校园数字孪生项目实战版）

> **适用对象**：零基础 / 转行 / 应届生，目标是拿到 **WebGIS 开发工程师** offer。
> **配套项目**：`D:\iDEA-Data\webgis-campus-digitaltwin-mvp`（校园无人机外卖配送数字孪生 MVP）
> **项目技术栈**：Vue3 + Vite + Cesium 1.145 + Pinia + Element-Plus ｜ Spring Boot 3.2 + MyBatis-Plus ｜ PostgreSQL + PostGIS + pgRouting
> **文档作者视角**：假设你只会一点点 HTML/Java 基础，看到 `Cesium.GeoJsonDataSource.load(...)` 会头大——那我们就从这个状态开始。

---

## 0. 先读这一页：这份日志怎么用

### 0.1 你每天做什么（固定节奏，约 3～4 小时）

| 环节 | 时长 | 做什么 |
|---|---|---|
| ① 概念 | 30 min | 读当天「核心概念」，把专业词念顺（SRID、GeoJSON、响应式…） |
| ② 读码 | 60 min | 按「项目代码对照」里的**文件路径 + 行号**打开项目源码，逐行看懂 |
| ③ 做题 | 90 min | 做「课后实践题」——**先自己做，再对答案**，答案要看「解析」 |
| ④ 验证 | 30 min | 按「验证方法」跑命令/开浏览器，看到预期结果才算过 |
| ⑤ 打卡 | 10 min | 在本文件末尾「学习打卡表」打勾，写下 1 句今天最大的坑 |

### 0.2 三条纪律（决定你能不能拿到 offer）

1. **不许收藏夹式学习**：看懂的代码要自己敲一遍，报错要自己修一次。
2. **每天必须有一个可运行产物**：一个 SQL 查询结果、一个接口返回 JSON、一个页面截图，都算。
3. **遇到报错先读报错全文**，再往下看。本项目 README 里 6 条「关键实现约束」全是真实踩坑记录——它们比任何教程都值钱，因为**面试官就爱问这些**。

### 0.3 30 天总览

| 阶段 | 天数 | 主题 | 产出 |
|---|---|---|---|
| A 打地基 | Day 1–4 | WebGIS 概念 + 环境 + PostGIS | 能独立写空间 SQL，查出校园建筑面积 |
| B 后端 | Day 5–12 | Spring Boot + MyBatis-Plus + 空间接口 + MVT | 能新增一个空间查询接口并自测 |
| C 前端 | Day 13–20 | Vue3 + Pinia + Cesium | 能独立在三维地球上加载一个图层 |
| D 交互与量算 | Day 21–26 | 拾取点击、测距测面积、动画、性能 | 能修一个真实 bug 并写回归验证脚本 |
| E 算法与求职 | Day 27–30 | pgRouting A\*、定时任务、测试、简历面试 | 能对着简历讲清 5 个技术亮点 |

---

## 一、项目解析：这是个什么项目

### 1.1 一句话说清业务

在浏览器里的 **三维校园地球**上，把校园的**教学楼、宿舍楼、道路、操场**用三维白模画出来；点击一栋楼能看到它的院系介绍和照片；用户点外卖后，系统用 **A\* 算法**规划一条**绕开限飞区**的无人机航线，无人机在三维地图上**实时移动**送货到宿舍楼。

技术关键词：**数字孪生（Digital Twin）**、**三维可视化**、**空间分析**、**路径规划**。

### 1.2 系统分层（重要！面试必答）

```
┌─────────────────────────────────────────────┐
│  浏览器（前端）                                │
│  Vue3 组件  →  Pinia 状态  →  Axios 请求       │
│  Cesium 三维地球（WebGL 渲染）                 │
└───────────────┬─────────────────────────────┘
                │ HTTP/JSON（REST）+ MVT 瓦片二进制
┌───────────────▼─────────────────────────────┐
│  后端（Spring Boot）                          │
│  Controller 接参 → Service 业务 → Mapper 取数 │
│  算法：pgr_astar 路径规划 / 限飞区避让 / 调度  │
└───────────────┬─────────────────────────────┘
                │ JDBC + SQL（含 PostGIS 空间函数）
┌───────────────▼─────────────────────────────┐
│  数据库（PostgreSQL + PostGIS + pgRouting）   │
│  8 张校园空间表（矢量）+ 6 张业务表 + 2 张导航表 │
└─────────────────────────────────────────────┘
```

**为什么这么分？** 因为「空间计算」放在数据库里做最快（PostGIS 是 C 语言写的，还有 GiST 空间索引）；「三维渲染」只能在浏览器做（WebGL）；「业务规则」放后端做（安全、可复用）。

### 1.3 技术栈全景表（含「为什么用它」）

| 层 | 技术 | 版本 | 作用 | 为什么用它（面试话术） |
|---|---|---|---|---|
| 三维引擎 | **Cesium** | 1.145.0（钉死） | 三维地球、白模、航线、动画 | 开源三维 GIS 事实标准，支持 WGS84 真实地理坐标，能做数字孪生 |
| 前端框架 | **Vue 3** | ^3.4 | 组件化 + 响应式 | 组合式 API 逻辑复用好，国内岗位需求量大 |
| 构建工具 | **Vite** | ^5.2 | 开发服务器 + 打包 | 冷启动快；`vite-plugin-cesium` 自动拷贝 Cesium 静态资源 |
| 状态管理 | **Pinia** | ^2.1 | 全局共享 Viewer/图层/订单 | 替代 Vuex，API 更简洁，配合 setup 语法像写函数 |
| UI 库 | **Element-Plus** | ^2.7 | 面板、表格、按钮 | 后台管理风格开箱即用（本项目侧边栏 5 个面板） |
| HTTP | **Axios** | ^1.6 | 请求 + 拦截器 | 统一处理 `{code,message,data}` 与错误提示 |
| 后端框架 | **Spring Boot** | 3.2.5 | REST 接口、依赖注入 | Java 后端最大生态 |
| ORM | **MyBatis-Plus** | 3.5.5 | 简化 CRUD + 动态 SQL | 复杂空间 SQL 手写 XML 更灵活，简单表用 MP 省代码 |
| 数据库 | **PostgreSQL** | 14+（本项目 18） | 存业务+空间数据 | 空间能力靠 PostGIS 扩展 |
| 空间扩展 | **PostGIS** | 3.x | 空间类型与函数 | `ST_Intersects`/`ST_DWithin`/`ST_AsMVT` 等 |
| 路径规划 | **pgRouting** | 3.x | `pgr_astar` | 数据库内做图搜索，不用把图捞到内存 |
| 校验 | Bean Validation | JSR-380 | 请求体校验 | `@Valid` 注解，注意 starter 必须**显式**引入 |
| 文档 | springdoc-openapi | 2.3.0 | Swagger UI | 接口自测 + 团队协作 |
| 工具库 | Lombok | 1.18.38 | `@Data`/`@Builder` | 少写 getter/setter |
| 测试 | JUnit5 + Mockito | — | 48 个单测 | 状态机/距离口径/SQL 注入防护的回归网 |
| 坐标系统 | WGS84（SRID 4326） | — | 数据基准 | 与底图（高德 GCJ-02 采集）同源，无需平移 |

> **注意（README 明写）**：Cesium 版本被**钉死为 `1.145.0`**，不要写成 `^1.114.0`。否则实际安装版本与文档不符，排查问题时引用的 API 行为会失真——这个坑项目作者踩过。

### 1.4 目录地图（哪块代码该去哪找）

```
webgis-campus-digitaltwin-mvp/
├── backend/                                # Spring Boot 后端
│   ├── src/main/java/com/campus/twin/
│   │   ├── CampusTwinApplication.java      # 启动类
│   │   ├── common/                         # Result 统一响应 / 全局异常 / GeoMath / GeoJsonSupport
│   │   ├── config/                         # Cors / MyBatisPlus / Swagger / DataCleanupRunner
│   │   ├── controller/                     # 9 个控制器：spatial, tile, stat, drone, order, route, no-fly-zone, restaurant, product
│   │   ├── service/ + service/impl/        # 业务逻辑（航线规划、订单状态机、自动调度、位置推进）
│   │   ├── mapper/                         # 数据访问（含 NavigationMapper 导航查询）
│   │   ├── entity/                         # 16 个实体（8 空间表 + 6 业务表 + 2 导航表）
│   │   └── dto/                            # 请求/响应对象（OrderCreateRequest、RoutePlanResponse…）
│   ├── src/main/resources/
│   │   ├── application.yml                 # 主配置（SNAKE_CASE 序列化、profile=local）
│   │   ├── application-local.yml           # 本地库连接
│   │   ├── application-prod.yml            # 生产（缺环境变量即启动失败 fail-fast）
│   │   └── mapper/*.xml                    # 手写空间 SQL（SpatialQueryMapper.xml、TileMapper.xml）
│   └── src/test/java/...                   # 5 个测试类 / 48 个用例
│
├── frontend/                               # Vue3 前端
│   ├── src/
│   │   ├── api/                            # 9 组接口封装（request.js 是 axios 实例+拦截器）
│   │   ├── stores/map.js                   # 唯一 Pinia store：Viewer、图层、订单一网打尽
│   │   ├── components/
│   │   │   ├── CesiumViewer.vue            # 三维场景核心（42KB，最重要）
│   │   │   ├── BuildingPopup.vue           # 建筑点击弹窗（含照片回退）
│   │   │   ├── LayerPanel.vue / Sidebar.vue
│   │   │   ├── OrderPanel.vue / OrderDetail.vue / DronePanel.vue
│   │   │   ├── RoutePlanPanel.vue / DeliveryStats.vue
│   │   │   └── MeasureTool.vue / MeasureInfo.vue / CanteenCoverage*.vue
│   │   ├── utils/
│   │   │   ├── cesium.js                   # 1190 行 Cesium 工具库（白模/无人机/航线/动画）
│   │   │   ├── measure.js                  # 测距测面积（含 ENU 面积算法）
│   │   │   ├── basemap.js                  # 高德影像/矢量底图 + 注记
│   │   │   └── layout.js
│   │   ├── App.vue / main.js / style.css
│   ├── vite.config.js                      # /api 与 /tiles 代理到 8080
│   └── scripts/verify-*.mjs                # 6 个「源码级回归验证」脚本（面试加分项）
│
├── docs/
│   ├── api.md                              # 接口文档（465 行）
│   ├── sql/                                # 01 建表 → 06 建筑扩展，按序执行
│   └── superpowers/                        # 设计文档 + 实施计划（学「怎么设计」的范本）
└── README.md                               # 必读：技术栈 + 6 条关键约束 + 面试亮点
```

### 1.5 核心功能与对应代码（背下这张表，面试能救命）

| 功能 | 前端入口 | 后端入口 | 数据库 |
|---|---|---|---|
| 建筑白模拉伸 | `utils/cesium.js#loadBuildings` (L120) | `SpatialController#getGeoJson` | `ST_AsGeoJSON` |
| 点击建筑弹窗 | `CesiumViewer.vue#handleLeftClick` (L699) | `SpatialController#pointQuery` | `ST_Intersects` |
| 测距/测面积 | `utils/measure.js#computeEnuArea` (L71) | 无（纯前端） | — |
| 图层显隐 | `stores/map.js#setLayerVisible` (L214) | — | — |
| MVT 矢量瓦片 | 未在前端主流程（可扩展） | `TileController` + `TileMapper.xml` | `ST_AsMVT` |
| 航线规划 | `RoutePlanPanel.vue` → `api/route.js` | `RouteServiceImpl#plan` (L43) | `pgr_astar` |
| 限飞区避让 | `utils/cesium.js#loadNoFlyZones` | `RouteServiceImpl` Step 8 | `ST_Intersects` |
| 无人机实时推进 | `CesiumViewer.vue#syncDronePositions` (L386) | `OrderServiceImpl` + 定时任务 | — |
| 配送统计 | `DeliveryStats.vue` | `OrderServiceImpl#getDeliveryStats` | SQL 聚合 |

---

## 二、技术栈解析：每样技术到底在干嘛

> 这一节是「速查词典」。学习日志里遇到不懂的词，回这里看。

### 2.1 GIS 基础概念（不懂这些，代码看懂也是假的）

| 概念 | 大白话解释 | 本项目中的样子 |
|---|---|---|
| **WebGIS** | 把 GIS 搬到浏览器。地图能缩放、能点、能算 | 整个前端 |
| **矢量数据** | 用点/线/面 + 坐标描述地物 | 建筑=面，道路=线 |
| **栅格数据** | 一格一格的像素图（卫星影像、瓦片） | 高德影像底图 |
| **WGS84 / SRID 4326** | 用经纬度表示地球位置的标准 | 所有 geom 列都是 4326 |
| **Web Mercator / 3857** | 把地球摊平成平面图的投影，单位是米 | MVT 瓦片计算时转换 |
| **GeoJSON** | 用 JSON 写地理数据的格式 | 后端 `ST_AsGeoJSON` 输出，前端 `JSON.parse` 后喂给 Cesium |
| **瓦片（Tile）** | 把地图切成 z/x/y 小方块按需加载 | `/tiles/{table}/{z}/{x}/{y}.mvt` |
| **MVT** | Mapbox Vector Tile，瓦片里装的是**矢量**不是图片 | `ST_AsMVT` 生成 |
| **geography vs geometry** | geometry 按平面算（单位=度），geography 按球面算（单位=米） | 算距离/面积必须先转 geography |
| **缓冲区（Buffer）** | 以点为中心画个圈，找圈里的东西 | 食堂覆盖圈、`ST_DWithin` |
| **空间索引（GiST）** | 让「找相交的图形」从全表扫描变成走索引 | `geom && bbox` 预过滤 |

> **最容易犯的错**：`ST_DWithin(geom, point, 100)` 传 `geometry` 时，100 的单位是**度**（≈1 万公里），不是米！必须 `geom::geography`。项目 `SpatialQueryMapper.xml` L50–55 专门写了注释警告。

### 2.2 Cesium 核心概念

| 概念 | 说明 | 项目位置 |
|---|---|---|
| `Viewer` | 三维地球主对象，整个场景的入口 | `stores/map.js#initViewer` |
| `DataSource` / `GeoJsonDataSource` | 一批实体的容器（一个图层一个） | `utils/cesium.js#loadBuildings` |
| `Entity` | 一个可绘制对象（多边形、线、图标、标签） | 同上 |
| `Cartesian3` | 三维世界坐标（地心直角坐标，不是经纬度） | 到处都是 |
| `Cartographic` | 经纬度+高度的弧度制表示 | `computeDistance` |
| `ScreenSpaceEventHandler` | 鼠标/键盘事件入口 | `CesiumViewer.vue#registerClickHandler` |
| `scene.pick` | 用屏幕坐标反查点到了哪个实体 | 悬停高亮 |
| `scene.pickPosition` | 用屏幕坐标反查三维交点 | `resolvePickPosition` |
| `postRender` / `postUpdate` | 每帧渲染前后的回调钩子 | 平滑移动动画 |
| `extrudedHeight` | 把多边形从地面「拉」成体块 | 建筑白模 |
| `clampToGround` | 让图形贴在（起伏的）地形表面 | 描边线 |
| `DataSourceCollection.add()` | **异步**的！不 await 就 `getByName` 会查空 | `addBuildingOutlines` |

### 2.3 Vue3 / Pinia 核心概念

| 概念 | 说人话 |
|---|---|
| `ref` / `reactive` | ref 包基本类型，reactive 包对象；改了会自动更新页面 |
| `shallowRef` / `shallowReactive` | **只**跟踪最外层，不递归代理内部对象 |
| `computed` | 派生值，依赖变了自动重算 |
| `watch` | 监听变化执行副作用（本项目用来切测量模式、切面板） |
| `onMounted` / `onBeforeUnmount` | 组件挂载后 / 卸载前（清理事件、定时器、Viewer） |
| `<script setup>` | Vue3 组合式 API 的语法糖，写起来像普通 JS |
| `markRaw` | 给对象打标记：永远不要变成响应式代理 |

### 2.4 Spring Boot / MyBatis 核心概念

| 概念 | 说人话 |
|---|---|
| `@RestController` | 这个类的返回值直接变 JSON |
| `@RequestMapping` / `@GetMapping` | 接口路由前缀 / GET 映射 |
| `@RequestParam` / `@PathVariable` | 取 URL 里的 `?a=1` / `/a/1` |
| `@Valid` | 触发 DTO 上的校验注解 |
| `@Service` / `@Mapper` | 交给 Spring 管理的服务层 / 数据层 |
| `@RequiredArgsConstructor` | Lombok：给 final 字段生成构造器 → 依赖注入 |
| `@PostConstruct` | 构造后执行一次（本项目用来预热图层元数据缓存） |
| `@Transactional` | 包在一个事务里，异常自动回滚 |
| `LambdaQueryWrapper` | MyBatis-Plus 的链式条件构造器 |
| `${}` vs `#{}` | `${}` 是字符串拼接（有 SQL 注入风险！），`#{}` 是预编译占位符 |
| `@Select` / XML | 注解写简单 SQL，XML 写复杂动态 SQL |
| `Result<T>` | 统一响应包装 `{code, message, data}` |

### 2.5 数据流：一次「点击教学楼」的完整旅程

```
① 用户在三维地球上点击一栋楼
   CesiumViewer.vue → ScreenSpaceEventHandler LEFT_CLICK
② 屏幕坐标 → 三维世界坐标（三级兜底）
   resolvePickPosition: pickPosition → globe.pick → pickEllipsoid
③ 世界坐标 → 经纬度
   Cartographic.fromCartesian → Math.toDegrees
④ 先试实体拾取：scene.pick 拿到 entity，读 entity._buildingType
   命中 → 直接用（不用请求后端）
⑤ 兜底：拿经纬度请求后端点选
   GET /api/spatial/point-query?table=teaching_building&lng=..&lat=..
⑥ 后端校验表名白名单 → MyBatis 执行 SQL
   WHERE ST_Intersects(geom, ST_SetSRID(ST_MakePoint(lng,lat),4326))
⑦ 返回 {id, name, height, dept_name, description, area_sqm, geom}
⑧ 前端 BuildingPopup.vue 显示弹窗
   - 照片按 public/buildings/{表名}-{id}.jpg 约定取图，缺图回退占位图
   - 弹窗位置：worldToWindowCoordinates 每帧重算 → 保证跟随地球旋转
```

> **面试金句**：这个功能我做了**三级兜底**和**双重定位**——拾取失败就降级，坐标失效就用形心反查，保证「点了楼一定出弹窗」。

---

## 三、30 天学习日志

### 每天怎么用这页

```
【学习目标】今天结束后你应该会做什么
【核心概念】要理解的名词
【项目对照】打开哪个文件、看哪几行
【课后实践题】先自己做（盖住答案）
【参考答案 + 解析】为什么这么写、错在哪
【验证方法】怎么证明你做对了
【自测清单】全打勾才进下一天
```

---

## Day 1｜认识 WebGIS + 把项目跑起来

### 学习目标
- 说清 WebGIS 和普通 Web 的区别
- 在自己的电脑上把**前端 + 后端 + 数据库**全部跑起来，看到三维校园
- 学会用 `README.md` 当「项目说明书」

### 核心概念
- **WebGIS**：Web + GIS。三维地球、地图缩放、点击查要素、空间分析，都在浏览器里完成。
- **前端 / 后端 / 数据库** 三层分工（见 1.2 节）。
- **Cesium**：浏览器里的三维地球引擎，基于 WebGL。它认识的是**真实经纬度**，所以能跟真实世界对齐——这就是「数字孪生」的基础。

### 项目对照
1. `README.md` 第 5–17 行：技术栈表与版本（注意 Cesium 钉死 1.145.0）
2. `README.md` 第 82–130 行：项目结构
3. `README.md` 第 132–247 行：环境要求 + 快速启动
4. `启动后端.bat` / `启动前端.bat`（或 `start-backend.bat` / `start-frontend.bat`）
5. `frontend/vite.config.js` 第 13–26 行：代理配置（为什么前端 5173 能调到后端 8080）

### 课后实践题

**题 1**：按 README 把项目跑起来。要求：前端打开 `http://localhost:5173` 能看到三维校园；后端访问 `http://localhost:8080/api/spatial/layers` 有 JSON 返回。
**题 2**：用一句话分别解释 `package.json`、`vite.config.js`、`pom.xml`、`application.yml` 各自是干嘛的。
**题 3**：既然前端跑在 5173、后端跑在 8080，为什么前端代码里写 `axios` 请求 `/api/...` 就能拿到数据，而不用写 `http://localhost:8080/api/...`？

### 参考答案 + 解析

**题 1 答案要点**：三个终端/双击三件事——数据库服务 → `启动后端.bat` → `启动前端.bat`。
- 后端成功的标志：控制台出现 `Tomcat started on port 8080` 和 `图层元数据缓存初始化完成，共 8 个图层`。
- 前端成功的标志：终端出现 `Local: http://localhost:5173/`。
- **解析**：`图层元数据缓存初始化完成，共 8 个图层` 这行日志来自 `SpatialServiceImpl#init`（`@PostConstruct`），说明**后端真的连上数据库了**。如果这行没出现，问题 100% 在数据库连接，不用去查前端。

**题 2 答案**：

| 文件 | 作用 |
|---|---|
| `frontend/package.json` | 前端「清单」：项目名、脚本命令（dev/build/lint）、依赖及版本 |
| `frontend/vite.config.js` | 前端构建与开发服务器配置：Vue 插件、Cesium 插件、`@` 别名、代理、打包分包 |
| `backend/pom.xml` | 后端 Maven 配置：Spring Boot 父版本、依赖（web/validation/mybatis-plus/postgresql/…）、Java 17 编译 |
| `backend/src/main/resources/application.yml` | 后端运行时配置：端口、profile、Jackson 命名策略、MyBatis-Plus、Swagger 路径 |

**解析**：记住这个对应关系——`package.json ↔ pom.xml`（依赖），`vite.config.js ↔ application.yml`（运行配置）。

**题 3 答案**：
```js
// frontend/vite.config.js
server: {
  proxy: {
    '/api':   { target: 'http://localhost:8080', changeOrigin: true },
    '/tiles': { target: 'http://localhost:8080', changeOrigin: true }
  }
}
```
**解析**：Vite 开发服务器把以 `/api`、`/tiles` 开头的请求**转发**到 8080。好处有三：
1. 前端代码里 URL 永远是 `/api/xxx`，部署时不用改；
2. 浏览器眼里所有请求都是「同源」的（都来自 5173），**绕开了跨域限制**；
3. 生产环境交给 Nginx 做同样的转发即可，代码零改动。
> 追问预警：**那后端的 CORS 配置还要不要？** 要（`config/CorsConfig.java`），因为直连 8080 的场景（Swagger、Postman、其他域名前端）仍然存在。

### 验证方法
```powershell
# 后端接口
curl http://localhost:8080/api/spatial/layers
# 期望：{"code":200,"message":"success","data":[{"table_name":"school",...}, ... 8 个]}
```
浏览器打开 5173，应该看到：黄边校园边界、蓝/橙/绿三色建筑白模、黑白道路线、半透明运动场地。

### 自测清单
- [ ] 三层架构能画出来并解释各层职责
- [ ] 项目能跑起来，前后端接口连通
- [ ] 能说出 `layers` 接口返回了 8 个图层，分别是什么
- [ ] 知道 Vite 代理解决了什么问题

---

## Day 2｜空间数据库基础：PostGIS 与空间 SQL

### 学习目标
- 理解点/线/面三种矢量几何
- 会用 `ST_Intersects`、`ST_DWithin`、`ST_Distance`、`ST_Area`、`ST_AsGeoJSON`
- 理解「为什么算距离必须先转 geography」

### 核心概念
- **SRID 4326**：WGS84 经纬度坐标系。本项目所有 geom 都是 4326。
- **geometry vs geography**：
  - `geometry`：平面坐标运算。对 4326 数据来说，单位是**度**。
  - `geography`：球面坐标运算，单位是**米**。算距离/面积/缓冲必须用它。
- **空间索引 GiST**：为「相交判断」优化的索引结构。走索引的关键是让条件写成可用索引的形式（见 Day 11 的 `&&`）。

### 项目对照
1. `backend/src/main/resources/mapper/SpatialQueryMapper.xml` L29–48：点选查询
2. 同文件 L50–75：缓冲区查询（**重点看 L51–55 的注释**）
3. 同文件 L129–140：校园边界与中心点
4. `docs/sql/01_create_tables.sql`：业务表建表脚本
5. `docs/sql/04_verify_data.sql`：数据验证查询

### 课后实践题

**题 1**：写 SQL 查出所有宿舍楼的名称、楼层数，按楼层从高到低排序。
**题 2**：写 SQL 查询坐标点 `(114.4682, 37.9842)` 周围 **200 米**内的所有教学楼，返回名称和距离（米），按距离升序。
**题 3**：写 SQL 统计三类建筑（`teaching_building` + `dormitory` + `other_buildings`）的总数量和总占地面积（平方米）。
**题 4**：把下面这条错误 SQL 改对，并说明错在哪：
```sql
SELECT name FROM teaching_building
WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(114.4682, 37.9842), 4326), 100);
```

### 参考答案 + 解析

**题 1**
```sql
SELECT name, height FROM dormitory ORDER BY height DESC;
```
**解析**：`height` 在本项目语义是**楼层数**（不是米）。前端 `utils/cesium.js` L9 定义 `FLOOR_HEIGHT = 3.5`，`loadBuildings` 里用 `height * FLOOR_HEIGHT` 当拉伸高度——所以层高换算是**前端**做的，数据库只存层数。这是一处很典型的「数据口径」设计，面试可以主动提。

**题 2**
```sql
SELECT
    name,
    ROUND(ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint(114.4682, 37.9842), 4326)::geography
    )::numeric, 2) AS distance_m
FROM teaching_building
WHERE ST_DWithin(
    geom::geography,
    ST_SetSRID(ST_MakePoint(114.4682, 37.9842), 4326)::geography,
    200
)
ORDER BY distance_m ASC;
```
**解析**：三个关键点：
1. `ST_MakePoint(lng, lat)` **先经度后纬度**，写反了会查到地球另一边；
2. `ST_SetSRID(..., 4326)` 给它贴上坐标系标签，否则和 geom 列坐标系不匹配会报错；
3. `::geography` 把两边都转成球面类型，`ST_DWithin` 的第三个参数 200 才是**米**。
> 项目里对应代码：`SpatialQueryMapper.xml#selectByBuffer`（L56–75），返回的字段名就叫 `distance_m`。

**题 3**
```sql
SELECT
    COUNT(*) AS total_count,
    ROUND(SUM(ST_Area(ST_SetSRID(geom, 4326)::geography))::numeric, 2) AS total_area_sqm
FROM (
    SELECT geom FROM teaching_building
    UNION ALL
    SELECT geom FROM dormitory
    UNION ALL
    SELECT geom FROM other_buildings
) AS all_buildings;
```
**解析**：这张 SQL（加 `height` 列后）就是 `SpatialQueryMapper.xml#selectBuildingStats` 的原型。三个要点：
- `UNION ALL` 而非 `UNION`：不需要去重，`UNION ALL` 少一次排序，更快；
- 子查询必须起别名（`AS all_buildings`），PostgreSQL 强制要求；
- `ST_Area` 也用 `geography`，否则算出来是「平方度」这种没意义的单位。
> 换个写法（超集统计）：`ST_Area(ST_Transform(geom, 3857)::geography)`。项目里统一用 `::geography`，因为 4326→geography 是球面计算，不需要投影，精度更高。

**题 4 答案与解析**
```sql
-- 正确写法
SELECT name FROM teaching_building
WHERE ST_DWithin(
    geom::geography,
    ST_SetSRID(ST_MakePoint(114.4682, 37.9842), 4326)::geography,
    100
);
```
**错在哪**：`ST_DWithin` 传入的都是 `geometry` 时，距离参数按**几何的坐标单位**解释。4326 的单位是度，所以 `100` 意味着 **100 度**——约 1 万公里，整个地球都算「在 100 米内」，查询失去意义且性能极差（无法用索引，全表地理计算）。
> 这正是项目 `SpatialQueryMapper.xml` L50–55 注释的原话警告。**面试如果问「你踩过什么坑」，这就是一个满分答案。**

### 验证方法
在 pgAdmin / psql 里逐个执行上面的 SQL；题 2 的结果应能对上项目 `/api/spatial/buffer` 接口的返回。
```powershell
curl "http://localhost:8080/api/spatial/buffer?table=teaching_building&lng=114.4682&lat=37.9842&radius=200"
```

### 自测清单
- [ ] 能不看笔记写出 `ST_DWithin` 的正确「米制」写法
- [ ] 能解释 `ST_SetSRID` 和 `ST_Transform` 的区别
- [ ] 知道项目里 `height` 是楼层数不是米
- [ ] 能在数据库里查出校园总建筑面积

---

## Day 3｜GeoJSON 与坐标转换

### 学习目标
- 看懂 GeoJSON 的 `FeatureCollection` / `Feature` / `geometry` 结构
- 理解「后端把 geom 转成字符串，前端再解析」这套约定的原因
- 会做「粗略形心」计算

### 核心概念
- **GeoJSON 结构**：
```json
{ "type": "FeatureCollection", "features": [
  { "type": "Feature",
    "geometry": { "type": "Polygon", "coordinates": [[[lng,lat],[lng,lat],...]] },
    "properties": { "id": 1, "name": "6号教学楼", "height": 6 } }
]}
```
- **coordinates 嵌套层级**（最容易搞晕）：
  - `Point` → `[lng, lat]`
  - `LineString` → `[[lng,lat], [lng,lat], ...]`
  - `Polygon` → `[ 外环, 内环(孔洞) ]`，环是点数组
  - `MultiPolygon` → `[ 多边形, 多边形 ]`，再往下才是环
  - 一句话：**每层 type 多一层中括号**。
- **坐标系基准（本项目重要约定）**：数据虽然标注 WGS84，但实际是按高德（GCJ-02）底图采集的；底图也用高德 → **两者同基准，不需要任何平移**。`stores/map.js` 里的 `dataShift` 因此恒为 0。

### 项目对照
1. `frontend/src/utils/cesium.js` L93–102：`toGeoJsonFeatureCollection`（后端行 → 标准 GeoJSON）
2. 同文件 L342–382：`getFeatureCentroid`（粗略形心）
3. `frontend/src/utils/basemap.js`：`shiftFeatureList` / `shiftPoint`（平移工具，本项目为空操作）
4. `backend/.../common/GeoJsonSupport.java`：后端 GeoJSON 处理与测试用例

### 课后实践题

**题 1**：把后端返回的一行数据转成标准 GeoJSON `FeatureCollection`。
```js
const rows = [
  { id: 1, name: '6号教学楼', height: 6, geom: '{"type":"Polygon","coordinates":[[[114.46,37.98],[114.47,37.98],[114.47,37.99],[114.46,37.98]]]}' }
]
```
**题 2**：写一个函数 `countVertices(geom)`，输入任意 Polygon / MultiPolygon 的 GeoJSON 对象，返回顶点总数（只数外环）。
**题 3**：下面这段代码有什么问题？修好它。
```js
function centroid(geomStr) {
  const geom = JSON.parse(geomStr)
  return [geom.coordinates[0][0], geom.coordinates[0][1]]
}
```
**题 4**：为什么后端不直接把 geom 当二进制对象传，而要用 `ST_AsGeoJSON` 转成字符串？

### 参考答案 + 解析

**题 1**
```js
export function toGeoJsonFeatureCollection(features) {
  return {
    type: 'FeatureCollection',
    features: features.map(f => ({
      type: 'Feature',
      geometry: typeof f.geom === 'string' ? JSON.parse(f.geom) : f.geom,
      properties: { ...f, geom: undefined }
    }))
  }
}
```
**解析**：三处设计值得注意：
1. **兼容字符串与对象**：后端返回字符串（JDBC 拿到的就是文本），但测试/其他调用方可能直接给对象，所以判断一次类型；
2. **`properties` 里带上原字段**：这样 Cesium 实体的 `entity.properties.height.getValue()` 就能读到楼层数——`loadBuildings` 正是这么用的；
3. **`geom: undefined`**：把几何从 properties 里摘掉。不然同一个几何既在 `geometry` 又在 `properties.geom`，数据体积翻倍；而且 `undefined` 的属性在 `JSON.stringify` 时会被自动丢弃。
> 项目实现：`frontend/src/utils/cesium.js` L93–102。

**题 2**
```js
export function countVertices(geom) {
  if (!geom) return 0
  const rings = []
  if (geom.type === 'Polygon') {
    if (geom.coordinates?.[0]) rings.push(geom.coordinates[0])
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates || []) {
      if (poly?.[0]) rings.push(poly[0])
    }
  }
  return rings.reduce((sum, ring) => sum + ring.length, 0)
}
```
**解析**：这段逻辑和 `utils/cesium.js#addBuildingOutlines`（L186–196）的取环写法**完全一致**。关键点是「只取外环」——校园建筑没有孔洞，所以 `coordinates[0]` 就够；MultiPolygon 要多遍历一层。写 GIS 代码时，**先把「环」这个概念厘清**，后面画线、算中心、算面积都靠它。

**题 3 答案与解析**
```js
// 问题1：只取了第一个点，这不是形心，是「外环首点」，而且首点通常是个角点
// 问题2：MultiPolygon 时 geometries[0][0][0] 的结构完全不同，会取错
// 问题3：JSON.parse 失败没兜底，一处脏数据就让整个地图加载中断

export function centroid(geomStr) {
  let geom = geomStr
  if (typeof geom === 'string') {
    try { geom = JSON.parse(geom) } catch (e) { return null }
  }
  if (!geom || !geom.type) return null

  let rings = []
  if (geom.type === 'Polygon') {
    rings = geom.coordinates?.[0] ? [geom.coordinates[0]] : []
  } else if (geom.type === 'MultiPolygon') {
    rings = (geom.coordinates || []).map(p => p?.[0]).filter(Boolean)
  }
  if (!rings.length) return null

  let sumLng = 0, sumLat = 0, count = 0
  for (const ring of rings) {
    for (const c of ring) {
      if (!Array.isArray(c) || c.length < 2) continue
      sumLng += c[0]; sumLat += c[1]; count++
    }
  }
  return count ? [sumLng / count, sumLat / count] : null
}
```
**解析**：
- 这个「算术平均」不是严格意义上的几何形心（没用面积加权，也没处理孔洞），但项目里它的用途是**点击兜底时反查要素**——只要落在轮廓内部就够用。**用够用的精度换代码简单性，是工程取舍，面试可以讲**。
- 三个防御点：字符串解析 try/catch、type 判断、坐标合法性检查。项目 `getFeatureCentroid`（L352–382）一模一样。
- 环的首尾点重复（GeoJSON 规范要求闭合），这里没去重——注释里明说了「权重偏差可忽略」。**知道自己在妥协什么，比写出完美代码更重要**。

**题 4 答案**：
1. **跨语言通用**：GeoJSON 是文本标准，Java / JS / Python 都能读，不绑定某一种几何库。
2. **不引入重型依赖**：项目 `pom.xml` L59–66 明确注释：**移除了 `postgis-jdbc` 依赖**，因为所有几何都走 GeoJSON 文本往返，从来没注册 `PGgeometry` 的 TypeHandler，那是个死依赖。
3. **调试友好**：接口返回的 JSON 粘到 geojson.io 就能看图，排查问题极快。
4. **代价**：文本比二进制大（约 2–3 倍），超大图层会有带宽压力——所以项目才另做了 **MVT 瓦片**接口（Day 11）作为性能方案。
> **注意坑**：因为 JDBC URL 没设 `stringtype=unspecified`，所以**新增几何写入时必须用 `ST_GeomFromGeoJSON(...)` 包装**，不能直接传字符串参数。这条写在 `pom.xml` 注释里。

### 验证方法
把 `/api/spatial/geojson/teaching_building` 的返回粘到 https://geojson.io ，应该能看到一栋栋教学楼的多边形轮廓。

### 自测清单
- [ ] 能说出 Polygon 的 coordinates 有几层中括号
- [ ] 能解释 `properties: { ...f, geom: undefined }` 里 `geom: undefined` 的作用
- [ ] 知道项目为什么不引入 postgis-jdbc
- [ ] 能写出带防御的 GeoJSON 解析函数

---

## Day 4｜环境与 SQL 脚本：把数据装进数据库

### 学习目标
- 按序执行 `docs/sql/` 下的脚本，理解每步在干什么
- 学会用「数据验证脚本」确认环境正确
- 理解 profile（local / prod）与 fail-fast 设计

### 核心概念
- **建表脚本 vs 种子脚本**：`01_create_tables.sql` 定结构，`02_seed_data.sql` 灌数据，`04_verify_data.sql` 验数据。
- **幂等脚本**：反复执行结果一致（`DROP TABLE IF EXISTS`、`CREATE INDEX IF NOT EXISTS`）。
- **Profile**：Spring Boot 的不同环境配置，`local` 本地开发、`prod` 生产。
- **fail-fast**：缺关键配置就**启动失败**，而不是「启动了但接口全 500」。

### 项目对照
1. `docs/sql/01_create_tables.sql`：6 张业务表 + 注释
2. `docs/sql/05_setup_pgrouting_navigation.sql`：导航网格生成（**今天先看结构，Day 27 再看算法**）
3. `docs/sql/04_verify_data.sql`：验证查询
4. `backend/src/main/resources/application.yml` L9–13（profile）、L36–43（业务开关）
5. `backend/src/main/resources/application-prod.yml`：fail-fast 与 Swagger 关闭
6. `backend/src/main/java/com/campus/twin/config/DataCleanupRunner.java`：为什么要默认关闭

### 课后实践题

**题 1**：按顺序执行 `docs/sql/` 里 01→06 脚本，然后写一条 SQL 验证：餐厅表、商品表、无人机表、订单表各有几行数据？
**题 2**：`application.yml` 里 `campus.cleanup.enabled` 默认是 `false`。请解释：为什么这个「数据清理」功能不适合默认开启？
**题 3**：生产 profile 在启动阶段强制取一条数据库连接。这样做解决了什么问题？
**题 4**：给 `delivery_order` 表写一条查询：统计每种状态的订单数量，并按数量降序排列。

### 参考答案 + 解析

**题 1**
```sql
SELECT 'restaurant' AS tbl, COUNT(*) FROM restaurant
UNION ALL SELECT 'product',   COUNT(*) FROM product
UNION ALL SELECT 'drone',     COUNT(*) FROM drone
UNION ALL SELECT 'delivery_order', COUNT(*) FROM delivery_order;
```
**解析**：用 `UNION ALL` 把多条统计拼成一张表，是排查环境的标准手法。项目 `docs/sql/04_verify_data.sql` 就是这个思路的扩展版。
> 判环境是否 OK 的更硬指标：后端启动日志里 `图层元数据缓存初始化完成，共 8 个图层`，以及 `/api/spatial/layers` 每层的 `count` 都不是 0。

**题 2 答案**：
因为它是**破坏性操作**——会改写业务数据：把超期配送中的订单置为 `cancelled`、修正航线与无人机状态、把空闲无人机挪回食堂。
- 如果默认 `true`：每次重启后端都会「悄悄改数据」。开发者调一个别的功能，回头发现订单被改了，排查成本极高、责任不清。
- 项目做法：默认 `false`，需要时用环境变量 `CAMPUS_CLEANUP_ENABLED=true` 显式打开，并且写清楚「请谨慎使用」。
**解析**：这是**工程安全原则**——「危险操作必须显式启用（opt-in），不能默默执行」。同类设计还有：`application-prod.yml` 要求必须提供数据库环境变量，否则启动失败。
> 面试加分说法：「我把危险操作设计成显式开关 + 默认关闭 + 日志留痕，而不是让它默认跑。」

**题 3 答案**：
解决「**假启动**」问题：没有这条校验时，可能出现「Spring 启动成功、日志一片绿、但所有接口 500、定时任务静默报错」的危险状态——因为数据源是**懒加载**的，只有第一次真用才连库。
**解析**：项目用 `resources/db/validate-connection.sql` 在启动阶段强制取一条连接。这叫 **fail-fast（快速失败）**：**问题越早暴露，修复成本越低**。部署到服务器时，最怕的就是「看起来启动成功了」。
> 反面案例对比：`prod` 关闭 Swagger（`application-prod.yml`），避免接口文档对外暴露——同样是「生产环境安全加固」的一部分。

**题 4**
```sql
SELECT status, COUNT(*) AS cnt
FROM delivery_order
GROUP BY status
ORDER BY cnt DESC;
```
**解析**：`GROUP BY` 后面必须跟所有非聚合列（这里是 `status`）。项目的订单状态有 5 种：`pending`（待接单）/ `assigned`（已分配）/ `delivering`（配送中）/ `delivered`（已送达）/ `cancelled`（已取消）。
> 更进一步的统计（项目真实实现）：`OrderServiceImpl#getDeliveryStats` 里**把聚合全部下推到 SQL**。原写法是 `orderMapper.selectList(null)` 把整张订单表读进内存再遍历——订单表只增不删（已 6000+ 行），那样写会随数据量线性劣化。**这是「内存遍历 vs SQL 聚合」的经典优化案例，务必记住。**

### 验证方法
```powershell
psql -U postgres -d shp_data -f docs/sql/01_create_tables.sql
# ... 依次 02 ~ 06
psql -U postgres -d shp_data -f docs/sql/04_verify_data.sql
```
再启动后端，看到 `图层元数据缓存初始化完成，共 8 个图层`。

### 自测清单
- [ ] 6 个 SQL 脚本按序执行成功，无报错
- [ ] 能解释「幂等」和「fail-fast」
- [ ] 能说出危险操作为什么要默认关闭
- [ ] 能写出按状态分组的订单统计 SQL

---

## Day 5｜Java + Spring Boot 入门：第一个 REST 接口

### 学习目标
- 看懂一个 Controller 从请求到响应的完整链路
- 理解依赖注入（DI）和控制反转（IoC）
- 会写一个自己的查询接口

### 核心概念
- **IoC / DI**：对象不用自己 `new`，Spring 容器帮你造好、塞进来。`@RequiredArgsConstructor` + `final` 字段就是最省事的注入写法。
- **分层**：Controller（接参/返回）→ Service（业务）→ Mapper（取数）。**每层只干自己的事**。
- **统一响应**：所有接口都返回 `Result<T>` = `{code, message, data}`，前端拦截器才能统一处理。

### 项目对照
1. `backend/.../CampusTwinApplication.java`：启动类
2. `backend/.../controller/SpatialController.java` 全文（91 行，最适合入门）
3. `backend/.../common/Result.java` + `ResultCode.java`
4. `backend/.../common/GlobalExceptionHandler.java`：全局异常 → HTTP 状态码
5. `backend/.../config/CorsConfig.java`

### 课后实践题

**题 1**：读 `SpatialController.java`，列出它的 5 个接口：HTTP 方法、URL、参数、返回值类型。
**题 2**：新增一个接口 `GET /api/spatial/count/{table}`，返回该表的记录数。写出 Controller 方法（假设 Service 已有 `countByTable(String table)`）。
**题 3**：为什么 `SpatialController` 的方法里没有 `new SpatialServiceImpl()`？如果这样写会有什么问题？
**题 4**：`Result.success(data)` 和 `Result.success("未查询到要素", null)` 两种重载分别用在什么场景？

### 参考答案 + 解析

**题 1 答案**

| # | 方法 | URL | 参数 | 返回 |
|---|---|---|---|---|
| 1 | GET | `/api/spatial/layers` | 无 | `Result<List<LayerMeta>>` |
| 2 | GET | `/api/spatial/point-query` | `table`, `lng`, `lat` | `Result<Map<String,Object>>` |
| 3 | GET | `/api/spatial/buffer` | `table`, `lng`, `lat`, `radius`(默认100) | `Result<List<Map<String,Object>>>` |
| 4 | GET | `/api/spatial/geojson/{table}` | 路径参数 `table` | `Result<List<Map<String,Object>>>` |
| 5 | GET | `/api/spatial/building/{table}/{id}` | 路径 `table`,`id` | `Result<Map<String,Object>>` |
| 6 | GET | `/api/spatial/campus-bounds` | 无 | `Result<Map<String,Object>>` |

（实际是 6 个，题面说 5 个是为了让你自己数——**自己发现数量不对，也是一种能力**。）

**题 2**
```java
@Operation(summary = "统计表记录数")
@GetMapping("/count/{table}")
public Result<Integer> countByTable(
        @Parameter(description = "表名", required = true) @PathVariable String table) {
    return Result.success(spatialService.countByTable(table));
}
```
**解析**：三个要点：
1. `@PathVariable` 对应 URL 里的 `{table}`，`@RequestParam` 对应 `?table=...`，别记混；
2. **Service 层必须做白名单校验**（`spatialService.countByTable` 内部调 `validateTable`），不能因为「只是个 count」就省掉——`${table}` 拼进 SQL 就是注入点；
3. `@Operation` + `@Parameter` 是 springdoc 注解，Swagger UI 上会自动生成文档，**养成习惯，这是团队协作的礼貌**。

**题 3 答案**：
因为 Spring 通过 `@RequiredArgsConstructor` 生成的构造器把 `SpatialService` 实例**注入**进来了（IoC）。
自己 `new` 的问题：
1. **无法替换实现**：想换成 Mock 做单元测试就改不动（项目 `SpatialServiceImplTest` 正是靠注入 Mock 才测得动）；
2. **丢失容器能力**：`@Transactional`、AOP、生命周期回调全部失效；
3. **单例变多例**：每次请求 new 一个，浪费内存；
4. **耦合死**：Controller 直接依赖具体类 `SpatialServiceImpl`，而不是接口 `SpatialService`，违反依赖倒置。
**解析**：这是 Spring 面试必问题。一句话总结：**「面向接口编程 + 容器管理生命周期」**。

**题 4 答案**：
```java
// 场景1：有数据，正常返回
return Result.success(result);

// 场景2：业务上「查不到」但不是错误
if (result == null) {
    return Result.success("未查询到要素", null);
}
```
- 第一种：`code=200, message="success", data=结果`。
- 第二种：`code=200`（HTTP 也是 200），但 `message` 是业务提示、`data` 是 null。前端拿到 `data=null` 就知道「用户点了空白处」。
**解析**：关键区分——**「查不到」不是「出错」**。
- 查不到 → HTTP 200 + data null（用户点了空地，正常交互）
- 参数非法 → HTTP 400（`IllegalArgumentException` 被 `GlobalExceptionHandler` 转）
- 资源不存在 → HTTP 404（`ResourceNotFoundException`，如 `getById` 查不到）
- 系统异常 → HTTP 500
> 项目 `request.js` L20–27 的注释专门说了这个变化：**「后端现在按业务语义返回真实 HTTP 状态码（400/404/500），不再一律返回 HTTP 200 + body 内 code。因此失败分支必须解析 body」**。这是很专业的接口设计，面试可以直接讲。

### 验证方法
启动后端 → 打开 `http://localhost:8080/swagger-ui.html` → 找到「空间查询接口」→ 点 `Try it out` 自己调一遍。

### 自测清单
- [ ] 能画出 Controller → Service → Mapper 的调用链
- [ ] 能解释 IoC/DI 解决了什么问题
- [ ] 能区分 `@RequestParam` 和 `@PathVariable`
- [ ] 知道「查不到」和「出错」的 HTTP 语义区别

---

## Day 6｜参数校验与全局异常处理

### 学习目标
- 会用 `@Valid` + JSR-380 注解校验请求体
- 理解全局异常处理器如何把异常翻译成 HTTP 状态码
- 知道「校验 starter 必须显式引入」这个坑

### 核心概念
- **JSR-380 / Bean Validation**：Java 的参数校验标准。注解有 `@NotNull`、`@NotBlank`、`@Min`、`@Max`、`@DecimalMin` 等。
- **`@Valid` vs `@Validated`**：`@Valid` 是标准注解（用在方法参数上触发校验），`@Validated` 是 Spring 的增强版（支持分组校验，用在类上）。
- **异常 → 状态码映射**：不写处理器的话，所有异常都是 500，前端无法区分「你参数错了」和「服务器炸了」。

### 项目对照
1. `backend/pom.xml` L34–43：**为什么必须显式引入 `spring-boot-starter-validation`**
2. `backend/.../dto/RoutePlanRequest.java`：航线请求的校验注解
3. `backend/.../dto/OrderCreateRequest.java`：下单请求的校验
4. `backend/.../common/GlobalExceptionHandler.java`（8KB，重点看 `@ExceptionHandler` 各分支）
5. `backend/.../common/ResultCode.java`

### 课后实践题

**题 1**：读 `RoutePlanRequest.java`，写出它用了哪些校验注解、各自约束什么。
**题 2**：为「创建订单」写一个 DTO 片段，要求：餐厅 ID 必填且 >0、宿舍 ID 必填且 >0、收件人姓名非空且长度 2–20、备注长度不超过 255。
**题 3**：`pom.xml` 里注释说 `spring-boot-starter-validation` **不是** `spring-boot-starter-web` 的传递依赖，必须显式声明。如果不声明会发生什么？为什么这种 bug 特别难查？
**题 4**：用户提交 `{"lng": 200, "lat": 999}`（非法经纬度），你希望返回 HTTP 400 并提示「经度必须在 -180 到 180 之间」。请写出 DTO 注解和异常处理方法。

### 参考答案 + 解析

**题 1 答案**（`RoutePlanRequest`）：经纬度字段用 `@NotNull`（必填）+ `@DecimalMin`/`@DecimalMax` 限制经纬度合法范围；`altitude` 允许为 `null`（因为有默认高度兜底）。
**解析**：`RouteServiceImpl#plan` L48–53 有个关键注释：
```java
// 飞行高度兜底：@Valid 已拦住越界值，但 altitude 允许为 null
// （JSON 键缺失或显式传 null），此处统一回落到默认高度，
// 避免下游 BigDecimal.valueOf(null) 拆箱 NPE
double effectiveAltitude = request.getAltitude() != null ? request.getAltitude() : DEFAULT_ALTITUDE_M;
```
**这两行教了两个知识点**：
1. **校验与兜底分工**：`@Valid` 管「给了但非法」，Service 管「没给」；
2. **`BigDecimal.valueOf(null)` 会拆箱 NPE**：`Double` 自动拆箱成 `double` 时，`null` 直接抛空指针。凡是包装类型转基本类型，都要先判 null。

**题 2**
```java
@Data
public class OrderCreateRequest {
    @NotNull(message = "餐厅不能为空")
    @Min(value = 1, message = "餐厅ID不合法")
    private Integer restaurantId;

    @NotNull(message = "宿舍楼不能为空")
    @Min(value = 1, message = "宿舍楼ID不合法")
    private Integer dormitoryId;

    @NotBlank(message = "收件人姓名不能为空")
    @Size(min = 2, max = 20, message = "收件人姓名长度必须在 2-20 之间")
    private String receiverName;

    @Size(max = 255, message = "备注长度不能超过 255")
    private String remark;
}
```
**解析**：
- `@NotNull` 只管 null，空字符串 `""` 算通过；字符串要用 `@NotBlank`（非 null 且去空格后非空）。**这是最常考的细节**。
- `@Size` 管长度，`@Min`/`@Max` 管数值。
- **`message` 一定要写中文业务话术**，因为它会原样返回给前端展示（见 Day 12 的 `request.js` 字段错误拼接）。

**题 3 答案**：
不声明 `spring-boot-starter-validation` 时，**校验注解会被静默忽略、完全不生效**——不报错、不警告。
**为什么难查**：因为「不生效」的表现是「非法参数照样进业务逻辑」，于是错误出现在**很远的地方**（比如数据库里写进了 `lng=200` 的脏数据，或者 Service 里 NPE），而不是在参数入口处。排查时你会盯着 Service 看半天，根本想不到是根依赖缺了。
**解析**：`pom.xml` L34–39 的原注释：
> 「该 starter **不是** spring-boot-starter-web 的传递依赖，必须显式声明，否则 @Valid / @NotNull 等注解会被静默忽略、完全不生效。」
> **这就是「配置类缺陷的典型特征：不报错，只是不生效」**。面试讲这个，展示的是你有「追根因」的习惯。

**题 4**
```java
// ① DTO 上加约束
@NotNull(message = "经度不能为空")
@DecimalMin(value = "-180.0", message = "经度必须在 -180 到 180 之间")
@DecimalMax(value = "180.0",  message = "经度必须在 -180 到 180 之间")
private Double lng;

@NotNull(message = "纬度不能为空")
@DecimalMin(value = "-90.0", message = "纬度必须在 -90 到 90 之间")
@DecimalMax(value = "90.0",  message = "纬度必须在 -90 到 90 之间")
private Double lat;

// ② Controller 参数加 @Valid
@PostMapping("/plan")
public Result<RoutePlanResponse> plan(@Valid @RequestBody RoutePlanRequest request) { ... }

// ③ 全局异常处理器捕获校验异常，返回 400 + 字段明细
@ExceptionHandler(MethodArgumentNotValidException.class)
@ResponseStatus(HttpStatus.BAD_REQUEST)
public Result<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
    Map<String, String> errors = new LinkedHashMap<>();
    for (FieldError fe : e.getBindingResult().getFieldErrors()) {
        errors.putIfAbsent(fe.getField(), fe.getDefaultMessage());
    }
    Result<Map<String, String>> r = new Result<>();
    r.setCode(400);
    r.setMessage("请求参数校验失败");
    r.setData(errors);   // { "lng": "经度必须在 -180 到 180 之间" }
    return r;
}
```
**解析**：为什么 `data` 用 `Map<String,String>` 而不是一个字符串？
因为前端 `request.js#extractFieldErrors`（L43–52）就是按 `{字段: 提示}` 解析的，它会拼成 `lng: 经度必须在...; lat: ...`。**前后端字段级错误约定**，比「一句笼统的校验失败」专业得多。
> 小技巧：用 `putIfAbsent` 保留每个字段的**第一条**错误，避免同一字段提示刷屏。

### 验证方法
用 Swagger 或 curl 发一个非法请求：
```powershell
curl -X POST http://localhost:8080/api/route/plan -H "Content-Type: application/json" -d '{\"startLng\":200,\"startLat\":999}'
```
期望：HTTP 400，body 里 `data` 含字段级错误。

### 自测清单
- [ ] 能区分 `@NotNull` / `@NotBlank` / `@NotEmpty`
- [ ] 知道校验 starter 必须显式引入，以及为什么难查
- [ ] 能写出把校验异常转成 400 + 字段明细的处理器
- [ ] 理解 Service 里「包装类型拆箱 NPE」的坑

---

## Day 7｜MyBatis-Plus 与动态 SQL

### 学习目标
- 会用 MyBatis-Plus 的基础 CRUD 和 `LambdaQueryWrapper`
- 看懂 XML 里的 `<if>` / `<include>` / `<foreach>` 动态 SQL
- **理解 `${}` 的注入风险与白名单防御**

### 核心概念
- **ORM**：对象 ↔ 表记录的映射。
- **`#{}` vs `${}`**：
  - `#{}` → JDBC 预编译占位符 `?`，**参数安全**；
  - `${}` → 直接字符串拼接，**有 SQL 注入风险**；但表名、列名不能当参数，只能用 `${}`。
- **动态 SQL**：根据条件拼 SQL。MyBatis 的 `<if>`、`<choose>`、`<foreach>`、`<include>`。
- **`map-underscore-to-camel-case`**：数据库 `create_time` → Java `createTime` 自动映射。

### 项目对照
1. `backend/.../mapper/SpatialQueryMapper.java` + `resources/mapper/SpatialQueryMapper.xml`（对照看方法名与 `<select id>`）
2. `SpatialQueryMapper.xml` L23–26：`<sql id="buildingProfileColumns">` 可复用片段
3. `SpatialQueryMapper.xml` L31–41：**列名按表名条件选择**
4. `backend/.../config/MyBatisPlusConfig.java`
5. `application.yml` L15–26：MyBatis-Plus 配置
6. `backend/.../service/impl/SpatialServiceImpl.java` L31–34：**表名白名单**

### 课后实践题

**题 1**：`SpatialQueryMapper.xml` 里为什么 `name` 列要写成 `<if test='table != "school"'>name,</if>`？不写会怎样？
**题 2**：`Service` 里为什么要用 `List<String>` 而不是 `Set.of(...)` 存白名单？给出至少两条理由。
**题 3**：写一个 MyBatis-Plus 查询：查 `delivery_order` 表中状态为 `delivered`、`drone_id` 为 3、按 `create_time` 倒序的前 10 条。
**题 4**：用 `<foreach>` 写一个「按 ID 列表批量查建筑」的 XML 片段，要求支持 `teaching_building` / `dormitory` / `other_buildings` 三张表，且表名必须走白名单校验。

### 参考答案 + 解析

**题 1 答案**：
因为**各表字段不一致**：
- `school` 表没有 `name` 列（只有 `id, geom, SHAPE_Leng, SHAPE_Area`）；
- `road` 表没有 `SHAPE_Area`、没有 `height`；
- 只有三张建筑表有 `height`。
不写 `<if>` 的话，查 `school` 会报 **`column "name" does not exist`**。
**解析**：XML 顶部 L6–17 就是这张「字段差异说明表」，**这是读懂这个文件的钥匙**。项目里凡是按表名分支的列，都走 `<if test='table == "xxx"'>`。
> 另一种做法是「所有表都补齐同名列」，但那样要为历史 shapefile 数据做冗余改造，不划算。**「在 SQL 层适配异构表」是更轻的选择。**

**题 2 答案**（`SpatialServiceImpl` L23–34 注释原话给了两条）：
1. **`Set.of(...)` 的迭代顺序在 JVM 规范中不作保证**。用它初始化 `layerCache` 会导致 `/api/spatial/layers` 返回的图层顺序**每次重启都可能变化**（难以复现，前端顺序也会莫名跳动）。
2. **`List` 同时充当两个角色**：白名单的 O(n) 成员判断 **+** 固定展示顺序。n=8，性能完全不是问题（O(8) 和 O(1) 的差别在纳秒级）。
**解析**：这是一道非常好的「工程思维」题。核心结论：**「有序性」是需求的一部分时，不要用无序集合，即使它查得更快。** 面试时讲这个，比讲「我会用 Set」高一个层次。

**题 3**
```java
// 方式一：LambdaQueryWrapper（类型安全，推荐）
LambdaQueryWrapper<DeliveryOrder> wrapper = new LambdaQueryWrapper<DeliveryOrder>()
        .eq(DeliveryOrder::getStatus, "delivered")
        .eq(DeliveryOrder::getDroneId, 3)
        .orderByDesc(DeliveryOrder::getCreateTime)
        .last("LIMIT 10");
List<DeliveryOrder> list = orderMapper.selectList(wrapper);

// 方式二：QueryWrapper（字符串字段名，无编译期检查，不推荐）
```
**解析**：
- `LambdaQueryWrapper` 用方法引用 `DeliveryOrder::getStatus`，**字段名写错编译就报错**；`QueryWrapper` 用字符串 `"status"`，写错了运行时才炸。
- `.last("LIMIT 10")` 是「追加到 SQL 末尾」的兜底口子，**能不用就不用**（有注入风险）；分页应该用 MyBatis-Plus 的分页插件 `Page<T>`。
> 项目里 `RouteServiceImpl#getActiveRoutes` 用的是 `flightRouteMapper.selectByStatusWithGeoJson("flying")`——**因为要带 `ST_AsGeoJSON` 这个空间函数，MyBatis-Plus 自动生成的 SQL 做不到，所以走了自定义 Mapper 方法**。这个「简单查询用 MP，复杂/空间查询手写 SQL」的分工，是很好的面试点。

**题 4**
```java
// Mapper 接口
List<Map<String, Object>> selectByIds(@Param("table") String table,
                                      @Param("ids") List<Integer> ids);
```
```xml
<select id="selectByIds" resultType="java.util.Map">
    SELECT
        id,
        <if test='table != "school"'>name,</if>
        <if test='table == "teaching_building" or table == "dormitory" or table == "other_buildings"'>height,</if>
        ST_AsGeoJSON(geom) AS geom
    FROM ${table}
    WHERE id IN
    <foreach collection='ids' item='id' open='(' separator=',' close=')'>
        #{id}
    </foreach>
</select>
```
```java
// Service：表名必须先过白名单
@Override
public List<Map<String, Object>> getByIds(String table, List<Integer> ids) {
    validateTable(table);          // ← 关键！${table} 的安全由这一行保证
    if (ids == null || ids.isEmpty()) return List.of();
    return spatialQueryMapper.selectByIds(table, ids);
}
```
**解析**：这道题把三个知识点串起来了：
1. **`${table}` 必须配白名单**：这是项目「SQL 注入防护」的核心（README 面试亮点第 9 条）。`ALLOWED_TABLES` 只有 8 个表名，其他全部抛 `IllegalArgumentException`；
2. **`#{id}` 是预编译**：`IN (...)` 的**值**永远用 `#{}`，绝不用 `${}`；
3. **空集合短路**：`ids` 为空时直接返回。否则 `<foreach>` 会拼出 `WHERE id IN ()` —— **MySQL/PostgreSQL 语法错误**。
> 项目真实应用：`NavigationMapper#checkPathCrossNoFlyZone` 就是 `<foreach>` 拼 `edgeIds` 的实例（L75–82）。

### 验证方法
打开 MyBatis 的 SQL 日志（临时把 `application.yml` 里 `log-impl` 那行注释解开），调接口，观察控制台打印的真实 SQL 与参数。

### 自测清单
- [ ] 能解释 `${}` 和 `#{}` 的区别，以及为什么表名只能用 `${}`
- [ ] 知道白名单为什么用 List 不用 Set
- [ ] 会写 `LambdaQueryWrapper` 和 `<foreach>`
- [ ] 知道复杂空间查询为什么手写 XML 而不用 MP 自动生成

---

## Day 8｜空间查询接口实战：点选与缓冲区

### 学习目标
- 完整跑通「前端传经纬度 → 后端空间 SQL → 返回要素」链路
- 理解点选查询的业务价值（点击查建筑）
- 会做参数边界校验（半径不为负、不超过上限）

### 核心概念
- **点选（Point Query）**：给一个点，返回落在它里面的要素。用 `ST_Intersects` + `LIMIT 1`。
- **缓冲区（Buffer Query）**：给一个点和半径，返回范围内的要素，按距离排序。用 `ST_DWithin` + `ST_Distance`。
- **边界防护**：任何来自外部的数值都要限幅。

### 项目对照
1. `SpatialQueryMapper.xml` L29–48（`selectByPoint`）
2. `SpatialQueryMapper.xml` L56–75（`selectByBuffer`）
3. `SpatialController.java` L49–65：**半径校验**（`MAX_BUFFER_RADIUS_M = 5000`）
4. `SpatialServiceImpl.java` L84–94：`pointQuery` / `bufferQuery`
5. `frontend/src/api/spatial.js`：前端调用封装

### 课后实践题

**题 1**：`SpatialController#bufferQuery` 里为什么要判 `radius <= 0` 和 `radius > 5000`？去掉会怎样？
**题 2**：`selectByPoint` 为什么加 `LIMIT 1`？不加会怎样？
**题 3**：实现一个新的空间查询接口：给定一个点和半径，返回**该范围内每种建筑类型的数量统计**（教学楼 X 栋、宿舍楼 Y 栋、其他 Z 栋）。写 SQL 思路。
**题 4**：前端 `api/spatial.js` 里 `getGeoJson(table)` 请求 `/api/spatial/geojson/${table}`，而 `request.js` 的 `baseURL` 是 `'/'`。请问最终请求的完整 URL 是什么？为什么不是 `http://localhost:8080/...`？

### 参考答案 + 解析

**题 1 答案**：
```java
if (radius == null || radius <= 0)      throw new IllegalArgumentException("缓冲半径必须为正数（单位：米）");
if (radius > MAX_BUFFER_RADIUS_M)       throw new IllegalArgumentException("缓冲半径不能超过 5000 米");
```
去掉的后果：
1. **`radius <= 0`**：负数半径在 `ST_DWithin` 里语义未定义（返回空或报错），前端拿到莫名其妙的空结果；`0` 也没意义。
2. **`radius` 超大**：`radius=100000000` 会让 PostgreSQL 对**整表每一行**做 geography 球面距离计算——**一个请求就把数据库 CPU 拉满**，是典型的「性能型攻击面」。
**解析**：注释原话是「非正数无意义；上界防止一次查询把整表 geography 计算拉满」。
> **通用原则**：凡是从外部来的数值参数（半径、分页 size、批量 ID 数量），都要有**下界 + 上界**双重防护。这叫输入校验，也是 DevSecOps 的基本功。

**题 2 答案**：
`LIMIT 1` 保证最多返回一条。
- **不加**：点在两栋楼重叠处（或数据有缝隙/重叠）时会返回多条，而 `SpatialServiceImpl#pointQuery` 的返回类型是 **`Map<String,Object>`（单个对象）**：
  ```java
  List<Map<String,Object>> results = spatialQueryMapper.selectByPoint(table, lng, lat);
  return results.isEmpty() ? null : results.get(0);
  ```
  代码只取 `get(0)`，但 SQL 若返回 100 条，**99 条白查白传**——多余的数据库 IO 和网络传输。
- **加上**：数据库早知道只要一条，可以在找到后立刻停止（配合空间索引尤其实在）。
**解析**：这是「**接口契约决定查询形状**」的例子：**下游只要一条，SQL 就该只取一条**。另一种设计是把返回类型改成 List，让前端自己选第一条——但那样前端反而更麻烦。**在能确定的地方定死，是减少 bug 的好办法。**

**题 3 答案**
```sql
-- 思路：三次 ST_DWithin 统计，用 UNION ALL 合成一张统计表
WITH center AS (
    SELECT ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography AS pt
)
SELECT '教学楼' AS label, COUNT(*) AS cnt
FROM teaching_building, center
WHERE ST_DWithin(geom::geography, center.pt, ?)
UNION ALL
SELECT '宿舍楼', COUNT(*)
FROM dormitory, center
WHERE ST_DWithin(geom::geography, center.pt, ?)
UNION ALL
SELECT '其他建筑', COUNT(*)
FROM other_buildings, center
WHERE ST_DWithin(geom::geography, center.pt, ?);
```
**解析**：三个要点：
1. **CTE（`WITH ... AS`）复用中心点**：避免把 `ST_MakePoint` 写三遍（也避免三次参数绑定）；
2. **`FROM table, center` 交叉连接**：因为 `center` 只有一行，等价于把那个点当常量用；也可以写成子查询 `(SELECT pt FROM center)`；
3. **三次查询不如一次带 `GROUP BY` 的查询**（如果三张表能 `UNION ALL` 起来的话）：
```sql
SELECT type_label, COUNT(*) FROM (
    SELECT '教学楼' AS type_label, geom FROM teaching_building
    UNION ALL SELECT '宿舍楼', geom FROM dormitory
    UNION ALL SELECT '其他建筑', geom FROM other_buildings
) t
WHERE ST_DWithin(t.geom::geography, ST_SetSRID(ST_MakePoint(?,?),4326)::geography, ?)
GROUP BY type_label;
```
这个版本**只算一次距离**，性能更好。**能一次查完就别查三次——减少数据库往返，是后端性能优化最廉价的手段。**
> 项目里 `SpatialQueryMapper.xml#selectBuildingStats` 就是这个 `UNION ALL` 模式的应用。

**题 4 答案**：
最终请求 URL 是 **`http://localhost:5173/api/spatial/geojson/teaching_building`**（即**相对当前页面源的地址**），由 Vite 代理转发到 `http://localhost:8080/api/spatial/geojson/teaching_building`。
**解析**：
- `baseURL: '/'` + 相对路径 `/api/...` → 浏览器按**当前页面 origin** 补全 → `http://localhost:5173/...`；
- 因为同源（5173 → 5173），**不存在跨域预检**；
- Vite 拦截 `/api` 前缀，转发到 8080（`changeOrigin: true` 把 Host 头改成目标主机）。
> 部署到生产（`dist` 托管 + Nginx）时，**Nginx 配同样的 `/api` 转发规则，前端代码一行不用改**。这就是「用相对路径」的价值。
> 追问预警：**「你怎么验证代理生效了？」** 打开浏览器 DevTools → Network，看请求的 `Remote Address` / 响应头，或者直接看 Vite 终端日志。

### 验证方法
```powershell
curl "http://localhost:8080/api/spatial/point-query?table=teaching_building&lng=114.4682&lat=37.9842"
curl "http://localhost:8080/api/spatial/buffer?table=dormitory&lng=114.4682&lat=37.9842&radius=300"
curl "http://localhost:8080/api/spatial/buffer?table=dormitory&lng=114.4682&lat=37.9842&radius=99999"   # 期望 400
```

### 自测清单
- [ ] 能说出点选查询和缓冲区查询的区别及各自函数
- [ ] 知道参数为什么要设上下界
- [ ] 能写出「范围 + 分组统计」的 SQL
- [ ] 清楚 Vite 代理下请求的真实 URL

---

## Day 9｜统一响应、全局异常与 Cors

### 学习目标
- 看懂 `Result<T>` 与 `ResultCode` 的配合
- 会写自定义异常并接入全局处理器
- 理解 CORS 到底在解决什么问题

### 核心概念
- **统一响应体**：所有接口长一个样子，前端拦截器写一次就够。
- **全局异常处理**：`@RestControllerAdvice` + `@ExceptionHandler`，把散落各处的 try/catch 收拢到一处。
- **CORS**：浏览器同源策略下的跨域放行机制。**注意：CORS 是浏览器行为，Postman/curl 不受影响。**

### 项目对照
1. `backend/.../common/Result.java`（1.8KB）
2. `backend/.../common/ResultCode.java`
3. `backend/.../common/ResourceNotFoundException.java`
4. `backend/.../common/GlobalExceptionHandler.java`（8KB，重点）
5. `backend/.../config/CorsConfig.java`
6. `frontend/src/api/request.js` L54–101：响应拦截器如何配合

### 课后实践题

**题 1**：列出 `GlobalExceptionHandler` 处理的异常类型与对应的 HTTP 状态码（先自己看代码，再看答案）。
**题 2**：新增一个业务异常 `DroneBusyException`，要求返回 HTTP 409（冲突）和消息「无人机正在配送中，无法接单」。写出异常类和处理方法。
**题 3**：`CorsConfig` 如果把 `allowedOrigins("*")` 配上 `allowCredentials(true)`，Spring 会报什么错？为什么？
**题 4**：用户在页面上看到「网络请求失败，请检查后端服务是否启动」而不是「响应错误 HTTP 500」。从 `request.js` 判断，什么情况会出现前者？

### 参考答案 + 解析

**题 1 答案**（对照 `GlobalExceptionHandler.java`）

| 异常类型 | HTTP 状态码 | 说明 |
|---|---|---|
| `MethodArgumentNotValidException` | 400 | `@Valid` 校验失败，`data` 带字段级明细 |
| `IllegalArgumentException` | 400 | 业务参数非法（表名、半径…） |
| `ResourceNotFoundException` | 404 | 资源不存在 |
| `RuntimeException` | 500 | 未分类的运行时异常 |
| `Exception` | 500 | 兜底，防止异常泄漏堆栈给前端 |

**解析**：这套映射的价值在于**前端能按状态码分流**：400 提示用户改参数、404 提示资源没了、500 记录日志 + 提示「服务异常」。
> 关键设计：兜底的 `Exception` 分支绝不会把 `e.getStackTrace()` 返回给前端（**信息泄漏风险**），只记录日志 + 返回通用文案。

**题 2**
```java
// ① 异常类
public class DroneBusyException extends RuntimeException {
    public DroneBusyException(String message) { super(message); }
}

// ② 全局处理器新增分支
@ExceptionHandler(DroneBusyException.class)
@ResponseStatus(HttpStatus.CONFLICT)   // 409
public Result<Void> handleDroneBusy(DroneBusyException e) {
    log.warn("业务冲突: {}", e.getMessage());
    return Result.error(409, e.getMessage());
}
```
**解析**：
- **为什么用 409 而不是 400**：400 是「你的请求有问题」，409 Conflict 是「你的请求没错，但**当前资源状态**不允许」——无人机正忙就是典型的资源状态冲突。**HTTP 状态码用准确，是专业度体现**。
- `@ResponseStatus` 决定 HTTP 状态码，`Result.error(...)` 决定 body 里的 `code`。**两者要一致**，否则前端按状态码判断、日志按 code 判断，会互相打架。
- 日志级别用 `warn`（业务预期内的冲突）而不是 `error`（真故障），**避免日志噪音**。

**题 3 答案**：
Spring 会抛出异常，类似：
```
java.lang.IllegalArgumentException: When allowCredentials is true,
allowedOrigins cannot contain the special value "*" since that cannot be set
on the "Access-Control-Allow-Origin" response header.
```
**为什么**：因为 `Access-Control-Allow-Origin: *` 意味着「任何网站都能带着凭证访问我的接口」。如果同时允许携带 Cookie（`allowCredentials: true`），那么**任何恶意网站都能以你的登录身份调你的接口**——CSRF 攻击面。所以规范禁止这种组合。
**正确写法**：用 `allowedOriginPatterns("*")`，或列出具体域名：
```java
registry.addMapping("/**")
        .allowedOriginPatterns("http://localhost:*")   // 开发环境
        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
        .allowedHeaders("*")
        .allowCredentials(true)
        .maxAge(3600);
```
**解析**：`maxAge(3600)` 让浏览器缓存预检结果 1 小时，**减少 OPTIONS 请求**（每个跨域请求前都会先发一次 OPTIONS 探路），对性能有实际帮助。

**题 4 答案**：
看 `request.js` L78–83：
```js
if (!error.response) {
    console.error('网络请求失败:', error.message)
    ElMessage.error('网络请求失败，请检查后端服务是否启动')
    return Promise.reject(error)
}
```
出现前者的条件是 **`error.response` 不存在**，即**根本没收到 HTTP 响应**：
1. 后端进程没启动（连接被拒绝）；
2. 网络断了 / 域名解析失败；
3. **请求超时**（`timeout: 30000`，30 秒无响应）；
4. 请求被浏览器拦截（混合内容、被广告插件拦）。
**解析**：这段设计的精妙处在于**区分「没响应」和「响应了但是错误」**：
- 没响应 → 八成是服务没起 → 提示「检查后端是否启动」（对开发者最有用的提示）
- 有响应但状态码错 → 解析 body 拿服务端消息（L85–99）
> 还有一处细节（L73–76）：`axios.isCancel(error)` 时**不弹提示**。因为组件卸载/主动 abort 导致的取消，弹「请求失败」是**假告警**，会干扰用户。**「该沉默的时候沉默」也是体验设计。**

### 验证方法
```powershell
# 触发 404
curl -i "http://localhost:8080/api/spatial/building/teaching_building/999999"
# 触发 400
curl -i "http://localhost:8080/api/spatial/point-query?table=evil_table&lng=1&lat=1"
```
观察 HTTP 状态码与 body 的 `code` 是否一致。

### 自测清单
- [ ] 能背出 `Result` 的三段结构
- [ ] 能说出 400/404/409/500 分别代表什么业务含义
- [ ] 知道 `allowCredentials` + `*` 为什么被禁
- [ ] 能从 `request.js` 反推用户看到某条提示的原因

---

## Day 10｜MVT 矢量瓦片：大数据量下的性能方案

### 学习目标
- 理解「瓦片」为什么能解决大数据量问题
- 会用 `ST_TileEnvelope` / `ST_AsMVTGeom` / `ST_AsMVT`
- **理解空间索引 `&&` 预过滤为什么是性能关键**

### 核心概念
- **瓦片金字塔**：z 层把地球切成 4^z 块，`z=0` 一块、`z=1` 四块…… 每次只请求视野里那几块。
- **MVT**：瓦片里装的是**矢量几何 + 属性**（protobuf 编码），不是图片。客户端可以改样式、可点击拾取。
- **`ST_TileEnvelope(z,x,y)`**：算瓦片的包围盒（Web Mercator 3857）。
- **`ST_AsMVTGeom(geom, bounds, extent, buffer, clip)`**：把几何转成瓦片内部坐标。
- **`ST_AsMVT(rows, layerName, extent, geomCol)`**：打包成 MVT 二进制。
- **不可索引表达式**：`ST_Intersects(ST_Transform(geom, 3857), tile)` 是**逐行做坐标变换**，索引用不上 → 全表扫描。

### 项目对照
1. `backend/src/main/resources/mapper/TileMapper.xml` 全文（59 行，**每行都是精华**）
2. `backend/.../mapper/TileMapper.java`：**`resultType="_byte[]"` 的坑**
3. `backend/.../controller/TileController.java`
4. `backend/.../service/impl/TileServiceImpl.java`

### 课后实践题

**题 1**：说出 `TileMapper.xml` 里 `bounds` / `bbox` 两个 CTE 各自的作用，以及为什么需要两个。
**题 2**：把 `WHERE t.geom && (SELECT geom FROM bbox)` 改成 `WHERE ST_Intersects(t.geom, (SELECT geom FROM bbox))`，功能上等价，性能上差多少？为什么？
**题 3**：`TileMapper.xml` 顶部注释说 `resultType` 必须写 `_byte[]` 而不是 `byte[]`。原因是什么？直接写 `byte[]` 会抛什么异常？
**题 4**：如果前端要在地图上「点击 MVT 瓦片里的建筑查详情」，你怎么实现？（提示：MVT 是矢量，能拾取）

### 参考答案 + 解析

**题 1 答案**
```sql
WITH bounds AS ( SELECT ST_TileEnvelope(#{z}, #{x}, #{y}) AS geom ),   -- ① 3857 瓦片包围盒
     bbox   AS ( SELECT ST_Transform((SELECT geom FROM bounds), 4326) AS geom )  -- ② 转回 4326
```
- `bounds`：瓦片在 **Web Mercator（3857）** 下的精确范围，给 `ST_AsMVTGeom` / `ST_AsMVT` 用（这两个函数要求 3857）。
- `bbox`：把同一个范围**转回 4326**，专门用来做 **GiST 索引预过滤**。
**为什么需要两个**：项目数据列是 `geometry(...,4326)`，索引 `idx_<table>_geom` 建在 4326 列上。`&&` 算子要命中索引，**比较的两个几何必须是同一坐标系**；如果拿 3857 的瓦片去和 4326 的列比，PostgreSQL 会隐式转换或直接不用索引。所以先转一份 4326 的 bbox。
**解析**：这是「**索引友好写法**」的教科书案例。改代码前先问自己：「这个表达式能用上索引吗？」

**题 2 答案**：
**功能几乎等价，性能差一个数量级。**
```sql
-- 慢：不可索引表达式
WHERE ST_Intersects(ST_Transform(t.geom::geometry, 3857), (SELECT geom FROM bounds))
```
- `ST_Transform(t.geom, 3857)` 是一个**逐行计算**的函数调用，它的结果没有索引。PostgreSQL 只能**对每一行都做一次坐标变换 + 几何相交判断**。
- 表有 10 万行？就是 10 万次坐标变换。**每次瓦片请求全表扫描。** 瓦片请求又极其频繁（一个视图几十上百片），数据库直接被打爆。

```sql
-- 快：充分利用索引
WHERE t.geom && (SELECT geom FROM bbox)
  AND ST_Intersects(ST_Transform(t.geom::geometry, 3857), (SELECT geom FROM bounds))
```
- `&&` 是 PostGIS 的**边界框相交算子**，它是**索引算子**，能直接走 GiST 索引。
- 执行计划变成两阶段：① 索引找出「包围盒有重叠」的少量候选行；② 只对候选行做精确相交判断。
**项目注释的原话**：
> 「此前直接用 `ST_Intersects(ST_Transform(geom,3857), tile)` 会逐行做坐标变换，属不可索引表达式 → 每次瓦片请求全表扫描。」
**解析**：这条经验值一瓶茅台：**空间查询优化的第一原则是「先粗筛（走索引），再精算」**。同类写法还有 `ST_DWithin` 前先 `&&`。
> 追问预警：**「你怎么确认索引生效了？」** → `EXPLAIN ANALYZE` 看执行计划里有没有 `Index Scan using idx_xxx_geom`。**这个命令一定要会，面试高频。**

**题 3 答案**
```xml
<select id="selectMvt" resultType="_byte[]">   <!-- 正确：下划线前缀 -->
```
`byte[]`（无前缀）会被 MyBatis 解析成 **`java.lang.Byte[]`（对象数组）**，而 Mapper 方法声明返回 `byte[]`（基本类型数组）。MyBatis 在 `MapperMethod.convertToArray` 里执行 `Array.set(byte[], i, Byte[])` 时抛：
```
java.lang.IllegalArgumentException: argument type mismatch
```
`_byte[]` 是 MyBatis **内置别名表**里的「原始类型数组」别名，指向 `byte[]`。
**解析**：这就是 `TileMapper.xml` L14–19 注释的内容。**这类「框架内置别名」的坑很隐蔽**，因为 SFC/编译都不报错，只有运行时炸。
> 泛化一下：**Java 里 `byte[]` 和 `Byte[]` 是两个完全不同的类型**，前者是原始类型数组（连续内存），后者是对象数组（每个元素都是对象引用）。涉及数组的框架映射时，一定要注意这个区别。

**题 4 答案**：
MVT 的优势正是**矢量可拾取**。Cesium 侧的实现思路（项目当前未启用，属于扩展方向）：
```js
// 思路示意：Cesium 的 MVT 支持（Cesium3DTileset / VectorTile 相关 API 或第三方库）
// 1) 请求瓦片：axios.get(`/tiles/teaching_building/${z}/${x}/${y}.mvt`, { responseType: 'arraybuffer' })
// 2) 解码 protobuf → 得到几何 + 属性（属性里就带 id / name / height）
// 3) 拾取：scene.pick 命中瓦片要素 → 直接读属性里的 id
// 4) 拿 id 调 /api/spatial/building/teaching_building/{id} 取完整详情（含照片）
```
**解析**：这条路线的关键优势是「**拾取之后不用再发一次点选请求**」——属性里已经带了 `id`，直接拿去查详情即可。
对比项目当前方案（`scene.pick` 实体 → 拿经纬度 → 调 `point-query`）：当前方案在**少量要素**时更简单直接；**要素上千**时 MVT 优势明显（传输量小、渲染批次少、拾取精确）。
> 面试表达：「我了解 MVT 的原理和 PostGIS 生成方式，也知道它的优势在于**按需加载 + 客户端样式化 + 矢量拾取**；项目因为校园要素只有几十个，用了更直观的 GeoJSON 方案——**技术选型要看数据规模**。」

### 验证方法
```powershell
# 校园大致在 114.468, 37.984 → z=16 附近
# x = floor((lng+180)/360 * 2^z)  y = floor((1 - ln(tan(lat)+sec(lat))/π)/2 * 2^z)
curl -o t.mvt "http://localhost:8080/tiles/teaching_building/16/54020/24808.mvt"
# 期望：得到二进制文件（前几个字节是 protobuf 特征），文件非空
```
也可以把 `.mvt` 拖到 https://mapbox.github.io/vector-tile-js 之类的解析工具里看几何。

### 自测清单
- [ ] 能解释瓦片金字塔 z/x/y 的含义
- [ ] 能说出 `bounds` 和 `bbox` 为什么是两个 CTE
- [ ] 知道 `&&` 是索引算子，`EXPLAIN ANALYZE` 怎么用
- [ ] 能解释 `_byte[]` 与 `byte[]` 的区别

---

## Day 11｜Vue3 基础：模板、响应式、组件

### 学习目标
- 看懂一个 `.vue` 单文件组件（SFC）的三段结构
- 会用 `ref` / `reactive` / `computed` / `watch` / 生命周期
- 能写一个带 props 和 emit 的小组件

### 核心概念
- **SFC（单文件组件）**：`.vue` 文件 = `<template>`（结构）+ `<script setup>`（逻辑）+ `<style>`（样式）。
- **响应式**：数据变了，页面自动更新。`ref(0)` 用 `.value` 读写，`reactive({})` 直接读写。
- **`v-` 指令**：`v-if`（条件渲染）、`v-for`（列表）、`v-model`（双向绑定）、`v-show`（display 切换）、`@click`（事件）、`:prop`（动态属性）。
- **生命周期**：`onMounted`（挂载后，适合初始化）、`onBeforeUnmount`（卸载前，**必须清理资源**）。

### 项目对照
1. `frontend/src/main.js`：应用启动（`createApp` + `createPinia` + ElementPlus）
2. `frontend/src/App.vue`：根组件布局
3. `frontend/src/components/Sidebar.vue`（1.8KB，最适合当入门样例）
4. `frontend/src/components/LayerPanel.vue`（8KB，`v-for` + 复选框 + store 联动）
5. `frontend/src/components/MeasureInfo.vue`（1.4KB，最简单的展示组件）

### 课后实践题

**题 1**：读 `LayerPanel.vue`，说明它是如何把「勾选复选框」变成「图层显隐」的（把数据流写出来）。
**题 2**：写一个组件 `BuildingCount.vue`：props 接收 `count`（数字），显示「当前共 N 栋建筑」；当 N 变化时，如果 N > 50 显示红色警告。
**题 3**：下面代码有什么 bug？
```vue
<script setup>
import { ref } from 'vue'
const timer = ref(null)
onMounted(() => { timer.value = setInterval(() => console.log('tick'), 1000) })
</script>
```
**题 4**：`v-if` 和 `v-show` 有什么区别？本项目的面板切换适合用哪个？

### 参考答案 + 解析

**题 1 答案**（数据流）：
```
用户点击复选框
  → v-model 或 @change 触发 handleChange(layerName, checked)
  → mapStore.setLayerVisible(layerName, checked)
  → stores/map.js：layers[layerName] = visible        （更新响应式状态，UI 同步）
  → 同函数内：const ds = dataSources[layerName]; if (ds) ds.show = visible
                                                        （★ 命令式操作 Cesium 对象）
```
**解析**：**这是本项目最核心的模式**，一定要理解：
> **「Vue 管 UI 状态，Cesium 管渲染状态，两者用 store 桥接。」**
> Vue 的响应式**管不到** Cesium 内部对象（`dataSource.show` 不是 Vue 状态），所以必须在 `setLayerVisible` 里**手动同步**。如果只改 `layers[layerName]`，UI 勾选框会变，但地图上的楼**不会消失**——这是新手最常犯的错。
> 代码位置：`stores/map.js` L214–249。

**题 2**
```vue
<!-- components/BuildingCount.vue -->
<template>
  <div class="building-count">
    <span>当前共 {{ count }} 栋建筑</span>
    <el-tag v-if="count > 50" type="danger" size="small">建筑数量偏多，注意性能</el-tag>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  count: { type: Number, default: 0, required: true }
})

// 派生状态用 computed，不要用 ref + watch 手动同步
const isTooMany = computed(() => props.count > 50)
</script>
```
**解析**：
- **`computed` 优于 `watch`**：`count` 是由 props 派生出来的，用 `computed` 自动跟随、无副作用、可缓存；用 `watch` 手写同步会多一个状态，容易忘记更新（**「不要为能算出来的东西存状态」**）。
- `defineProps` 用对象写法（带 `type` / `default` / `required`）比数组写法好——**有类型和默认值，出问题时警告更清楚**。
- `props` 是**只读**的，子组件不能改，只能 `emit` 让父组件改。

**题 3 答案**：
两个 bug：
```vue
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'   // ← bug1：onMounted 没导入

const timer = ref(null)   // ← bug2：定时器句柄不该用 ref，普通变量即可
onMounted(() => { timer.value = setInterval(() => console.log('tick'), 1000) })
onBeforeUnmount(() => {                                  // ← bug3（最严重）：没有清理
  if (timer.value) { clearInterval(timer.value); timer.value = null }
})
</script>
```
**解析**：
1. **没导入 `onMounted`**：`script setup` 里所有 API 都要显式 import，不 import 就是 `undefined is not a function`。（顺便：`unplugin-auto-import` 能自动导入，但本项目没用，老老实实 import。）
2. **定时器句柄不需要响应式**：`ref` 会给它套一层响应式代理，浪费且没必要。**「不是所有变量都要 ref，只有会影响页面的才需要」**。本项目 `CesiumViewer.vue` 里 `let droneSyncTimer = null`（L105）就是普通变量。
3. **没清理定时器**（最严重）：组件卸载后定时器还在跑，回调里访问已销毁的 Viewer → 报错 + **内存泄漏**。本项目在 `onBeforeUnmount`（L182–199）里清了**一大堆**东西：`handler.destroy()`、`clearAnimationFinishTimer()`、`clearSmoothMoveRemovers()`、`droneAnimation.stop()`、`clearInterval(droneSyncTimer)`、移除 window 事件监听、`mapStore.destroyViewer()`。
> **规范总结**：「谁申请，谁释放。」凡是 `setInterval` / `addEventListener` / `new Cesium.ScreenSpaceEventHandler`，都必须有对应的清理，写在 `onBeforeUnmount` 里。

**题 4 答案**：

| | `v-if` | `v-show` |
|---|---|---|
| DOM | 真正创建/销毁 | 始终存在，切 `display: none` |
| 初始开销 | 条件为假时便宜（不渲染） | 无论真假都要渲染 |
| 切换开销 | 高（销毁+重建） | 低（只改样式） |
| 适用 | 切换少、或需要「真正卸载」 | 频繁切换 |

**本项目**：侧边栏 5 个面板（`activePanel`）用 `v-if` 更合适——**面板里有大量图表/表格/Cesium 联动逻辑，销毁能顺便触发清理，避免隐藏面板继续跑定时器**。而如果只是「鼠标悬浮显示提示」这种高频切换，就用 `v-show`。
**解析**：判断标准一句话：**「切过去切回来，我希不希望它重新初始化？」** 希望 → `v-if`；不希望 → `v-show`。

### 验证方法
```powershell
cd frontend
npm run dev
```
打开 5173，点左侧图层复选框，观察地图上对应图层消失/出现；勾掉「教学楼」时**描边线也要一起消失**（这是 `OUTLINE_KEY_OF` 映射处理的，见 `stores/map.js` L23–27 与 L244–248）。

### 自测清单
- [ ] 能说出 SFC 三段结构各自作用
- [ ] 能画出「勾选框 → 图层显隐」的完整数据流
- [ ] 知道 `computed` 和 `watch` 的使用场景区别
- [ ] 知道哪些资源必须在 `onBeforeUnmount` 清理

---

## Day 12｜Pinia 状态管理与「响应式陷阱」

### 学习目标
- 看懂 `stores/map.js` 的 setup 写法
- **彻底理解「绝不要把 Cesium 对象放进 Vue 响应式状态」这条硬约束**
- 会排查 `DataCloneError`

### 核心概念
- **Pinia store（setup 语法）**：`defineStore('name', () => { ...; return {...} })`，像写一个组合式函数。
- **Proxy**：Vue3 响应式的实现方式。`ref(obj)` 会把 `obj` 包成 `Proxy`，拦截读写。
- **`shallowRef` / `shallowReactive`**：**只**代理最外层，内部对象保持原样。
- **`markRaw`**：给对象打上「永不代理」标记。
- **结构化克隆（Structured Clone）**：`postMessage` 传对象时按此算法深拷贝。**Proxy 无法被结构化克隆**。

### 项目对照
1. `README.md` **第 18–50 行**（「关键实现约束」第 1 条，**先读这段再读代码**）
2. `frontend/src/stores/map.js` L30–46：`viewer = shallowRef(null)` 及其长注释
3. 同文件 L84–97：`dataSources = shallowReactive({})`
4. 同文件 L47–55：`measureController` / `baseAnnotationLayer` 也是 shallow
5. `frontend/src/components/CesiumViewer.vue` L26–30：容器 DOM 用 `shallowRef`
6. `frontend/src/components/CesiumViewer.vue` L57：`HOVER_COLOR = markRaw(...)`
7. `frontend/scripts/verify-cesium-reactivity.mjs`：**专门守这条约束的回归脚本**

### 课后实践题

**题 1**：用自己的话复述「为什么 `viewer` 必须用 `shallowRef`」。要求说清：**谁**把 Proxy 传给了**谁**，在**哪一步**炸，报什么错。
**题 2**：下面代码为什么会导致地图一打开就崩？改成正确写法。
```js
const mapStore = useMapStore()
const layers = reactive({
  teaching: { dataSource: null, color: Cesium.Color.BLUE },
  dormitory: { dataSource: null, color: Cesium.Color.ORANGE }
})
// 加载完成后
layers.teaching.dataSource = await Cesium.GeoJsonDataSource.load(geojson)
```
**题 3**：`dataSources` 用 `shallowReactive({})`，那 `setLayerVisible` 里 `dataSources[layerName]` 还能读到最新值吗？新增 key 能触发更新吗？
**题 4**：`HOVER_COLOR` 为什么要 `markRaw`？不 `markRaw` 会怎样？

### 参考答案 + 解析

**题 1 答案**（照着 README 第 20–33 行的逻辑讲）：
1. 用 `ref(null)` 时，`viewer.value = new Cesium.Viewer(...)` 会被 Vue 包成 **Proxy**；
2. 项目里所有消费方都写 `const viewer = mapStore.viewer`，再把它传回 Cesium API → **Proxy 一路进到 Cesium 内部**；
3. Cesium 构建几何要走 **Web Worker**，执行 `worker.postMessage({ id, baseUrl, parameters, canTransferArrayBuffer })`；`parameters` 里含 Proxy 时，**结构化克隆直接抛 `DataCloneError: Failed to execute 'postMessage' on 'Worker': [object Object] could not be cloned.`**
4. 这个异常逃出 `viewer.render()`，被渲染循环的 catch 捕获，页面弹出：
```
An error occurred while rendering. Rendering has stopped.
DataCloneError: Failed to execute 'postMessage' on 'Worker': ...
```
**解析**：官方结论（CesiumGS/cesium#12438）就是「不要把 Viewer / DataSource 放进 Vue/Pinia 的响应式状态」。
> **一句话记牢**：「**Vue 的 Proxy 过不了 Worker 的结构化克隆。**」面试遇到这题，直接讲这个 cause→effect 链条，非常加分。

**题 2 答案**
```js
// 错误点：reactive 会深度代理 layers.teaching.dataSource
//         → GeoJsonDataSource 被包成 Proxy → 传给 Cesium 就炸

// 正确写法一：Cesium 实例放在 shallowRef，UI 用到的元数据放在普通 reactive
const layers = reactive({
  teaching:   { color: '#4A90D9', visible: true },
  dormitory:  { color: '#E8943A', visible: true }
})
const dataSources = shallowReactive({})   // ★ 只代理顶层
dataSources.teaching = await Cesium.GeoJsonDataSource.load(geojson)

// 正确写法二（本项目实际做法）：注册表 shallowReactive + 元数据单独 reactive
const layers = reactive({ teaching: true, dormitory: true, ... })
const dataSources = shallowReactive({})
```
**解析**：**核心原则是「分层」**——把「Cesium 实例」和「UI 需要的元数据（颜色、显隐、名称）」**物理隔离到两个对象里**：
- Cesium 实例 → `shallowRef` / `shallowReactive` / 普通变量 / `markRaw`
- UI 元数据 → `ref` / `reactive`
项目 `stores/map.js` 正是这么分的：`layers` 是 `reactive`（纯布尔），`dataSources` 是 `shallowReactive`（装 Cesium 对象）。

**题 3 答案**：
**都能。** 这正是 `shallowReactive` 的适用场景：
- **读最新值**：`shallowReactive` 只代理顶层对象本身，对 `{ teaching: ds }` 来说，「读取 `dataSources.teaching`」这个**属性读取操作是被代理的**，所以读到的一定是最新引用（且拿到的是**原始 DataSource**，不是 Proxy）。
- **增删 key 能触发更新**：`shallowReactive` 的顶层属性增删改**会**被追踪，所以 `dataSources.teaching = ds` 能触发依赖更新。
**只有「深度」的部分不追踪**——改 `ds.entities` 内部的东西不会触发。
**解析**：README 第 45–47 行原话：
> 「shallow 变体只跟踪顶层替换，**不影响**本项目的用法：切图层时 `Object.entries(dataSources)` 的增删改仍能正常追踪。」
> **关键结论**：`shallowReactive` 不是「功能阉割版」，而是「**恰好够用的正确工具**」。选 shallow 不是妥协，是因为我们**不需要**深度追踪 Cesium 对象内部。

**题 4 答案**：
```js
const HOVER_COLOR = markRaw(Cesium.Color.fromCssColorString('#7EC8FF').withAlpha(0.95))
```
`Cesium.Color` 是 Cesium 对象。虽然这个常量定义在模块顶层（不在响应式状态里）**看似**安全，但 `markRaw` 是**双保险**：
1. 万一将来这个对象被塞进某个响应式状态（比如 `reactive({ hoverColor: HOVER_COLOR })`），`markRaw` 能保证它**在任何情况下都不会被代理**；
2. 语义明确：**读代码的人一眼就知道「这是 Cesium 对象，别碰响应式」**。
不 `markRaw` 的实际后果：如果它进了响应式状态并被传回 Cesium（例如赋给 `polygon.material`），就会走题 1 的同一条崩溃路径。
**解析**：代码位置 `CesiumViewer.vue` L53–57，注释原话：
> 「用 `markRaw` 锁死：Cesium 的 Color 实例**绝不能**进 Vue 响应式状态（见 README「关键实现约束」），`markRaw` 让它在任何情况下都不会被代理。复用同一实例，也避免每次悬停都 new 一个 Color。」
> **注意后半句**：复用同一实例也是性能优化——悬停事件很频繁（`mousemove` 可达上百 Hz），每次 new 一个 Color 是纯浪费。

### 验证方法
```powershell
cd frontend
npm run verify:cesium     # 运行 verify-cesium-reactivity.mjs
```
这个脚本会扫描源码，检查 `viewer` / `dataSources` / `measureController` / `baseAnnotationLayer` 是否用了 shallow 变体——**用脚本守护架构约束，而不是靠记忆和代码评审**。这是很高级的工程实践（Day 26 会细讲）。

### 自测清单
- [ ] 能完整讲出 Proxy → postMessage → DataCloneError 的链条
- [ ] 能说出 4 个必须用 shallow 变体的状态
- [ ] 知道 `shallowReactive` 的顶层增删改仍然可追踪
- [ ] 理解 `markRaw` 的「双保险」价值

---

## Day 13｜Vite 工程化：构建、代理、Cesium 资源

### 学习目标
- 理解 Vite 的开发服务器与生产构建差异
- 会配置路径别名、代理、分包
- 知道 `vite-plugin-cesium` 解决了什么问题

### 核心概念
- **开发（dev）**：基于 ESM 按需编译，启动快；**构建（build）**：Rollup 打包成静态文件。
- **`resolve.alias`**：`@` → `src`，避免 `../../../`。
- **`manualChunks`**：把大依赖拆成独立文件，利用浏览器缓存。
- **Cesium 静态资源**：Cesium 需要 Workers / Assets / Widgets / ThirdParty 等一堆运行时文件，不是纯 JS。

### 项目对照
1. `frontend/vite.config.js` 全文（41 行）
2. `frontend/package.json` scripts（dev / build / preview / lint / check / verify / verify:all）
3. `frontend/eslint.config.js`
4. `frontend/.env` / `.env.example`
5. `frontend/index.html`

### 课后实践题

**题 1**：`vite.config.js` L32–33 的注释说「`vite-plugin-cesium` 已把 cesium 标记为 external（CDN 引入），不能再放进 `manualChunks`，否则 rollup 报冲突」。请解释：如果把 `cesium` 加进 `manualChunks` 会发生什么？
**题 2**：`build.chunkSizeWarningLimit` 被设成 5000（默认 500）。为什么本项目需要调大？
**题 3**：`npm run dev` 和 `npm run build` 的输出有什么区别？为什么 `dist/` 目录里有 `cesium/` 文件夹？
**题 4**：写一条命令，把项目构建产物在本地起一个静态服务器预览（不启动后端也能看页面骨架）。

### 参考答案 + 解析

**题 1 答案**：
`manualChunks` 是 Rollup 的「把这几个模块打进同一个 chunk」配置。如果 `cesium` 已被 `vite-plugin-cesium` 标记为 **external**（意思是「不要打包它，运行时从 CDN/外部路径加载」），再把它写进 `manualChunks` 就等于要求 Rollup **同时**「打包它」和「不打包它」——两个指令互相矛盾，Rollup 会报错（类似 `Cannot find module 'cesium'` 或 chunk 冲突错误），构建失败。
**解析**：`vite.config.js` L30–38 的正确做法是**只对真正打包的依赖分包**：
```js
manualChunks: {
  'element-plus': ['element-plus'],   // UI 库单独一个文件
  vue: ['vue', 'pinia', 'axios']      // 框架+状态+请求单独一个文件
}
```
**为什么这么分**：这三个包的版本很少变（尤其 vue），拆出来之后浏览器能长期缓存——**你改业务代码重新部署时，用户不用重新下载 1MB 的 element-plus**。这叫「利用缓存优化首屏」。

**题 2 答案**：
因为 `element-plus` 的产物本身就有 **946KB**（见 `dist/assets/element-plus-C3AjyYCz.js`），加上 `index.css` 382KB、主包 95KB——**随便一个 chunk 都超过默认的 500KB 阈值**。
`chunkSizeWarningLimit` 只是**警告阈值**，不是硬限制。不调大的话每次构建都刷一堆黄字警告，**淹没真正的警告**（狼来了效应）。
**解析**：注意——**调阈值只是「让警告闭嘴」，并没有真正解决体积问题**。真正的优化手段有三个，可以作为面试延伸答案：
1. **按需引入**：Element-Plus 支持 `unplugin-vue-components` 自动按需引入，只打包用到的组件（本项目用的是全量引入，有优化空间）；
2. **CDN 外链**：把 element-plus 也 external 掉；
3. **gzip/brotli**：Nginx 开启压缩，946KB 的 JS 压完大约 200KB 左右。
> 面试话术：「我知道 `chunkSizeWarningLimit` 只是掩盖警告；真正的优化要按需引入 + 压缩 + CDN。」——**能区分「掩盖问题」和「解决问题」是成熟度标志。**

**题 3 答案**：

| | `npm run dev` | `npm run build` |
|---|---|---|
| 产物 | 内存中，不落盘 | `dist/` 目录静态文件 |
| 模块 | 原生 ESM 按需请求 | Rollup 打包压缩 |
| 速度 | 秒级启动 | 几十秒 |
| 用途 | 开发调试（有 HMR） | 部署上线 |

`dist/cesium/` 出现的原因：`vite-plugin-cesium` 在构建时把 Cesium 的**运行时静态资源**（`Workers/`、`Assets/`、`Widgets/`、`ThirdParty/` 里的 wasm、图片、CSS）拷贝到输出目录，并注入全局变量 `window.CESIUM_BASE_URL` 指向它。
**解析**：Cesium 不是纯 JS 库——它要加载 Draco 解码器（`draco_decoder.wasm`）、Worker 脚本、地球纹理（`Assets/Textures/NaturalEarthII/...`）、控件样式。**这些文件必须能被浏览器按 URL 访问到**，所以必须拷到 dist。
> 排查技巧：如果部署后地球加载不出来、控制台报 404 找 `Workers/xxx.js`，**八成是 `CESIUM_BASE_URL` 配错或 cesium 目录没上传**。这是 Cesium 部署最经典的坑。

**题 4 答案**
```powershell
cd frontend
npm run build
npm run preview     # 默认 http://localhost:4173
```
**解析**：`vite preview` 起一个静态服务器托管 `dist/`。注意：
- 此时**没有后端**，所有 `/api` 请求会 404 → 页面能看到骨架、图层加载失败。**这恰好能验证一件事：前端的「接口挂了」降级做得怎么样**（本项目 `CesiumViewer.vue` 里每处 `await` 都有 try/catch + `console.warn`，比如 L137–146 获取校园边界失败时会打警告但页面继续渲染）。
- 想看完整效果，需要另外用 Nginx 或 `http-server` 配 `/api` 转发到 8080。

### 验证方法
```powershell
cd frontend
npm run lint     # ESLint 静态检查
npm run check    # lint + build 一起跑（提交前必跑）
```

### 自测清单
- [ ] 能说出 dev / build / preview 的区别
- [ ] 知道 `manualChunks` 分包的实际收益（缓存）
- [ ] 知道 `dist/cesium/` 是怎么来的、404 时怎么查
- [ ] 会跑 `npm run check`

---

## Day 14｜Cesium 入门：Viewer 与第一个图层

### 学习目标
- 会创建 `Viewer` 并认识关键配置项
- 会用 `GeoJsonDataSource.load` 加载地理数据
- 理解 `Cartesian3` / `Cartographic` 的区别

### 核心概念
- **Viewer**：三维场景总入口。构造时的配置项决定哪些控件显示。
- **坐标系三兄弟**：
  - **经纬度（度）**：人能读的，`114.468, 37.984`
  - **Cartographic（弧度）**：`longitude`/`latitude` 是**弧度**，不是度！
  - **Cartesian3（世界坐标）**：地心直角坐标，单位米，模长≈地球半径（6371km）
- **转换链**：`fromDegrees(lng,lat,h)` ⇄ `Cartographic.fromCartesian(cartesian)` ⇄ `Math.toDegrees(rad)`
- **Entity**：Cesium 的高层绘制对象（`polygon` / `polyline` / `point` / `billboard` / `label`）。

### 项目对照
1. `stores/map.js` L135–173：`initViewer`（**每个配置项都要看懂**）
2. `utils/cesium.js` L120–162：`loadBuildings`（加载 + 拉伸白模）
3. `utils/cesium.js` L12–23：建筑/场地颜色常量
4. `utils/cesium.js` L398–404：`computeDistance`（用 `EllipsoidGeodesic`）
5. `utils/cesium.js` L265–302：`loadSchoolBoundary`（最简单的图层加载，适合第一次照抄）

### 课后实践题

**题 1**：逐行解释 `stores/map.js` L137–149 的 Viewer 配置项，说明每个 `false` 关掉了什么控件、为什么关。
**题 2**：写一个函数，加载 `road` 图层的 GeoJSON 并画成黄色线。要求：至少两条线、宽度 3。
**题 3**：下面代码想把「经纬度高度」转成世界坐标，有什么问题？
```js
const cartesian = Cesium.Cartographic.fromDegrees(114.468, 37.984, 0)
```
**题 4**：`utils/cesium.js#computeDistance` 为什么用 `EllipsoidGeodesic.surfaceDistance`，而不是简单地算两点直线距离？

### 参考答案 + 解析

**题 1 答案**

```js
viewer.value = new Cesium.Viewer(container, {
  animation: false,          // 关掉左下角时间轴动画控件（本项目不做时间动态）
  timeline: false,           // 关掉底部时间轴
  baseLayerPicker: false,    // 关掉底图切换器（本项目用高德，自己控制底图）
  geocoder: false,           // 关掉右上角地名搜索（高德底图搜不了/需付费）
  homeButton: true,          // ★ 保留：一键回到初始视角，调试时很好用
  sceneModePicker: false,    // 关掉 2D/3D/哥伦布视图切换（本项目只要三维）
  navigationHelpButton: false, // 关掉操作帮助（占地方）
  fullscreenButton: true,    // ★ 保留：全屏看图
  infoBox: false,            // ★ 关掉默认信息框（改用自定义 BuildingPopup）
  selectionIndicator: false, // ★ 关掉默认选中绿框（改用自定义悬停高亮）
  shouldAnimate: true        // ★ 开启时钟推进（飞行动画需要）
})
```
**解析**：两条设计思路：
1. **`false` 的都是「默认控件与本项目 UI 冲突或无用」**：本项目有自定义侧边栏和弹窗，Cesium 自带的 infoBox / selectionIndicator 会**抢戏**（点一下楼，右上角弹出 Cesium 风格的白色信息框，与设计稿不符）。
2. **`shouldAnimate: true` 是飞行动画的必要条件**：Cesium 的时钟不推进，`SampledPositionProperty` 的时间插值就不会动。**这个配置漏了，动画就是不播——而且不报错**，非常难查。
> 记住这个「不报错但不生效」的类别：`shouldAnimate`、`@Valid` 缺 starter、`isLoading?.()`——**它们都是「静默失效」型 bug**，排查时要靠「逐个排除配置」而不是「看报错」。

**题 2**
```js
export async function loadRoadsYellow(viewer, features, name) {
  const geoJson = {
    type: 'FeatureCollection',
    features: (features || []).map(f => ({
      type: 'Feature',
      geometry: typeof f.geom === 'string' ? JSON.parse(f.geom) : f.geom,
      properties: { ...f, geom: undefined }
    }))
  }

  const dataSource = await Cesium.GeoJsonDataSource.load(geoJson, {
    stroke: Cesium.Color.YELLOW,     // 线颜色
    strokeWidth: 3                   // 线宽
  })

  // GeoJsonDataSource 对 LineString 会生成 polyline 实体，这里统一提一下宽度更稳
  for (const entity of dataSource.entities.values) {
    if (entity.polyline) {
      entity.polyline.width = 3
      entity.polyline.material = Cesium.Color.YELLOW
      entity.polyline.clampToGround = true   // 道路贴地
    }
  }

  dataSource.name = name
  viewer.dataSources.add(dataSource)
  return dataSource
}
```
**解析**：
- **复用 `toGeoJsonFeatureCollection`**（项目已有，`utils/cesium.js` L93）比自己再写一遍更规范。这里为了让你看清结构所以内联展开了。
- **`strokeWidth` 在部分场景下不生效**，所以加载后再显式设置 `entity.polyline.width`——**这是 Cesium 常见现象：`GeoJsonDataSource.load` 的 options 与实际实体属性有时对不上，加载后手动兜一层最保险**。
- `clampToGround: true` 对**线**是正确用法（道路贴着地形）；但**对拉伸多边形是错的**（见 Day 15）。**同一属性在不同几何类型上语义不同，这是 Cesium 最容易搞混的地方。**
> 项目对照：`utils/cesium.js#loadRoads`（L245–263）。

**题 3 答案**：
`Cesium.Cartographic.fromDegrees` **不存在**。
- `Cartographic.fromDegrees(lng, lat, height)` —— ❌ **没有这个静态方法**
- 正确的是 **`Cesium.Cartesian3.fromDegrees(lng, lat, height)`** —— ✅ 直接得到世界坐标
- 或者先 `Cesium.Math.toRadians()` 再 `new Cesium.Cartographic(lngRad, latRad, h)`
**解析**：这个坑项目里真踩过！`utils/measure.js` L56–60 的注释：
> 「原写法 `Cesium.Cartographic.fromCartesian(...)` 是错的——`fromCartesian` 只存在于 `Cartographic` 上，`Cartesian3` **从来没有**这个静态方法…」

等等，反过来看：`Cartographic.fromCartesian` **是存在的**（Cartesian3 → Cartographic），但 `Cartesian3.fromCartesian` 不存在。**而 `Cartographic.fromDegrees` 不存在**（只有 `Cartesian3.fromDegrees`）。
> **记忆口诀**：
> - **要经纬度 → 用 `Cartographic.fromCartesian(cartesian)`**（世界坐标 → 经纬度）
> - **要世界坐标 → 用 `Cartesian3.fromDegrees(lng, lat, h)`**（经纬度 → 世界坐标）
> - `fromDegrees` 只在 `Cartesian3` 上；`fromCartesian` 只在 `Cartographic` 上。
> **这类「方法在哪个类上」的混淆是 Cesium 新手第一大坑**，而它的表现是运行时 `TypeError: ... is not a function`。

**题 4 答案**：
因为地球是**椭球体**，不是平面。两点之间的「直线距离」（穿过地球内部的弦长）没有实际意义；我们关心的是**沿地球表面的最短路径长度（测地线长度）**，这才是「路有多长」。
```js
export function computeDistance(point1, point2) {
  const geodesic = new Cesium.EllipsoidGeodesic(
    Cesium.Cartographic.fromCartesian(point1),
    Cesium.Cartographic.fromCartesian(point2)
  )
  return geodesic.surfaceDistance   // 单位：米
}
```
`EllipsoidGeodesic.surfaceDistance` 基于 WGS84 椭球参数计算球面距离，与 PostGIS 的 `ST_Distance(geography)` 精度口径一致。
**解析**：这是一个**「前端和后端用同一套距离口径」的一致性设计**。
> 项目 `NavigationMapper#buildRouteFromNodes` 的注释也强调了这一点：「计算总距离（geography **真实球面米**，与无人机 haversine 推进口径一致）」。
> **为什么口径一致很重要**：如果前端用平面距离、后端用球面距离，会出现「后端说航线 500 米，前端量出来 480 米」这种对不上的问题，用户会怀疑系统有 bug。**统一口径是消除这类「幽灵 bug」的根本办法。**
> 对比：`measure.js#computeEnuArea` 用 ENU 局部平面投影算**面积**（小范围下平面近似足够准，且比球面多边形面积算法简单得多）——**同一个项目里，距离用球面、面积用局部平面，是根据精度需求和实现成本做的分别取舍。**

### 验证方法
打开 5173，按 F12 在 Console 里试：
```js
// 在 Vue devtools 里拿到 store 不太方便，可以直接在组件里临时加 console.log
// 或者用 Cesium 的调试面板（Viewer 创建时传 scene3DOnly 等参数）
```
观察：初始视角从校园南侧 45° 俯视（`initViewer` L162–171 的 `camera.setView`），点右下角 Home 按钮能回到该视角。

### 自测清单
- [ ] 能说出 `Cartesian3` / `Cartographic` 的区别与互转方法
- [ ] 知道哪些 Cesium 控件被关掉、为什么
- [ ] 知道 `shouldAnimate` 漏了会怎样
- [ ] 能解释为什么距离要用 `EllipsoidGeodesic`

---

## Day 15｜建筑白模：extrudedHeight 与 clampToGround 的战争

### 学习目标
- 理解「拉伸体块」和「贴地多边形」是两种不同几何
- 会用 `height` + `extrudedHeight` 做白模
- **理解为什么 `clampToGround` 和 `outline` 在拉伸体上不能用**

### 核心概念
- **贴地（clampToGround）**：把多边形/线「贴」到地形表面，走 `GroundPrimitive` 路径。
- **拉伸（extrudedHeight）**：多边形从 `height` 拉到 `extrudedHeight`，是一个**立体块**。
- **两者互斥**：`GroundPrimitive` **不支持** height/extrudedHeight。
- **`polygon.outline` 只对贴地多边形生效**，拉伸体描边要靠单独的贴地 polyline。

### 项目对照
1. `README.md` 第 52–58 行（约束第 2 条）
2. `utils/cesium.js` L104–162：`loadBuildings`（**重点读 L104–119 的长注释**）
3. `utils/cesium.js` L164–213：`addBuildingOutlines`（独立描边 + `await` 的坑）
4. `utils/cesium.js` L9：`FLOOR_HEIGHT = 3.5`
5. `stores/map.js` L23–27、L242–248：描边跟随建筑图层显隐

### 课后实践题

**题 1**：把 `loadBuildings` 的 `clampToGround` 改成 `true` 会怎样？请从「Cesium 内部如何处理」和「页面表现」两个角度回答。
**题 2**：为什么建筑描边要单独建一个 `CustomDataSource`，而不直接用 `entity.polygon.outline = true`？
**题 3**：`addBuildingOutlines` 最后一行 `await viewer.dataSources.add(dataSource)` 的 `await` 能不能去掉？去掉会怎样？
**题 4**：如果一栋楼的 `height` 字段是 `null`，`loadBuildings` 里 `entity.properties?.height?.getValue() || 3` 会得到什么？这个兜底合理吗？

### 参考答案 + 解析

**题 1 答案**
**Cesium 内部**：`clampToGround: true` 会请求走 `GroundPrimitive`（贴地图元）路径，而贴地图元**不支持** `height` / `extrudedHeight`。于是同一个实体上出现「我要贴地」和「我要从 0 拉到 20 米」两个互相矛盾的属性，Cesium 只能**反复重建几何去协调这对矛盾属性**。
**页面表现**：
1. 建筑可能变成贴地的平面（看不到立体感），或者拉伸失败；
2. **性能显著下降**（几何反复重建）；
3. 因为这是「几何构建任务最密集的地方」，**`DataCloneError` 最容易在这里炸出来**（README 原话）。
**解析**：`loadBuildings` L104–119 的注释把它们串起来了：
> 「`clampToGround: true` 是请求『把多边形贴到地形表面』——两者语义互斥：贴地多边形走 GroundPrimitive 路径，不支持 height/extrudedHeight，Cesium 只能反复重建几何去协调这对矛盾属性。既白费开销，又是几何构建任务最密集的地方（DataCloneError 就是在几何任务里炸出来的）。」
> **正确写法**（项目做法）：
> ```js
> entity.polygon.height = 0              // 地面高度
> entity.polygon.extrudedHeight = height * FLOOR_HEIGHT   // 拉伸到楼层高度
> entity.polygon.outline = false
> entity.polygon.clampToGround = false   // ★ 明确关闭
> ```
> 注释还补了一句：**「校园范围小且平坦，用 `height: 0` 当作地面高度与 `clampToGround` 视觉一致」**——这是在「语义正确」和「视觉等效」之间做的合理取舍。

**题 2 答案**：
因为 **`polygon.outline` 只对贴地多边形生效**，拉伸体块设了也没用（不显示）。
所以项目用 `addBuildingOutlines` **另建一个 `CustomDataSource`**，里面放**贴地的 polyline**（`clampToGround: true`）来勾边：
```js
dataSource.entities.add({
  polyline: {
    positions: Cesium.Cartesian3.fromDegreesArray(ring.flat()),
    width: 1.5,
    material: Cesium.Color.WHITE.withAlpha(0.4),
    clampToGround: true          // ★ 线贴地是正确用法
  }
})
```
**代价与应对**：单列一个 dataSource 意味着「图层显隐」要额外同步。项目用 `OUTLINE_KEY_OF` 映射表解决：
```js
// stores/map.js L23-27
const OUTLINE_KEY_OF = { teaching: 'outline-teaching', dormitory: 'outline-dormitory', other: 'outline-other' }
// L244-248：关建筑图层时，同步关掉描边
const outlineKey = OUTLINE_KEY_OF[layerName]
if (outlineKey) { const outlineDs = dataSources[outlineKey]; if (outlineDs) outlineDs.show = visible }
```
注释说明了原因：「建筑描边是独立 dataSource（key = `outline-<type>`），不单列图层。这里跟着所属建筑图层一起开关，**否则关掉『教学楼』后描边会残留在地图上**。」
**解析**：这是一个完整的「**技术约束 → 变通方案 → 引入的副作用 → 修复副作用**」链条。**面试时按这个链条讲，比只说「我用了 polyline 描边」强十倍**——它证明你能预判副作用并主动处理。

**题 3 答案**：
**不能去掉。** 去掉会导致调用方 `getByName()` 查不到刚添加的 dataSource。
原因：`DataSourceCollection.add()` 是**异步**的——调用后对象不会立刻进入集合。
项目注释（`utils/cesium.js` L170–172、L209–210）：
> 「`DataSourceCollection.add()` 是**异步**的，调用后对象不会立刻进入集合，此时 `getByName()` 查不到。调用方需要 await 之后才能按名字取回并登记（见 `CesiumViewer#loadBuildingLayer`）。」
**解析**：这是**「异步 API 被当成同步用」的经典 bug**，而且症状很迷惑——**有时能拿到、有时拿不到**（取决于内部 microtask 的调度时机），属于偶发 bug，最难查。
> 泛化规则：**凡是名字里有 `add` / `load` / `create` 的 Cesium API，先假设它是异步的**，去文档确认返回类型是不是 `Promise`。项目里 `GeoJsonDataSource.load` 是 async（所以用 `await`），`dataSources.add` 也是 async（本来容易被忽略）。

**题 4 答案**：
- `entity.properties?.height?.getValue()`：拿到楼层数，可能是 `null` 或 `undefined`
- `|| 3`：`null` / `undefined` / `0` / `NaN` / `''` 都会回落到 **3**

所以 `height = null` 时，`extrudedHeight = 3 * 3.5 = 10.5` 米——**按 3 层楼处理**。
**这个兜底合理吗？合理，但有一个小缺陷**：
- 优点：**保证建筑一定画得出来**。数据脏了（缺 height）也不会导致整栋楼消失，或者 `null * 3.5 = 0` 变成看不见的薄片。
- 缺陷：`|| ` 会把 `height = 0` 也当成缺失（0 是 falsy）。如果哪天有「高度为 0 的构筑物」（比如围墙、地库入口），会被错误地拉伸成 3 层。**更严谨的写法是 `?? 3`（只在 null/undefined 时兜底）**：
```js
const height = entity.properties?.height?.getValue() ?? 3
```
**解析**：**`||` vs `??` 是 JS 面试高频题**：
| 表达式 | `0` | `''` | `false` | `null`/`undefined` |
|---|---|---|---|---|
| `a \|\| b` | 用 b | 用 b | 用 b | **用 b** |
| `a ?? b` | **用 a（0）** | 用 a | 用 a | **用 b** |
> 选择标准：**「0 / 空串 / false 是不是合法值？」** 是 → 用 `??`；不是 → `||` 也行。
> 项目里用 `||` 是因为「校园建筑楼层数不可能是 0」，**在当时的业务假设下是正确的**。能说出「这个写法在当前业务下成立，但换成 `??` 更稳健」，就是加分项。

### 验证方法
打开 5173，检查：
1. 建筑是**立体**的（有侧面，能看出高度差异）；
2. 建筑边缘有**白色细描边**；
3. 取消勾选「教学楼」→ 蓝楼和它的描边**同时消失**；
4. Console 无 `DataCloneError`。

### 自测清单
- [ ] 能解释 clampToGround 和 extrudedHeight 为什么互斥
- [ ] 知道 polygon.outline 对拉伸体无效，要用 polyline
- [ ] 知道 `dataSources.add()` 是异步的
- [ ] 能说清 `||` 和 `??` 的区别

---

## Day 16｜相机与飞行：把镜头对准目标

### 学习目标
- 理解 `camera` 的 `destination` / `orientation` 语义
- 会写 `setView` 与 `flyTo`，并能算出「目标居中」的相机位置
- 会用 `flyToTarget` 做定位动画

### 核心概念
- **`destination`**：**相机所处的位置**（不是目标位置！这是最大误区）。
- **`orientation`**：`heading`（方位角，0=正北）、`pitch`（俯仰，-90°=垂直向下）、`roll`（翻滚）。
- **`pitch = -45°` 的几何含义**：相机视线向下 45°，**水平距离 = 相机高度**（因为 tan45°=1）。
- **`flyTo({ duration })`**：带补间动画的相机移动。

### 项目对照
1. `utils/cesium.js` L59–86：`flyToTarget`（**含推导过程的长注释**）
2. `stores/map.js` L162–171：`initViewer` 里的初始视角
3. `stores/map.js` L209–212：`flyToCampus`

### 课后实践题

**题 1**：`flyToTarget(viewer, lng, lat, 600, 2)` 想让目标居中。请推导：相机应该放在哪个经纬度、多高？
**题 2**：如果 `pitch` 写成 `-90°`（垂直向下），`flyToTarget` 里那个「向南偏移 height 米」还需要吗？为什么？
**题 3**：写一个函数 `flyToBuilding(viewer, building)`，让相机飞到某栋楼上空 150 米处（目标居中），动画 1.5 秒。
**题 4**：`1 度纬度 ≈ 111320 米` 这个常量是从哪来的？经度方向的换算为什么不能也用这个数？

### 参考答案 + 解析

**题 1 答案**（照着 `flyToTarget` 的注释推）：
```
若把相机放到目标正上方 + heading=0(朝北) / pitch=-45°(向下45°)，
视线与地面的交点会落在目标【北侧】 height 米处
→ 视野中心偏移到目标的"上面"（北边），目标不在画面中心。

修复：把相机放到目标【南侧】。
因为 pitch = -45°，tan45° = 1，所以 水平距离 = 垂直高度 = height。
纬度向南偏移量 = height / 111320 度。
```
```js
const latOffset = height / 111320
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(lng, lat - latOffset, height),  // ★ 向南偏
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
  duration: 2
})
```
以 `height = 600` 为例：`latOffset = 600/111320 ≈ 0.00539` 度 ≈ 600 米。相机在目标南侧 600 米、高 600 米，朝正北看、向下 45°——视线中心正好落在目标上。
**解析**：**这是本项目一个非常好的「几何 + 代码」结合点**，面试讲这个能直接体现你的空间思维。
> 为什么 `camera.setView` 和 `camera.flyTo` 都要写这一套？因为 **`destination` 永远是相机位置**。几乎所有 Cesium 新手都会写成「把 destination 设成目标坐标」，结果相机跑到目标正上方往下看，视野中心偏了——**这个 bug 的表现是「定位功能看着能用，但目标总在画面偏下的位置」**，很隐蔽。

**题 2 答案**：
**不需要偏移了**，`latOffset` 应该为 0。
因为 `pitch = -90°` 时相机是**垂直向下**看，视线与地面的交点就在相机正下方。此时相机放在目标正上方，目标就居中。
**解析**：一般表达式：
```
水平距离 = height / tan(|pitch|)
pitch = -45° → 水平距离 = height / 1     = height
pitch = -60° → 水平距离 = height / 1.732 ≈ 0.577 * height
pitch = -90° → 水平距离 = height / ∞     = 0
```
所以严格来说：
```js
const pitchDeg = 45
const latOffset = height / Math.tan(Cesium.Math.toRadians(pitchDeg)) / 111320
```
项目把 `45` 硬编码并且**在注释里写清了推导**——因为 pitch 和偏移量是两个必须联动的参数，**硬编码 + 注释说明，比留一个容易被误改的「灵活参数」更安全**。这也是一种工程判断。
> 顺带：垂直向下（-90°）虽然目标居中，但**看起来是平面俯视图，失去三维感**。所以项目选了 -45°：**既居中，又有立体感**。

**题 3**
```js
export function flyToBuilding(viewer, building, height = 150, duration = 1.5) {
  // 从 building 里取中心点：后端 pointQuery 返回的几何需要算形心
  const geom = typeof building.geom === 'string' ? JSON.parse(building.geom) : building.geom
  const [lng, lat] = getFeatureCentroid(geom) || []
  if (lng === undefined) return
  flyToTarget(viewer, lng, lat, height, duration)
}
```
**解析**：
- 直接复用项目已有的 `getFeatureCentroid`（`utils/cesium.js` L352）和 `flyToTarget`（L75）——**「先找有没有现成工具，再考虑自己写」是好习惯**。
- 更优的做法：如果后端返回了 `centroid` 字段（`selectById` 里就有 `ST_AsGeoJSON(ST_Centroid(geom)) AS centroid`），应该**优先用后端的精确形心**，而不是前端算粗略形心。**能用数据库算准的，别在前端凑。**
- 别忘了 `null` 兜底：`getFeatureCentroid` 可能返回 `null`，解构会抛错。写成 `const c = getFeatureCentroid(geom); if (!c) return; flyToTarget(viewer, c[0], c[1], ...)` 更清晰。

**题 4 答案**：
`111320` 来自**地球子午线周长的近似换算**：
```
地球平均半径 R ≈ 6371000 米
子午线周长 = 2πR ≈ 40,030,000 米
1 度纬度 = 40,030,000 / 360 ≈ 111,194 米    （更精确的椭球值 ≈ 111,320 米）
```
**经度方向不能直接用这个数**，因为经线在两极收敛：**1 度经度的实际距离 = 111320 × cos(纬度)**。
- 在赤道（lat=0）：`cos(0)=1` → 111320 米
- 在纬度 38°（本项目校园在甘肃一带，约 37.98°）：`cos(38°)≈0.788` → **87700 米**
**解析**：
- 项目只用了纬度偏移（`lat - latOffset`），所以 `111320` 是对的；**如果哪天要写「向东偏移多少米」的代码，必须乘 `cos(lat)`**，否则在高纬度会偏得离谱。
- **想更严谨可以完全避开这个常量**：
```js
// 用 Cesium 的坐标运算，自动处理椭球与弧度
const cartographic = Cesium.Cartographic.fromDegrees(lng, lat, 0)
const cartesian = Cesium.Cartesian3.fromRadians(
  cartographic.longitude,
  cartographic.latitude - height / 6371000,   // 弧度偏移：距离/半径
  height
)
```
但这种写法反而**可读性差**（花了一堆转换，就为了一个简单偏移）。项目选择「**常量 + 注释**」，把 `111320` 的含义写清楚，更好维护。
> **工程权衡**：能用简单公式 + 注释说清的，不必强行上「通用但晦涩」的写法。**代码是给人读的。**

### 验证方法
打开 5173，点侧边栏「定位校园」按钮 → 相机应平滑飞向校园中心，**且校园中心在画面正中**（不是偏上或偏下）。
把 `pitch` 临时改成 `-20` 再试一次，就能直观看到「不居中」的效果——**亲手制造一次 bug，比读十遍注释记得牢。**

### 自测清单
- [ ] 知道 `destination` 是相机位置而不是目标位置
- [ ] 能推导「pitch=-45° 时水平距离=高度」
- [ ] 知道 1 度经度的长度要乘 `cos(lat)`
- [ ] 会写一个带居中效果的 `flyTo`

---

## Day 17｜鼠标交互与三维拾取

### 学习目标
- 会用 `ScreenSpaceEventHandler` 注册鼠标事件
- 理解 `scene.pick` / `scene.pickPosition` / `globe.pick` / `pickEllipsoid` 的区别
- 会做「三级兜底」的坐标拾取

### 核心概念
- **`ScreenSpaceEventHandler(canvas)`**：Cesium 的鼠标/键盘事件入口。事件类型：`LEFT_CLICK`、`MOUSE_MOVE`、`LEFT_DOWN`、`RIGHT_CLICK`、`WHEEL` 等。
- **四个拾取 API 的区别**：

| API | 输入 | 输出 | 用途 |
|---|---|---|---|
| `scene.pick(pos)` | 屏幕坐标 | 被点中的**实体/图元** | 判断点到了哪栋楼 |
| `scene.pickPosition(pos)` | 屏幕坐标 | 三维**交点**（需深度纹理） | 精确点击位置（含楼体侧面） |
| `scene.globe.pick(ray, scene)` | 射线 | 与**地形/地球**的交点 | 上面失败时的降级 |
| `camera.pickEllipsoid(pos)` | 屏幕坐标 | 与**参考椭球面**的交点 | 最后兜底（不考虑地形） |

- **`movement.position` vs `movement.endPosition`**：`LEFT_CLICK` 用 `position`，`MOUSE_MOVE` 用 `endPosition`。

### 项目对照
1. `CesiumViewer.vue` L520–545：`resolvePickPosition`（**三级兜底**）
2. `CesiumViewer.vue` L557–658：`registerHoverHighlight`（悬停高亮 + rAF 节流）
3. `CesiumViewer.vue` L682–696：`registerClickHandler`（**try/catch 包 async**）
4. `CesiumViewer.vue` L699–800：`handleLeftClick`（完整点击逻辑）
5. `CesiumViewer.vue` L673–680：`isBuildingGeometryLoading`（**`isLoading` 是属性不是方法**）
6. `README.md` 第 60–73 行（约束第 3、4 条）

### 课后实践题

**题 1**：为什么 `resolvePickPosition` 要写三级兜底？每一级分别在什么情况下会失败？
**题 2**：`isBuildingGeometryLoading` 里为什么写 `ds.isLoading === true`，而不是 `ds.isLoading?.()`？如果写成后者会抛什么错？会有什么**隐蔽后果**？
**题 3**：`registerClickHandler` 里为什么要把 `handleLeftClick` 包在 `try/catch` 里？
**题 4**：写一个功能：鼠标双击地图时，在控制台打印该位置的经纬度。
**题 5**：悬停高亮用 `MOUSE_MOVE` 而不是 `LEFT_CLICK`，为什么还要加 `requestAnimationFrame` 节流？

### 参考答案 + 解析

**题 1 答案**（照 `resolvePickPosition` 注释）：
```js
function resolvePickPosition(viewer, windowPosition) {
  const scene = viewer.scene
  // ① 最精确：深度纹理拾取 —— 能拿到楼体侧面上的真实交点
  try {
    if (scene.pickPositionSupported) {
      const picked = scene.pickPosition(windowPosition)
      if (Cesium.defined(picked) && Cesium.Cartesian3.magnitude(picked) > 1) return picked
    }
  } catch (e) { /* 无深度纹理等情况会抛错，降级 */ }

  // ② 降级：与地球表面（含地形）求交
  try {
    const ray = viewer.camera.getPickRay(windowPosition)
    if (ray) {
      const onGlobe = scene.globe.pick(ray, scene)
      if (Cesium.defined(onGlobe)) return onGlobe
    }
  } catch (e) { /* 继续降级 */ }

  // ③ 兜底：与参考椭球面求交（不考虑地形，一定有个结果）
  return viewer.camera.pickEllipsoid(windowPosition, scene.globe.ellipsoid) || null
}
```
各级失败原因：
- **① `pickPosition`**：需要 **`pickPositionSupported`**（依赖深度纹理，某些浏览器/显卡组合或未开启 `depthTestAgainstTerrain` 时不支持）；另外交点落在地球背面时会返回**原点附近的坐标**，所以用 `Cartesian3.magnitude(picked) > 1` 排除（正常地表点模长≈6371km，接近 0 的就是无效值）。
- **② `globe.pick`**：地形瓦片还没加载完、或者射线打空（望向天空）时返回 undefined。
- **③ `pickEllipsoid`**：几乎不会失败（椭球面无处不在），但**不考虑地形起伏**，精度最差。

**为什么要三级**：项目注释给了核心业务理由：
> 「之所以要换掉纯 `pickEllipsoid`：**点击楼体上部时，射线与海拔 0 椭球面的交点落在建筑后方地面，很可能已经出了建筑轮廓**，`pointQuery` 就查不到要素了。」
> **一句话**：只用地③，点楼顶会点到楼后面的空地，弹窗不出现。**这是个非常真实的用户场景**（用户习惯点楼的高处）。
**解析**：这个「三级兜底 + 有效性校验」的写法可以直接迁移到任何 WebGL 拾取场景。面试讲这个，展示的是**你考虑过「API 会失败」**，而不是只会 happy path。

**题 2 答案**：
`dataSource.isLoading` 是一个**布尔属性**，不是方法。
```js
// ❌ 错误
if (ds && ds.isLoading?.()) { ... }
```
`?.` 只对 `null` / `undefined` **短路**。当 `isLoading` 存在但是个**布尔值**（`true`/`false`）时，`?.()` 依然会尝试**调用**它 → 抛：
```
TypeError: ds.isLoading is not a function
```
**隐蔽后果**（这才是重点）：`isBuildingGeometryLoading` 被 **`registerHoverHighlight` 的 rAF 回调**调用，而这个回调被 `scene` 的渲染循环驱动。异常抛出后：
1. 悬停高亮**整个失效**（鼠标移上去没反应、光标不变手型）——用户以为「这些楼不能点」；
2. 更糟的是，**它不亮红字、不弹提示**——因为异常发生在 rAF 回调里，不会冒泡到任何显式的 UI 错误通道，只在 Console 里留一条（用户不会看 Console）。
**解析**：项目注释（L662–667）：
> 「写成 `isLoading?.()` 会抛 TypeError（`?.` 只对 null/undefined 短路，对『存在但不是函数』的值照样调用）。」
> 同一类坑在点击处理器上也踩过（README 约束第 4 条）：**「又因为 Cesium 的点击回调是 `async`，异常会变成未处理的 Promise rejection：不亮红字、不弹提示，点击功能静默失效。」**
> **教训**：`?.()` 不是万能的空安全写手。**「我以为它安全」比「我不写」更危险**——因为它会给你虚假的安全感。用之前先确认**类型**，不确定就用 `typeof x === 'function'`。

**题 3 答案**：
因为 `handler.setInputAction(async (movement) => { await handleLeftClick(...) })` 是 **async 回调**，而**任何在 async 函数里抛出、又没被 catch 的异常，都会变成一个「未处理的 Promise rejection」**。
未处理的 rejection 的表现：
- ❌ 不弹 Cesium 的错误面板
- ❌ 不影响页面渲染（跟渲染循环的 catch 不同）
- ❌ 用户看不到任何提示
- ✅ 只在 Console 里有一条 `Uncaught (in promise)`
**结果**：**点击功能静默失效**。用户点了楼没反应，你完全不知道发生了什么。
项目注释（L689–694）：
> 「async 监听器里抛出的异常会变成未处理的 Promise rejection：不报错、不提示，点击功能直接静默失效（本项目踩过这个坑）。这里兜住，保证任何异常都不会让后续点击失灵。」
**解析**：
- **「保证任何异常都不会让后续点击失灵」**这句很关键：`setInputAction` 注册的回调是**长期存活**的，如果第一次点击就抛异常打断了逻辑（比如某个 flag 没复位），后续点击可能全废。
- **通用规则**：**凡是事件回调，一律包 try/catch；凡是 async 回调，一律包 try/catch 且 catch 里不能只写 `console.log`**（要写 `console.error` 带上下文）。
- 这个坑有个**更阴险的变体**：异常被 catch 了但**没记日志** → 问题彻底隐形。项目这里用了 `console.error('[click] 处理点击失败:', e)`，**带上了 `[click]` 前缀**方便过滤——**日志要能定位，不能只写 `console.log(e)`**。

**题 4**
```js
// 注意：项目里 onMounted 已经 removeInputAction 了 LEFT_DOUBLE_CLICK
// （为避免测量双击时视角跳动），所以这里要单独注册
function registerDoubleClickLog(viewer) {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction((movement) => {
    const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid)
    if (!cartesian) return
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
    const lng = Cesium.Math.toDegrees(cartographic.longitude)
    const lat = Cesium.Math.toDegrees(cartographic.latitude)
    console.log(`双击位置: lng=${lng.toFixed(6)}, lat=${lat.toFixed(6)}`)
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

  return () => handler.destroy()   // ★ 返回清理函数
}
```
**解析**：四个要点：
1. **`movement.position`**：点击类事件用 `position`；`MOUSE_MOVE` 才用 `endPosition`。**写错会得到 `undefined`，然后 `pickEllipsoid(undefined)` 返回 undefined，静默无输出**。
2. **`Math.toDegrees`**：`Cartographic.longitude` 是**弧度**，不转换会得到 `1.99...` 这种值。
3. **返回清理函数**：这是项目里 `registerHoverHighlight` / `registerClickHandler` 的统一模式（`CesiumViewer.vue` L647–657），在 `onBeforeUnmount` 里调用 `handler.destroy()`。
4. **`.toFixed(6)`**：经纬度保留 6 位小数约等于 0.1 米精度，是 GIS 里常用的显示规范（**度数直接打印会出现 114.46825100000002 这种浮点噪声**）。
> 项目对照：`handleLeftClick` 里设置航线起终点用的就是同一套转换（L706–710）。

**题 5 答案**：
因为 **`mousemove` 事件的触发频率远高于屏幕刷新率**：
- 鼠标事件：可达 **上百 Hz**（尤其高刷新率鼠标 / 触摸板拖动）
- 屏幕刷新：通常 **60 Hz**
- 而 `scene.pick` 每次调用内部会**跑一遍渲染 pass**（`Primitive.update` → 几何任务），**开销很大**

不节流的后果：鼠标划过屏幕时，每秒钟可能触发 100+ 次 `pick`，其中 40+ 次是**纯浪费**——而且这些 pick 会和 Cesium 的几何构建任务**抢时间**，导致画面卡顿。
项目做法（`CesiumViewer.vue` L569–586）：
```js
if (hoverRafPending) return          // 本帧已排队，直接丢弃
hoverRafPending = true
hoverRafId = requestAnimationFrame(() => {
  hoverRafPending = false
  hoverRafId = null
  if (isPickingSuspended?.()) { setCursor(''); return }   // 几何还在建 → 跳过
  doHoverPick(movement.endPosition)
})
```
**解析**：这是**「用 rAF 把高频事件压到每帧一次」**的经典节流模式，比 `setTimeout` 定时器更优雅（自动跟随屏幕刷新率，且在标签页不可见时自动暂停）。
两个额外细节值得学：
1. **`isPickingSuspended` 的意义**（L578–583 注释）：「几何还在异步构建时快速掠过：拾取既拿不到结果，又会和几何任务抢时间，直接跳过（下一帧再试），比强行 pick 更省也更稳。」——**知道什么时候不该干活，和知道怎么干活同样重要**。
2. **卸载时取消待执行的 rAF**（L650–656）：
```js
if (hoverRafId !== null) { cancelAnimationFrame(hoverRafId); hoverRafId = null; hoverRafPending = false }
```
注释：「否则回调可能在 viewer 销毁后仍被调用」→ **会访问已销毁的 viewer 而报错**。**rAF 也是资源，也要释放。**

### 验证方法
1. 鼠标在楼体上移动 → 楼体变亮（`#7EC8FF`）+ 光标变手型；
2. 鼠标移开 → 颜色恢复；
3. 点击楼体上部（楼顶附近）→ **依然能弹出正确建筑的弹窗**（这就是三级兜底的价值）；
4. 点击空地 → 弹窗消失 / 提示「未查询到要素」；
5. 打开性能面板录制，快速划动鼠标 → 帧率稳定，无长任务堆积。

### 自测清单
- [ ] 能说出四个拾取 API 的区别与适用场景
- [ ] 知道 `position` 和 `endPosition` 的区别
- [ ] 理解 async 事件回调必须 try/catch
- [ ] 会写 rAF 节流，并知道要 cancel

---

## Day 18｜弹窗与浮窗定位：worldToWindowCoordinates 的坑

### 学习目标
- 会用 `worldToWindowCoordinates` 把三维坐标转成屏幕坐标
- 理解 `postRender` 每帧重算的必要性
- **理解「API 改名」导致的静默失效**

### 核心概念
- **世界坐标 → 屏幕坐标**：把三维位置投影到 2D 屏幕上，用于 HTML 浮窗定位。
- **API 兼容封装**：Cesium 1.121 前后把 `SceneTransforms.wgs84ToWindowCoordinates` 改名为 `worldToWindowCoordinates`。
- **`postRender` 钩子**：每帧渲染完成后触发，适合做「跟随三维位置的 HTML 定位」。

### 项目对照
1. `README.md` 第 60–66 行（约束第 3 条）
2. `utils/cesium.js` L25–57：`worldToWindowCoordinates`（**降级链：新名 → 旧名 → null**）
3. `components/BuildingPopup.vue`（16KB，弹窗本体 + 照片回退）
4. `frontend/public/buildings/README.md`：照片约定
5. `frontend/scripts/verify-popup-position.mjs`：**守这个坑的回归脚本**

### 课后实践题

**题 1**：读 `worldToWindowCoordinates`，说明它的降级链和每一级的判断依据。
**题 2**：为什么弹窗位置要在 `postRender` 里**每帧重算**，而不是点击时算一次？
**题 3**：建筑照片按 `public/buildings/{表名}-{id}.jpg` 约定取图。如果图片不存在，浏览器会怎样？前端应该怎么处理？
**题 4**：如果 `worldToWindowCoordinates` 返回 `null`（位置在视锥外），弹窗应该怎么处理？

### 参考答案 + 解析

**题 1 答案**
```js
export function worldToWindowCoordinates(scene, position) {
  if (!scene || !position) return null
  const transforms = Cesium.SceneTransforms
  if (!transforms) return null

  // 新 API（Cesium ≥ 1.121）
  if (typeof transforms.worldToWindowCoordinates === 'function') {
    return transforms.worldToWindowCoordinates(scene, position) ?? null
  }
  // 旧 API（Cesium < 1.121）
  if (typeof transforms.wgs84ToWindowCoordinates === 'function') {
    return transforms.wgs84ToWindowCoordinates(scene, position) ?? null
  }
  return null
}
```
**降级链**：新名 → 旧名 → null。
**每一级的判断依据**：
- `typeof x === 'function'`：**用类型判断而不是版本号判断**。因为「运行时是什么版本」比「package.json 里写了什么版本」更可靠——本项目的 `package.json` 曾经写 `^1.114.0`，**实际装成了 1.145.0**，正是这种不一致引发了 bug。
- 最后返回 `null` 而不是抛异常：**调用方有能力处理 null（不显示弹窗），但处理不了异常**（异常会打断 `postRender`）。
**解析**：这个 bug 的完整链条非常值得背下来（README 约束第 3 条）：
> 「旧调用语法完全合法、SFC 编译也通过，**只有运行时才抛** `TypeError: ... is not a function` —— 而它发生在 `postRender` 里，**表现是「点击后有数据但弹窗不出现」**。」
**教训三层**：
1. **版本范围（`^1.114.0`）是不可信的**：npm 会解析到最新兼容版本。想锁死就用精确版本（本项目已钉死为 `"cesium": "1.145.0"`）。
2. **编译通过 ≠ 运行正确**：JS 是动态类型，方法不存在只有调用时才炸。
3. **依赖第三方 API 要包一层**：直接散落调用 `Cesium.SceneTransforms.xxx` 有几十处的话，升版时改到崩溃。**封装一层兼容层，是一个文件的事。**

**题 2 答案**：
因为**地球可以旋转、缩放、平移**——用户拖动地球后，那栋楼的三维位置没变，但它的**屏幕位置变了**。如果只在点击时算一次，用户一拖地球，弹窗就「钉」在屏幕原地，跟建筑脱节了。
```js
// 每帧（postRender）重算 → 弹窗始终跟着建筑走
viewer.scene.postRender.addEventListener(() => { updatePopupPosition() })
```
**解析**：
- **代价**：每帧都要坐标变换 + 读写 DOM 样式。60fps 就是每秒 60 次。所以实现上要注意：
  - **只在弹窗可见时才注册/执行**（不可见时直接 return）；
  - 用 `transform: translate()` 改位置，**不要改 `top/left`**（`transform` 走合成层，不触发重排，性能好得多）。
- **卸载时必须移除监听**：`postRender.addEventListener` 返回移除函数，要在 `onBeforeUnmount` 里调用，否则 Viewer 销毁后回调还在跑。
> 项目里同类的「每帧监听」还有 `utils/cesium.js#createDroneAnimation` 和 `CesiumViewer.vue#smoothMoveEntity`（L442），它们把移除函数登记进 `smoothMoveRemovers` 集合，卸载时统一注销——**这个「登记-统一注销」模式很值得学**（L112–120）。

**题 3 答案**
**浏览器行为**：`<img src="...jpg">` 加载失败时**不会弹窗报错，只触发 `onerror` 事件**，页面上显示「裂图」图标（如果是 `<img>` 标签）。
**前端正确做法**：监听 `error` 事件，切换到占位图：
```vue
<template>
  <img :src="photoUrl" @error="onPhotoError" alt="建筑照片" />
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({ tableName: String, id: Number })
const photoUrl = ref(buildPhotoUrl(props.tableName, props.id))

function buildPhotoUrl(tableName, id) {
  return `/buildings/${tableName}-${id}.jpg`
}
function onPhotoError(e) {
  // 防止占位图也失败时无限循环
  if (e.target.src.includes('placeholder')) return
  e.target.src = '/buildings/placeholder.jpg'
}
</script>
```
**关键细节**：**必须防止死循环**——如果占位图本身也不存在，`onerror` 会把 `src` 又设成占位图，触发新的 `onerror`，**无限循环刷爆控制台/网络**。所以先判断 `src` 是否已经是占位图。
项目文档（`frontend/public/buildings/README.md`）说明了这个约定：
> 「建筑照片不走接口字段，前端按 `frontend/public/buildings/{表名}-{id}.jpg` 约定取图，缺图自动回退占位图。」
**解析**：为什么照片**不走接口**？
- 走接口要把图片转 base64 塞进 JSON，**体积膨胀 33%**，而且建筑数据接口会变得巨大；
- 用静态文件 + 命名约定，**浏览器能缓存、能并行加载、能走 CDN**；
- 代价是「命名必须严格规范」——**用约定换性能**，是前端常见的取舍。
> 这是个很好的面试题：「你怎么存/取图片？」→「静态资源 + 命名约定 + 前端 error 回退，避免把二进制塞进 JSON。」

**题 4 答案**：
`null` 表示该三维点**投影不到屏幕上**（在视锥外，比如用户把相机转到了建筑背面、或者缩放到很远）。
处理策略：
```js
const screenPos = worldToWindowCoordinates(viewer.scene, cartesian)
if (!screenPos) {
  popupVisible.value = false     // 方案A：隐藏弹窗
  // 方案B：把弹窗停在屏幕边缘（带箭头指示方向）
  // 方案C：不做处理，弹窗保留在最后一次有效位置
  return
}
popupStyle.value = { transform: `translate(${screenPos.x}px, ${screenPos.y}px)` }
```
**推荐方案 A**（项目做法）：**隐藏**。
**解析**：为什么隐藏比「停在边缘」好？
- 「停在边缘」需要额外做「箭头指向 + 边界夹取」的计算，代码复杂，而且用户可能误以为弹窗还对应着那栋楼；
- **隐藏 = 明确的语义**：「你看不到这栋楼，所以没有弹窗」。用户把地球转回来，弹窗自然出现。
> **注意一个细节**：`null` 和「坐标 (0,0)」是不同的。不要写成 `if (!screenPos.x)` 这种判断——**`x=0` 是合法的屏幕坐标**（屏幕左边缘），写成 falsy 判断会导致「建筑移到屏幕最左边时弹窗消失」的诡异 bug。**判 null 就好好判 null。**

### 验证方法
1. 点击一栋楼 → 弹窗出现在楼体上方；
2. **拖动地球** → 弹窗持续跟着建筑移动（不脱节）；
3. 把相机转到建筑背后 → 弹窗消失；
4. 检查一栋「没有照片」的楼（比如新 id）→ 显示占位图而非裂图；
5. Console 无 `TypeError: ... is not a function`。

### 自测清单
- [ ] 能说出 `worldToWindowCoordinates` 的降级链
- [ ] 知道为什么弹窗要每帧重算位置
- [ ] 知道图片加载失败要监听 `error` 并防死循环
- [ ] 知道判断 `null` 不要用 falsy 判断

---

## Day 19｜图层体系与数据加载编排

### 学习目标
- 看懂「一个图层」的完整生命周期：请求 → 转换 → 加载 → 注册 → 显隐 → 卸载
- 会写带 try/catch 的批量加载
- 理解「加载顺序」和「依赖关系」

### 核心概念
- **数据加载编排**：多个图层并行还是串行？失败一个要不要继续？
- **注册表模式**：`dataSources` 用 `key → DataSource` 的映射统一管理。
- **防御性加载**：单层失败不影响整体。

### 项目对照
1. `CesiumViewer.vue` L227–241：`loadBuildingLayer`（**加载 + 注册的模板函数**）
2. `CesiumViewer.vue` L242–267：`loadAllSpatialData`（**批量加载编排**）
3. `CesiumViewer.vue` L268–348：`loadDeliveryData`（配送相关图层）
4. `CesiumViewer.vue` L133–180：`onMounted` 完整启动流程
5. `api/spatial.js` / `api/drone.js` / `api/route.js` 等接口封装

### 课后实践题

**题 1**：`onMounted` 里的加载顺序是：校园边界 → 空间数据 → 配送数据 → 注册事件。为什么要这个顺序？如果把「注册事件」提到最前面会怎样？
**题 2**：`loadAllSpatialData` 里每个图层加载都包了 try/catch。如果不包，某一个图层接口挂了会发生什么？
**题 3**：`loadBuildingLayer` 做了「加载 + 注册」两件事。请写出这个函数的骨架，并说明「注册」这一步为什么不能省。
**题 4**：如果校园有 8 个空间图层 + 5 个配送图层，你会用 `Promise.all` 并行加载还是 `for...await` 串行？各自的取舍是什么？

### 参考答案 + 解析

**题 1 答案**：
顺序的理由（按依赖关系排）：
```
① getCampusBounds（校园边界）
   理由：拿到中心点才能设置初始视角；后面的 flyToTarget 依赖它
② loadAllSpatialData（8 个空间图层）
   理由：这是"静态底图内容"，是用户第一眼要看的东西
③ loadDeliveryData（无人机/航线/餐厅/限飞区）
   理由：动态业务数据，依赖空间图层已就位
④ registerClickHandler / registerHoverHighlight（注册事件）
   理由：事件里要读 dataSources 判断点击的是哪类建筑
      —— 如果图层还没加载，点上去什么也拿不到
```
**如果把「注册事件」提到最前面**：
- **不会崩**，但会有「短暂的时间窗口」用户能点但没反应（图层还没加载完）；
- 更麻烦的是：`registerHoverHighlight` 的 `isBuildingGeometryLoading()` 会检查 `dataSources` 里的三个建筑 dataSource——**都还不存在**时它返回 `false`（"不在加载中"），于是悬停拾取会**毫无节制地跑**（本该被跳过的），和几何构建任务抢时间。
**解析**：**「先建资源，再注册消费者」**是通用原则。项目还把「移除默认双击缩放」放在 `onMounted` 末尾（L174），因为它是**清理默认行为**，最后做最安全（不用管前面谁加了什么）。
> 顺带一个细节：L137–146 获取校园边界失败时**只打 warn 不中断**：
> ```js
> try { const bounds = await getCampusBounds(); if (bounds) { ...; flyToTarget(...) } }
> catch (e) { console.warn('获取校园边界失败:', e) }
> ```
> **「非关键路径失败不阻断主流程」**——边界只是用来定位视野，失败了还能用 `stores/map.js` 里写死的 `campusCenter = [114.468251, 37.984174]` 兜底。**有默认值，就敢降级。**

**题 2 答案**：
**整个加载流程会中断在那一个图层上**，后面的图层**全部不加载**。
因为 `loadAllSpatialData` 是个 `async` 函数，内部是 `await` 串行的：一个 `await` 抛异常，函数就退出了（除非外面还有 catch）。
**用户看到的现象**：地图上只有「教学楼」，没有宿舍楼、没有道路、没有操场——**而且看不出是"挂了"还是"本来就没有"**（因为不报错，只在 Console 有一条 unhandled rejection）。
**解析**：这是**「局部失败应该局部处理」**的经典场景。正确做法（项目做法）：
```js
async function loadBuildingLayer(viewer, table, buildingType, name) {
  try {
    const features = await fetchGeojsonShifted(table)
    const ds = await loadBuildings(viewer, features, buildingType, name)
    mapStore.dataSources[buildingType] = ds
  } catch (e) {
    console.warn(`加载图层 ${table} 失败:`, e)   // ★ 只 warn，不抛
  }
}
```
**关键点**：
1. **每层独立的 try/catch**，而不是在外层包一个大 try；
2. **用 `console.warn` 而不是 `console.error`**：图层缺失是「可降级」问题，不是「系统故障」——**日志级别也是信息设计**；
3. **日志带表名**（`加载图层 ${table} 失败`），排查时一眼知道是哪个图层。
> **反模式警示**：外层包一个 `try { 全部加载 } catch {}` 看起来"更安全"，实际上是**最危险的**——一个图层坏了会导致全部静默失败，而且你只知道"出错了"，不知道是哪个。**粒度要对。**

**题 3 答案**
```js
async function loadBuildingLayer(viewer, table, buildingType, name) {
  try {
    // ① 取数（含底图坐标系平移，本项目平移量为 0）
    const features = await fetchGeojsonShifted(table)

    // ② 加载到 Cesium 并拿到 dataSource
    const ds = await loadBuildings(viewer, features, buildingType, name)

    // ③ 注册到 store 的注册表（key = buildingType）
    mapStore.dataSources[buildingType] = ds

    // ④ 处理描边（loadBuildings 内部已 await addBuildingOutlines，
    //    这里再按名字取回来登记，供图层显隐联动）
    //    注意：必须等 DataSourceCollection.add() 完成才查得到
    const outlineDs = viewer.dataSources.getByName('building-outlines-' + buildingType)[0]
    if (outlineDs) mapStore.dataSources['outline-' + buildingType] = outlineDs
  } catch (e) {
    console.warn(`加载建筑图层 ${table} 失败:`, e)
  }
}
```
**「注册」为什么不能省**：
`setLayerVisible` 的实现全靠注册表：
```js
const ds = dataSources[layerName]
if (ds) ds.show = visible          // ← 找不到就静默不生效！
```
**不注册 = 图层显隐功能失效**，而且**不报错**（`if (ds)` 挡掉了）。用户勾选框会变，但地图没反应——又是一个「静默失效」。
**解析**：注意这里注册了**两个** key：`teaching`（建筑本体）和 `outline-teaching`（描边）。这就是 Day 15 讲的「描边副作用」的落地实现。
> **模式总结**：「**加载 → 拿到对象 → 登记到注册表**」这三步是 WebGIS 前端的标准骨架。任何新图层都应该照这个模板写。**有了统一注册表，显隐、清理、统计才有一个抓手。**

**题 4 答案**：

| | `Promise.all`（并行） | `for...await`（串行） |
|---|---|---|
| 总耗时 | ≈ 最慢的那个 | ≈ 所有之和 |
| 服务器压力 | 瞬间并发 8–13 个请求 | 依次 1 个 |
| 失败隔离 | 一个 reject 全部 reject（除非用 `allSettled`） | 天然隔离 |
| 首屏体验 | 数据到齐后一起渲染（**可能看起来"卡"很久没反应**） | 能**渐进式渲染**，用户先看到一部分 |

**项目选择了串行**（`await loadBuildingLayer(...)` 逐个）。取舍分析：
- **优点**：校园数据量小，串行总耗时也就几百毫秒；渐进式渲染让用户「先看到楼，再看到路」，**感知更快**；请求压力也小。
- **代价**：总耗时更长。数据量大时不行。
**如果要并行**，正确写法是 `Promise.allSettled`：
```js
await Promise.allSettled([
  loadBuildingLayer(viewer, 'teaching_building', 'teaching', '教学楼'),
  loadBuildingLayer(viewer, 'dormitory', 'dormitory', '宿舍楼'),
  loadBuildingLayer(viewer, 'other_buildings', 'other', '其他建筑')
])
```
`Promise.allSettled` 会等**全部结束**（无论成功失败），返回每个的结果状态——**不会因为一个失败就丢弃其他成功的结果**。这就是为什么不能用 `Promise.all`：它有一个 reject 就整体 reject，**其他已经成功加载的图层结果拿不到**。
> **面试延伸**：如果要求「首屏尽快可见 + 数据完整」，更好的方案是**分层优先级**：先 `await` 建筑（用户最关注），再用 `Promise.allSettled` 加载道路/场地等次要图层。**并行和串行不是二选一，可以按优先级混用。**

### 验证方法
打开 5173，在 DevTools → Network 里观察：请求是**依次发出**的（串行）；随便让某个接口报错（比如临时把 `getGeoJson('road')` 的 table 改成非法值），应看到 Console 一条 `加载图层 road 失败` 的 warn，**其他图层照常渲染**。

### 自测清单
- [ ] 能说出 `onMounted` 里各步骤的顺序理由
- [ ] 知道每层 try/catch 与外层一个大 try 的区别
- [ ] 能背出「加载 → 注册」模板
- [ ] 知道 `Promise.all` 和 `Promise.allSettled` 的区别

---

## Day 20｜测距与测面积：ENU 投影与鞋带公式

### 学习目标
- 理解「球面距离」和「局部平面面积」的取舍
- **掌握 ENU 局部坐标系与矩阵求逆**
- 会实现状态机式的交互工具

### 核心概念
- **鞋带公式（Shoelace Formula）**：由平面多边形顶点坐标算面积：
  ```
  Area = |Σ(x_i · y_{i+1} − x_{i+1} · y_i)| / 2
  ```
- **ENU 坐标系**：East-North-Up，以某点为原点的局部「东-北-天」直角坐标系。小范围内可以当平面用。
- **`eastNorthUpToFixedFrame(origin)`**：返回「从 ENU 局部系到世界系」的 4×4 变换矩阵。
- **矩阵求逆**：要把世界坐标变回局部坐标，必须用**逆矩阵**。
- **状态机**：`idle → placing → done`，用 `phase` 变量管理交互阶段。

### 项目对照
1. `README.md` 第 75–80 行（约束第 5 条）
2. `utils/measure.js` L51–88：`computeEnuArea`（**全项目最值得精读的 40 行**）
3. `utils/measure.js` L9–49：控制器状态与快照
4. `utils/measure.js` L114–160：`renderFormal`（重建式渲染）
5. `utils/cesium.js` L398–424：`computeDistance` / `formatDistance` / `formatArea`
6. `components/MeasureTool.vue` / `MeasureInfo.vue`

### 课后实践题

**题 1**：为什么算面积不能直接用 `eastNorthUpToFixedFrame` 返回矩阵的**列向量**做点积？请从数学和实测数据两方面说明。
**题 2**：手动实现 `computeEnuArea`，逐行加注释。
**题 3**：为什么测距用球面距离（`EllipsoidGeodesic`），而测面积用局部平面（ENU + 鞋带），不用球面多边形面积公式？
**题 4**：`renderFormal` 每次重建**全部**实体（不是增量更新）。这样做有什么好处和代价？在什么规模下可以接受？

### 参考答案 + 解析

**题 1 答案**
**数学层面**：
`eastNorthUpToFixedFrame(origin)` 返回的 4×4 矩阵，其**前三列**是局部系的三个基向量在世界系下的表示。但问题在于：
1. **前三列是「位置矢量」**：`m[12], m[13], m[14]` 那一列是**原点位置**（模长 ≈ 地球半径 6371km），前三列的数值也带着这个量级；
2. **三列并非严格正交**：受浮点精度和椭球参数影响，east/north/up 三个方向不是精确垂直的。

用**非正交基**做点积（投影），结果会被**剪切变形**——数学上等价于「把正方形斜着压成平行四边形」，距离和面积都会错。
**实测数据**（项目注释原话）：
> 「实测 **100m 的边会算成 72m / 138m**，面积偏差 **5.6%**。」
注意 72 和 138 两个数——**一条边算短了、另一条算长了**，正是「非正交基投影」的典型症状（剪切）。
**正确做法**：用**逆矩阵**把点变换到局部系：
```js
const inverseFrame = Cesium.Matrix4.inverse(enuFrame, new Cesium.Matrix4())
const local = Cesium.Matrix4.multiplyByPoint(inverseFrame, p, new Cesium.Cartesian3())
// local.x = 东向偏移（米），local.y = 北向偏移（米），local.z = 天向偏移（米）
```
逆矩阵变换保证结果是**严格正交的局部坐标**。项目实测：**边长误差 < 0.01%**。
**解析**：这是一个「**数学直觉 → 数值验证 → 修正实现**」的完整案例。**面试时讲这个，效果拔群**——它同时证明了三件事：你懂线性代数、你会做数值验证、你能从"看起来对"里发现"其实错"。
> 记忆抓手：**「正变换把局部变世界，逆变换把世界变局部。想拿局部坐标，就用逆矩阵，别拿列向量凑。」**

**题 2**
```js
function computeEnuArea(points) {
  // ① 少于 3 个点构不成面
  if (points.length < 3) return 0

  // ② 以第一个点为局部坐标系原点
  const origin = points[0]

  // ③ 构造 ENU 局部系 → 世界系 的变换矩阵（4x4 齐次矩阵）
  const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(origin)

  // ④ 求逆：世界系 → 局部 ENU 系
  //    第二参数是"结果写入哪个 Matrix4"，避免每次 new（Cesium 的惯例）
  const inverseFrame = Cesium.Matrix4.inverse(enuFrame, new Cesium.Matrix4())

  // ⑤ 把每个世界坐标点变到局部平面坐标 (东, 北)
  const planar = points.map(p => {
    // multiplyByPoint 自动做齐次坐标除法（w=1）
    const local = Cesium.Matrix4.multiplyByPoint(inverseFrame, p, new Cesium.Cartesian3())
    return { e: local.x, n: local.y }   // 忽略 z（高度），投影到水平面
  })

  // ⑥ 鞋带公式累加（有向面积的两倍）
  let area = 0
  const n = planar.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n        // 最后一个点连回第一个点，闭合多边形
    area += planar[i].e * planar[j].n - planar[j].e * planar[i].n
  }

  // ⑦ 取绝对值除以 2（绝对值处理顺/逆时针；除以 2 是公式定义）
  return Math.abs(area) / 2
}
```
**解析**：每一处都有讲究：
- **③ `eastNorthUpToFixedFrame`**：Cesium 提供的标准 ENU 构造。**为什么以 `points[0]` 为原点**？因为局部平面近似的误差随「离原点距离」增长，选多边形上一点作原点，能让多边形尽量居中在原点附近。
- **④ `Matrix4.inverse(m, result)`**：Cesium 的 API 惯例是「把结果写进你传进去的对象」以复用内存——**在高频调用（每帧）的代码里，这个习惯能显著减少 GC 压力**。
- **⑤ 忽略 z**：把三维点投影到水平面。**这是"小范围平面近似"的具体体现**——校园只有一平方公里，地形起伏对面积影响可忽略。
- **⑥ `(i + 1) % n`**：用取模自动闭合首尾，比 `if (i === n-1) j = 0 else j = i+1` 优雅。
- **⑦ `Math.abs`**：鞋带公式算的是**有向面积**——顺时针为负、逆时针为正。用户可能顺时针也可能逆时针画，取绝对值才对。

**题 3 答案**
**取舍的本质是「精度需求 vs 实现成本」**：

| | 距离 | 面积 |
|---|---|---|
| 需求 | 要准到米级（用户会拿它量楼间距） | 校园尺度下，平面近似误差 < 0.01%，足够 |
| 球面方案 | `EllipsoidGeodesic.surfaceDistance`，**一行代码** | 球面多边形面积公式复杂（要考虑球面三角、极区奇点），易出错 |
| 平面方案 | 小范围下也可用，但**Cesium 已提供球面 API，白用不用** | ENU + 鞋带，**40 行清晰可读** |
| 项目选择 | **球面** | **局部平面** |
**一句话结论**：**「哪个简单又够用，就用哪个。」**
- 距离：Cesium 的 `EllipsoidGeodesic` 已经封装好球面计算，一行就有，没理由自己写平面近似。
- 面积：球面多边形面积需要引入更重的数学；而校园 1 平方公里范围内，ENU 平面近似的误差远小于用户关心的精度（实测 < 0.01%）。**为了那 0.01% 去写一大堆球面几何，是过度工程。**
**解析**：**注意这里的"不一致"是有意为之，不是疏忽**。面试如果被问「你项目里距离和面积用了不同的数学口径，不觉得混乱吗？」——正好是展示判断力的机会：
> 「它们是两个不同的量，对精度的敏感度不同。距离要跟后端的 PostGIS geography 口径一致（用户会对比），所以我用球面；面积是纯前端展示、校园尺度小，用局部平面在精度换实现简洁。**我清楚每一处的误差量级，也做过实测验证（100m 边误差 < 0.01%）。**」

**题 4 答案**
```js
function renderFormal() {
  clearFormal()          // ★ 先全清
  if (positions.length === 0) return
  positions.forEach(p => entities.push(viewer.entities.add({ position: p, point: {...} })))
  if (mode === 'distance') {
    // 重建线 + 每段标签 + 总长标签
  } else {
    // 重建面 + 面积标签
  }
}
```
**好处**：
1. **不会残留**：撤销（删掉最后一个点）后，如果做增量更新，很容易漏删「上一段的中点标签」「总长标签」——重建保证状态与数据严格一致。注释原话：「**重建全部正式实体（节点/线/面/标签），保证撤销后无残留**」。
2. **代码简单**：不用维护「哪个实体对应哪段距离」的映射关系，也不用写删除分支。
3. **正确性优先**：测量是「低频操作 + 用户可见的结果」，正确性远比性能重要。
**代价**：
- **O(n) 重建**：每次加点都删掉全部实体重新创建。
- 点数多时会有明显卡顿（每次 `entities.add/remove` 都触发 Cesium 内部更新）。
**可接受的规模**：测量场景下点数通常在 **几十个以内**（用户手动点），重建 50 个实体的开销微乎其微（< 1ms）。
**如果要优化**（比如支持导入一千个点的轨迹测量）：
1. **增量追加**：新增点时只 add 新实体，不重建（但要正确实现撤销时的删除）；
2. **分离图层**：把「预览」和「正式结果」分到两个 dataSource，减少增删范围；
3. **标签合批**：用 `LabelCollection` 而非独立 Entity。
**解析**：这就是**「用正确性换性能」的经典工程取舍**。
> 面试话术：「测量工具我选了**全量重建**而非增量更新——因为它的数据规模在几十个点，重建开销可忽略，但能彻底避免撤销时的实体残留。**只有在规模真的上来时才会引入增量更新的复杂度。**」

### 验证方法
打开 5173 → 侧边栏测量工具 → 左键连续打点 → 右键结束：
1. 测距：每段显示距离，末尾显示总长；
2. 测面积：显示多边形面积（`m²` 或 `公顷`）；
3. **验证精度**：沿一栋已知尺寸的建筑（比如后端返回 `area_sqm`）画一圈，对比前端算出的面积与接口返回的 `area_sqm`，误差应在 1% 以内；
4. Esc 取消、右键撤销，**验证无残留实体**。

### 自测清单
- [ ] 能说出「为什么必须用逆矩阵」
- [ ] 能默写鞋带公式并解释 `Math.abs` 的作用
- [ ] 能解释项目里「距离用球面、面积用平面」的取舍
- [ ] 知道全量重建 vs 增量更新的适用规模

---

## Day 21｜无人机实体与图标：用 Canvas 动态生成图标

### 学习目标
- 会用 `billboard` 创建图标实体，并理解 `color` 染色机制
- 会写 Canvas 绘制代码生成图标
- 理解「图标缓存」为什么是必要的优化

### 核心概念
- **`billboard`**：贴在屏幕上的图片（永远面向相机），适合做标记点。
- **`image`**：可以是 URL、base64 DataURL、或 HTMLCanvasElement。
- **`color`**：给图片**整体染色**（原图应该是白色剪影，染色后即状态色）。
- **`verticalOrigin` / `pixelOffset`**：图标锚点与偏移（让图标"站"在坐标点上而不是压在下面）。

### 项目对照
1. `utils/cesium.js` L431–450：`DRONE_COLORS` + `getDroneColor`
2. `utils/cesium.js` L452–493：`createDroneIcon`（**Canvas 绘制 + `cachedDroneIcon` 缓存**）
3. `utils/cesium.js` L494–547：`createDroneEntity` / `loadDrones`
4. `utils/cesium.js` L646–677：`loadRestaurantMarkers`
5. `utils/cesium.js` L678–770：`loadDormitoryMarkers`

### 课后实践题

**题 1**：读 `createDroneIcon`，说明为什么图标要画成**全白剪影**，以及 `cachedDroneIcon` 解决了什么问题。
**题 2**：写一个函数，用 Canvas 画一个 24×24 的红色三角形，作为 `billboard` 图标。
**题 3**：无人机有 4 种状态（空闲/配送中/充电中/维护），颜色不同。现在要给 20 架无人机建实体，问：需要调用 `createDroneIcon` 几次？为什么？
**题 4**：如果图标要「尖端对准坐标点、圆形主体在点上方」，应该怎么配 `verticalOrigin` 和 `pixelOffset`？

### 参考答案 + 解析

**题 1 答案**：
**为什么画全白剪影**：
`billboard.color` 是**乘法染色**——最终颜色 = 图片颜色 × `color`。如果原图是彩色的，染色后颜色会「混」得不可预测（比如红色 × 绿色 = 深黄黑）。
画成**全白**（RGB 255,255,255），白色 × 任意颜色 = **那个颜色本身**。所以只要一份白色图标，就能染成绿/金/蓝/红四种状态色——**一份资源，四种状态**。
**`cachedDroneIcon` 解决的问题**（项目注释原话）：
> 「结果按模块级缓存：图标是纯静态图形，但 `createDroneEntity` 每次新增无人机都会调用，**原实现每次重新绘制 + toDataURL（同步、开销不小）**，无人机数量一多就是无谓损耗。」
```js
let cachedDroneIcon = null
export function createDroneIcon() {
  if (cachedDroneIcon) return cachedDroneIcon     // ★ 只画一次
  // ... Canvas 绘制 ...
  cachedDroneIcon = canvas.toDataURL()
  return cachedDroneIcon
}
```
**解析**：两个性能点：
1. **`canvas.toDataURL()` 是同步阻塞操作**：它要把 canvas 像素编码成 base64 PNG，主线程会卡住。20 架无人机 = 20 次编码 = 明显卡顿。
2. **同一份图标可以共享**：图标是纯静态图形，和具体无人机无关。**「能共享的资源就别重复创建」**——这个思路和 Day 12 的「复用同一份 `HOVER_COLOR`」是同一个道理。
> 泛化：**「模块级缓存 + 惰性初始化」是前端最常用的优化模板**。写法就是 `let cache = null; if (cache) return cache; ... cache = 计算(); return cache`。

**题 2**
```js
function createRedTriangleIcon(size = 24) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  ctx.beginPath()
  ctx.moveTo(size / 2, 2)              // 顶点（上中）
  ctx.lineTo(size - 2, size - 2)       // 右下
  ctx.lineTo(2, size - 2)              // 左下
  ctx.closePath()

  ctx.fillStyle = '#E74C3C'
  ctx.fill()
  // 白色描边让图标在任何底图上都清晰
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.stroke()

  return canvas.toDataURL()
}

// 使用
viewer.entities.add({
  position: Cesium.Cartesian3.fromDegrees(114.468, 37.984, 50),
  billboard: {
    image: createRedTriangleIcon(),
    width: 32,
    height: 32,
    // 让三角形尖端（上中）对准坐标点
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    disableDepthTestDistance: Number.POSITIVE_INFINITY   // ★ 永不被地形/建筑遮挡
  }
})
```
**解析**：
- **Canvas 坐标原点在左上角**，y 轴向下。所以「顶点」用 `y = 2`（靠上），底边用 `y = size - 2`（靠下）。**这一点和数学坐标系相反，是 Canvas 新手第一大坑。**
- **`disableDepthTestDistance: Number.POSITIVE_INFINITY`**：让图标永远显示在最前面。**做「标记点」类图层时这个配置几乎必备**——否则无人机飞到大楼背面时会被楼挡住，「看不见但数据显示它在那儿」，用户体验很糟。
- **白色描边**：底图有明暗变化（影像底图的深色水面/浅色路面），纯色图标在某些区域会看不清。加一层对比描边是最简单的解法。
> 项目对照：`createDroneIcon` 用的是 `requestAnimationFrame` 前的四旋翼俯视造型；`loadRestaurantMarkers` / `loadDormitoryMarkers` 用的是 emoji/文字版 Canvas 图标（更简单）。**同一个 canvas 图标技术，可以按场景选择精细度。**

**题 3 答案**：
**1 次**（或者 0 次，如果之前已经调用过）。
因为 `createDroneIcon()` 内部有模块级缓存 `cachedDroneIcon`，第一次调用后结果被缓存，后面 19 次直接返回缓存值。
**颜色差异通过 `billboard.color` 实现**——**图标本身是白色一份，颜色是渲染时染的**：
```js
export function createDroneEntity(drone) {
  return {
    id: `drone-${drone.id}`,
    position: Cesium.Cartesian3.fromDegrees(drone.current_lng, drone.current_lat, 50),
    billboard: {
      image: createDroneIcon(),              // ← 同一份 base64 字符串，共享
      color: getDroneColor(drone.status),    // ← 每个实体不同（绿/金/蓝/红）
      width: 32, height: 32,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    },
    // 自定义元数据，供点击判断/更新使用
    _droneId: drone.id
  }
}
```
**解析**：**「资源（白色图标）+ 属性（color）」分离**是图形编程的通用思路，和 WebGL 里的「共用纹理 + 不同 uniforms」是一个道理。
> 一个隐藏好处：**20 个 billboard 用同一张图，Cesium/WebGL 可以把它作为同一个纹理上传 GPU 一次**，而不是 20 张纹理。**显存和批次都省了。**

**题 4 答案**
```js
billboard: {
  image: createDroneIcon(),
  verticalOrigin: Cesium.VerticalOrigin.BOTTOM,   // 图片底边对齐坐标点
  pixelOffset: new Cesium.Cartesian2(0, -2)       // 再上移 2 像素留缝
}
```
**要点**：
- **`verticalOrigin: BOTTOM`**：图片的**底边**与坐标点对齐——图标「站」在点上。
- **`verticalOrigin: CENTER`**（默认）：图片**中心**与坐标点对齐——图标「压」在点上（无人机用这个更合适，因为它悬在空中）。
- **`CENTER` + 需要上移**：用 `pixelOffset: new Cesium.Cartesian2(0, -h/2)`（**y 为负是向上**）。

| 场景 | verticalOrigin | 说明 |
|---|---|---|
| 无人机（悬空） | `CENTER` | 图标中心=坐标点，符合「悬在空中」的直觉 |
| 地面标记/图钉 | `BOTTOM` | 图标底部=坐标点，符合「插在地上」的直觉 |
| 标签文字 | `BASELINE` | 文字基线对齐 |

**解析**：`pixelOffset` 的坐标系是**屏幕坐标（y 轴向下）**，所以**负值表示向上偏移**。这个「屏幕坐标系 y 轴向下」的问题在 Cesium 里反复出现（canvas 绘图、pixelOffset、鼠标坐标），**记住一句话：屏幕上 y 越大越靠下。**
> 项目对照：`loadRestaurantMarkers` / `loadDormitoryMarkers` 要给「图标 + 文字标签」做组合布局，就是靠 `pixelOffset` 把标签挪到图标下方——**同一个知识点，更复杂的应用**。

### 验证方法
打开 5173，勾选「无人机」图层：
1. 能看到 20 架左右无人机图标，颜色按状态区分（绿=空闲、金=配送中、蓝=充电、红=维护）；
2. 无人机飞到楼后面时**依然可见**（`disableDepthTestDistance` 生效）；
3. 在 DevTools 里把网络限速打开，观察无人机数量多时的渲染帧率。

### 自测清单
- [ ] 知道 `billboard.color` 是乘法染色，所以原图要白色
- [ ] 会写 `createXxxIcon` 的「模块级缓存」模板
- [ ] 知道 `verticalOrigin` 各值的适用场景
- [ ] 记得屏幕坐标 y 轴向下

---

## Day 22｜航线绘制与飞行动画

### 学习目标
- 会画带高度的三维航线（polyline + 位置高度）
- 会用 `SampledPositionProperty` + `Clock` 做时间插值动画
- 理解多视角相机跟随的实现思路

### 核心概念
- **`SampledPositionProperty`**：把「时间 → 位置」的采样点存起来，Cesium 自动插值。动画的核心。
- **`Clock` + `shouldAnimate`**：Cesium 的时钟，推进时间才能让插值动起来。
- **`JulianDate`**：Cesium 的时间类型（天文儒略日）。`addSeconds` 加时间。
- **`Viewer.trackedEntity`**：相机跟随实体（第一/第三人称）。
- **`CallbackProperty`**：用一个函数动态计算属性值（每帧调用），适合做「尾迹长度」「实时高度」等动态量。

### 项目对照
1. `utils/cesium.js` L548–603：`parseRouteGeojson` + `loadRoute`
2. `utils/cesium.js` L771–1022：`createDroneAnimation`（**250 行，项目最复杂的函数**）
3. `utils/cesium.js` L439–443：`ROUTE_PHASE_COLORS`（上升/巡航/下降分色）
4. `CesiumViewer.vue` L442–476：`smoothMoveEntity`（postUpdate 平滑移动）
5. `CesiumViewer.vue` L477–525：`updateDroneTrail`（金色尾迹）
6. `components/OrderDetail.vue`：动画控制 UI（播放/暂停/视角切换）

### 课后实践题

**题 1**：航线的 GeoJSON 只有经纬度（二维），但无人机要飞在 50 米高。请写出把二维航线转成三维 polyline 的关键代码。
**题 2**：用 `SampledPositionProperty` 实现「一个点从 A 匀速移动到 B，耗时 10 秒」的最小动画。
**题 3**：动画播完了怎么知道？`isFinished` 是属性还是方法？项目是怎么处理"播完自动复位"的？
**题 4**：无人机「实时位置推进」和「飞行动画」是两套不同的机制吗？为什么要分成两套？

### 参考答案 + 解析

**题 1**
```js
export function parseRouteGeojson(geojsonStr) {
  const geom = typeof geojsonStr === 'string' ? JSON.parse(geojsonStr) : geojsonStr
  if (!geom || geom.type !== 'LineString') return []
  return geom.coordinates.map(c => [c[0], c[1]])   // [[lng, lat], ...]
}

export function loadRoute(viewer, route, name, color, altitude = 50) {
  const coords = parseRouteGeojson(route.route_geom || route.routeGeojson)
  if (coords.length < 2) return null

  // ★ 关键：把 [lng, lat] 展开成一维数组 [lng,lat,lng,lat,...]，再统一给高度
  const flat = []
  for (const [lng, lat] of coords) { flat.push(lng, lat, altitude) }
  // 或用 Cesium 的便捷 API（等价）
  // const positions = Cesium.Cartesian3.fromDegreesArrayHeights(flat)

  const positions = Cesium.Cartesian3.fromDegreesArrayHeights(flat)

  const ds = new Cesium.CustomDataSource(name)
  ds.entities.add({
    polyline: {
      positions,
      width: 3,
      material: color || Cesium.Color.fromCssColorString('#FFD700'),
      clampToGround: false          // ★ 有高度的线不能贴地
    }
  })
  viewer.dataSources.add(ds)
  return ds
}
```
**解析**：
- **`fromDegreesArrayHeights([lng,lat,h, lng,lat,h, ...])`**：注意传的是**扁平数组**，不是 `[[lng,lat,h], ...]`。这是 Cesium 数组类 API 的一致约定（`fromDegreesArray` 也同理）。**传错了会得到一堆乱七八糟的点或者直接报错**。
- **`clampToGround: false`**：有高度的三维线**不能贴地**（贴地会忽略高度）。同 Day 15 的逻辑——**贴地和带高度互斥**。
- **高度从哪来**：项目里航线高度是**后端算的**。`OrderServiceImpl` 注释（L196）：
  > 「飞行高度 = 起终点建筑中较高者 + 30m 安全余量（更直观贴合建筑）」
  **注意这个业务逻辑**——无人机要飞过楼，所以高度必须比楼高，否则航线会穿楼而过。**这才是"数字孪生"该有的样子：空间数据参与业务计算。**

**题 2**
```js
function createLinearAnimation(viewer, startDeg, endDeg, durationSeconds = 10) {
  const start = Cesium.JulianDate.fromDate(new Date())
  const stop = Cesium.JulianDate.addSeconds(start, durationSeconds, new Cesium.JulianDate())

  // ① 关闭默认时钟范围设置，手动控制
  viewer.clock.startTime = start.clone()
  viewer.clock.stopTime = stop.clone()
  viewer.clock.currentTime = start.clone()
  viewer.clock.clockRange = Cesium.ClockRange.CLAMP     // 播到结束就停住（不循环）
  viewer.clock.multiplier = 1                          // 1 倍速
  viewer.clock.shouldAnimate = true                    // ★ 必须为 true，否则不推进

  // ② 定义位置属性并打两个采样点
  const property = new Cesium.SampledPositionProperty()
  const startPos = Cesium.Cartesian3.fromDegrees(startDeg[0], startDeg[1], 50)
  const endPos = Cesium.Cartesian3.fromDegrees(endDeg[0], endDeg[1], 50)
  property.addSample(start, startPos)
  property.addSample(stop, endPos)
  // ③ 让插值走测地线（沿地球表面）而不是直线穿地
  property.setInterpolationOptions({
    interpolationDegree: 1,
    interpolationAlgorithm: Cesium.LinearApproximation
  })

  // ④ 建实体
  const entity = viewer.entities.add({
    availability: new Cesium.TimeIntervalCollection([
      new Cesium.TimeInterval({ start, stop })
    ]),
    position: property,
    billboard: { image: createDroneIcon(), width: 32, height: 32,
                 color: Cesium.Color.GOLD, disableDepthTestDistance: Number.POSITIVE_INFINITY }
  })

  return { entity, start, stop }
}
```
**解析**：动画三要素**缺一不可**：
1. **`SampledPositionProperty`**（数据）：至少两个采样点（起点时间 + 终点时间），Cesium 中间自动插值。
2. **`Clock` 配置正确**（时间轴）：`startTime` / `stopTime` / `currentTime` / `shouldAnimate`。
3. **`viewer.clock.shouldAnimate = true`**（开关）：**这个漏了动画就是不播，而且不报错**——项目 `initViewer` 里显式设了 `shouldAnimate: true`（L148），就是为这个。
> `Cesium.ClockRange.CLAMP` 有三个值要区分：
> - `CLAMP`：播到 stopTime 就停住（**动画播完保持最后状态**）✓ 常用
> - `LOOP_STOP`：循环播放
> - `UNBOUNDED`：一直往前走
> 想要「循环播放轨迹动画」就用 `LOOP_STOP`。

**题 3 答案**：
`isFinished` 是**属性**（布尔），不是方法。
```js
// ❌ 错：会抛 TypeError
if (viewer.clock.isFinished()) { ... }

// ✅ 对
if (viewer.clock.isFinished) { ... }
```
项目的处理方式（`CesiumViewer.vue` L104–128）：
```js
let animationFinishTimer = null

function clearAnimationFinishTimer() {
  if (animationFinishTimer) { clearInterval(animationFinishTimer); animationFinishTimer = null }
}

// 用轮询检测播完
animationFinishTimer = setInterval(() => {
  if (viewer.clock.isFinished) {
    clearAnimationFinishTimer()
    mapStore.stopAnimation()        // 复位 UI 状态
    // 其他收尾：恢复无人机图标、清理尾迹…
  }
}, 200)
```
**解析**：
- 项目用一个**模块级的 `animationFinishTimer`**，并且注释说明了原因（L106）：
  > 「动画结束轮询句柄（模块级，**手动停止/送达时统一清理，防止泄漏**）」
- **清理入口统一**（L122–128 注释）：「`isFinished` 轮询与手动停止共用同一清理入口」——**这是防止泄漏的关键设计**。如果「手动停止」和「自然播完」各写一套清理代码，早晚会漏一个。
- **为什么用轮询而不是事件**：Cesium 的 `Clock` 没有「播放结束」事件，只能轮询 `isFinished`。轮询间隔 200ms 足够（动画收尾对实时性要求不高），而且比每帧检查省。
> **注意项目里的同类坑**：`CesiumViewer.vue` L115–120 还有一个 `clearSmoothMoveRemovers()`，专门清理 `scene.postUpdate` 上注册的监听器——注释说「避免 postUpdate 上残留闭包」。**闭包持有外部变量（如 entity / viewer），不清就会内存泄漏。**

**题 4 答案**：
**是两套不同机制**：

| | 实时位置推进 | 飞行动画 |
|---|---|---|
| 触发 | 配送中**持续进行** | 用户在订单详情**手动播放** |
| 数据源 | 后端每 2 秒推进无人机位置，前端轮询同步 | 前端根据**已保存的航线**本地插值 |
| 实现 | `syncDronePositions` 轮询 + `smoothMoveEntity` 平滑插值 | `createDroneAnimation` + `SampledPositionProperty` |
| 时间语义 | 跟随**真实时间**（现在） | 回溯/演示一段**历史或计划的飞行** |
| 目的 | 让地图上的无人机「活」起来 | 让用户「看清」这条航线怎么飞 |

**为什么要分开**：
1. **语义不同**：实时推进是「现在飞到哪了」，动画是「这条航线长什么样」。混在一起会导致「我一点订单详情，地图上的无人机就跳到航线起点」这种荒谬行为。
2. **数据来源不同**：实时位置来自后端（每 2 秒上报），动画位置来自本地插值（不需要后端持续推）。
3. **生命周期不同**：实时推进随页面存在而存在；动画是「用户主动开始 → 主动结束/播完」的有限过程。
4. **平滑方式不同**：实时推进用 `postUpdate` 做「从当前位置到新位置」的短距离插值（`smoothMoveEntity`），动画用 `SampledPositionProperty` 做精确时间轴插值。
**解析**：项目里 `CesiumViewer.vue` 的 `syncDronePositions`（L386）+ `smoothMoveEntity`（L442）与 `utils/cesium.js#createDroneAnimation`（L771）是两套独立实现，**这是有意的架构分离，不是代码重复**。
> 面试话术：「我把『实时状态同步』和『历史/计划航线回放』严格分开了。前者是**数据同步问题**（怎么把后端状态平滑地映射到地图上），后者是**时间轴插值问题**（怎么把一条静态航线变成动画）。**两个问题的本质不同，所以用了两套机制。**」
> **加分补充**：实时推进里的「平滑」很有讲究——后端每 2 秒给一次位置，如果直接 `entity.position = newPos`，无人机会**每 2 秒猛跳一下**。`smoothMoveEntity` 用 `postUpdate` 监听器在 2 秒内做插值，**让"离散的 2 秒采样"看起来像"连续飞行"**——这就是「用动画掩盖低采样率」的经典技巧。**面试官听到这里，会知道你真的做过。**

### 验证方法
打开 5173 → 订单面板 → 点一个订单 → 「播放动画」：
1. 无人机从餐厅起飞，沿航线飞行，**高度在 50 米左右**（能看到它在地面之上）；
2. 航线分段染色（红=上升、黄=巡航、蓝=下降）；
3. 有金色尾迹线；
4. 切换「跟随 / 第一人称 / 俯瞰」三种视角；
5. 点「暂停」→ 动画停住；点「停止」→ 复位；**连点几次播放/停止，观察是否出现多个无人机实体残留**（有残留说明清理不干净）。

### 自测清单
- [ ] 会写 `fromDegreesArrayHeights` 的正确参数格式
- [ ] 知道动画三要素（属性 + Clock 配置 + shouldAnimate）
- [ ] 知道 `isFinished` 是属性不是方法
- [ ] 能说清「实时推进」和「飞行动画」为什么分两套

---

## Day 23｜三维拾取与业务联动：订单/无人机/建筑弹窗

### 学习目标
- 掌握「自定义事件总线」式的组件解耦
- 理解 `order → drone → route` 三者的业务联动
- 会处理「点击 3D 对象 → 打开对应面板」的完整链路

### 核心概念
- **组件解耦**：Cesium 场景（`CesiumViewer.vue`）和业务面板（`OrderPanel.vue`）之间**不能互相 import**（否则循环依赖）。项目用 **`window` 自定义事件**做通信。
- **事件驱动**：一方 `dispatchEvent`，另一方 `addEventListener`。
- **元数据挂载**：把业务 id 挂在 Cesium 实体上（`entity._droneId`），点击时才找得到「这是哪架无人机」。

### 项目对照
1. `CesiumViewer.vue` L842–848：`registerCustomEventListeners` / `hideDroneIcon` / `restoreDroneIcon`
2. `CesiumViewer.vue` L108–112：`eventListeners` 数组 + **卸载时统一移除**
3. `CesiumViewer.vue` L683–800：`handleLeftClick` 的分支逻辑（测量/航线规划/建筑/无人机）
4. `components/OrderDetail.vue` / `OrderPanel.vue` / `DronePanel.vue`
5. `components/BuildingPopup.vue`

### 课后实践题

**题 1**：`CesiumViewer.vue` 用 `window.addEventListener` 接收自定义事件。为什么不用 Pinia 或 props/emit？各自的适用场景是什么？
**题 2**：`handleLeftClick` 里要按优先级判断「现在是测量模式？航线规划模式？还是普通点击？」。请写出这个优先级判断的骨架，并说明为什么这个顺序不能乱。
**题 3**：点击无人机图标时，怎么知道点的是哪一架？写出关键代码。
**题 4**：`eventListeners.forEach(({ event, handler }) => window.removeEventListener(event, handler))` 这行代码如果不写会怎样？

### 参考答案 + 解析

**题 1 答案**
**为什么不用 Pinia**：可以，但有两个代价：
1. **语义不匹配**：Pinia 适合存**状态**（订单列表、选中项）；而这里是「**一次性通知**」（"播放这个订单的动画"），不是状态；
2. **时序耦合**：如果放 store，需要「改一个 flag → watcher 触发 → 处理完还要复位 flag」，绕且容易出 bug（漏复位就再也不会触发第二次）。
**为什么不用 props/emit**：
`OrderDetail.vue` 和 `CesiumViewer.vue` 是**兄弟组件**（同级挂在 `App.vue` 下），emit 只能逐层往上传，需要 `App.vue` 当中间人转发——**层级一深就变成"事件接力"**。
**项目的选择**：`window` 自定义事件。
```js
// 发送方（OrderDetail.vue）
window.dispatchEvent(new CustomEvent('order:play-animation', { detail: { orderId } }))

// 接收方（CesiumViewer.vue）
const handler = (e) => { startAnimation(e.detail.orderId) }
window.addEventListener('order:play-animation', handler)
eventListeners.push({ event: 'order:play-animation', handler })   // 登记，便于统一清理
```
**解析**：三种通信方式对比（**面试常考**）：

| 方式 | 适用 | 缺点 |
|---|---|---|
| props / emit | 父子组件 | 跨层级要「接力」，深了很难维护 |
| Pinia | **状态共享**（多组件读同一份数据） | 不适合「一次性动作」通知 |
| window 自定义事件 | **解耦的跨组件通知**（尤其是"命令"型） | 全局命名空间、类型不安全、易忘清理 |

> 项目选用 window 事件的核心动机：**`CesiumViewer.vue` 是 42KB 的巨型组件，如果它 import 所有业务面板，会形成密集依赖网**。用事件解耦后，`CesiumViewer` 只需要知道「有个 `order:play-animation` 事件」，**不需要认识 `OrderDetail`**。
> **现代替代方案**：`mitt`（几百字节的事件总线库）或 `provide/inject`。**但核心思想是一样的：用「消息」代替「引用」。**

**题 2 答案**
```js
async function handleLeftClick(viewer, movement) {
  // 优先级 1：测量模式 —— 最高优先级，测量期间地图点击全归测量
  if (mapStore.measureMode) return

  // 优先级 2：航线规划模式 —— 点击地图选起点/终点
  if (routePlanMode.value) {
    const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid)
    if (!cartesian) return
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
    const lng = Cesium.Math.toDegrees(cartographic.longitude)
    const lat = Cesium.Math.toDegrees(cartographic.latitude)
    if (routePlanMode.value === 'selectingStart') mapStore.setPlanStart({ lng, lat, name: `...` })
    else if (routePlanMode.value === 'selectingEnd') mapStore.setPlanEnd({ lng, lat, name: `...` })
    return
  }

  // 优先级 3：普通点击 —— 先试实体拾取（无人机/建筑）
  const picked = viewer.scene.pick(movement.position)
  const entity = picked?.id
  if (entity?._droneId) { /* 打开无人机面板 */ return }
  if (entity?._buildingType) { /* 打开建筑弹窗 */ return }

  // 优先级 4：兜底 —— 经纬度反查建筑
  const cartesian = resolvePickPosition(viewer, movement.position)
  if (!cartesian) { mapStore.clearSelection(); return }
  // ... 转经纬度 → 调 pointQuery → 显示弹窗
}
```
**为什么顺序不能乱**：
- **测量/规划是「独占模式」**：用户点了"开始测量"就表示「接下来我的点击都是打点」。如果这时还去触发建筑弹窗，用户点第一个测量点就弹出建筑信息——**完全无法测量**。
- **实体拾取要在经纬度反查前面**：因为 `scene.pick` 能精确告诉你「点到的是哪架无人机」；而经纬度反查只能问「这个位置有什么建筑」。**先用精确的，再用模糊的。**
- **兜底放最后**：前三个都不匹配时，才走"通用建筑查询"。
**解析**：这种「**模式判定 → 精确拾取 → 模糊兜底**」的三段式结构，是任何「多模式 + 多可点对象」的 3D 应用的标准骨架。**模式判断永远在最前面**，因为模式意味着「用户意图压过一切默认行为」。
> 项目里还有个细节（L590–593）：**悬停高亮也会检查模式**：
> ```js
> if (mapStore.measureMode || routePlanMode.value) { setCursor(''); return }
> ```
> 注释：「测量/航线规划模式下不介入，**避免与取点交互抢反馈**」。**光标样式的一致性**也很重要——测量模式下光标不该变成手型。

**题 3 答案**
```js
// ① 创建实体时，把业务 id 挂在实体上
export function createDroneEntity(drone) {
  return {
    id: `drone-${drone.id}`,
    position: ...,
    billboard: { ... },
    _droneId: drone.id,          // ★ 自定义元数据
    _droneStatus: drone.status
  }
}

// ② 点击时读取
const picked = viewer.scene.pick(movement.position)
const entity = picked?.id              // ★ scene.pick 返回 {id: Entity, primitive: ...}
if (entity?._droneId) {
  const drone = mapStore.drones.find(d => d.id === entity._droneId)
  mapStore.selectDrone(drone)
  mapStore.togglePanel('drone')        // 打开无人机面板
  return
}
```
**解析**：三个要点：
1. **`picked?.id`**：`scene.pick` 返回的是一个**包装对象** `{ id, primitive, detail }`，实体在 `.id` 里。**直接拿 `picked` 当实体用是新手最常犯的错**（会得到 `undefined` 属性）。
2. **用下划线前缀**（`_droneId`）：Cesium 的 `Entity` 有很多内置属性（`position`/`billboard`/`polygon`…），自定义元数据加下划线可以**明确区分**「这是我加的」和「这是框架的」。项目里 `entity._buildingType`（L142）、`entity._tableName`（L143）、`entity._centroidLng/Lat`（L149–150）都是这个约定。
3. **通过 id 反查最新数据**（`mapStore.drones.find(...)`）而不是把整个 drone 对象挂在实体上：**因为无人机状态会变（位置、电量）**。实体上挂的是**不可变标识**，数据永远从 store 取最新——**避免"实体上的数据过期了但没人更新"这类 bug**。
> 项目里 `hideDroneIcon` / `restoreDroneIcon`（L844–855）就是通过 `entity._droneId` 找到对应实体来隐藏/恢复图标的。

**题 4 答案**
不写会导致 **window 上堆积监听器**（**内存泄漏**）：
1. **每次组件挂载都 add 一次**：单页应用里路由切换来回几次，同一个事件被注册 N 次，**一次 dispatch 触发 N 个 handler**（动画播放 N 遍、请求发 N 次）；
2. **闭包持有已销毁的 viewer**：handler 闭包里引用了 `viewer`，viewer 被 `destroy()` 后监听器还在，**触发时报错 `Cannot read property of null`**，而且这些闭包让 viewer 无法被 GC 回收；
3. **`window` 是全局对象，永远存活**：所以被它引用的 handler、handler 引用的闭包变量，**全都不会被回收**。SPA 里这是最典型的内存泄漏来源之一。
**项目的做法**（L108、L190–193）：
```js
let eventListeners = []      // 登记所有自定义事件的 {event, handler}
// 注册时
eventListeners.push({ event: 'xxx', handler })
// 卸载时统一移除
eventListeners.forEach(({ event, handler }) => window.removeEventListener(event, handler))
```
**解析**：这是**「登记表 + 统一释放」模式**（Day 17 的 `smoothMoveRemovers` 也一样）。它的价值在于：
> **「谁申请谁释放」说起来简单，但人类记不住。用数据结构把"所有需要释放的东西"收集起来，卸载时遍历释放——把"记忆"变成"机制"。**
**在 Vue 里的现代写法**：其实可以直接用 `onBeforeUnmount` 里逐个移除，但**维护成本高**（新增一个监听就要记得加一行清理）。项目用数组收集更稳妥。
> **顺带一个重要细节**：`window.addEventListener` 注册的 handler 必须**是同一个函数引用**才能 remove 成功：
> ```js
> window.addEventListener('e', () => {...})     // ❌ 匿名函数，remove 不掉
> const h = () => {...}; addEventListener('e', h); removeEventListener('e', h)   // ✅
> ```
> 项目用 `handler` 变量存引用（L842–846），**这是正确写法**。用匿名函数注册的话，`removeEventListener` 静默失败——**不报错，但不生效**，又是一个静默 bug。

### 验证方法
打开 5173：
1. 点无人机图标 → 侧边栏切到无人机面板且选中该机；
2. 点建筑 → 弹出建筑弹窗；
3. 点空地 → 弹窗消失；
4. **在路由/组件间来回切换几次**（或直接改代码触发 HMR），再点无人机 → **确认只触发一次**（没重复播放动画/重复请求）；
5. DevTools → Memory → 拍两次堆快照（切换前后），看 detached 对象是否持续增长。

### 自测清单
- [ ] 能对比 props / Pinia / window 事件三种通信方式
- [ ] 能说出 `handleLeftClick` 的优先级顺序及理由
- [ ] 知道 `scene.pick()` 返回的是包装对象，实体在 `.id`
- [ ] 知道 `removeEventListener` 必须传同一函数引用

---

## Day 24｜pgRouting 与 A\* 路径规划

### 学习目标
- 理解「导航网格 + 图搜索」解决路径规划的思路
- 会用 `pgr_astar` 求最短路径
- **理解「限飞区避让」的三层设计：节点缓冲 + 边级过滤 + 成本惩罚**

### 核心概念
- **图（Graph）**：由**节点（node）**和**边（edge）**组成。路径规划 = 在图上找最优路径。
- **导航网格**：把连续空间**离散化**成规则网格，每个格点是一个节点，相邻格点连成边。
- **A\* 算法**：Dijkstra + **启发式函数**（估计到终点的距离），优先扩展「看起来更接近目标」的节点。
- **`pgr_astar`**：pgRouting 提供的 A* 实现。要求边表有 `source`、`target`、`cost`，以及坐标列 `x1,y1,x2,y2`（启发式用）。
- **`<->` 运算符**：PostGIS 的 KNN（最近邻）距离算子，**能用空间索引**：
  ```sql
  ORDER BY geom <-> ST_SetSRID(ST_MakePoint(lng, lat), 4326) LIMIT 1
  ```

### 项目对照
1. `backend/.../mapper/NavigationMapper.java` L21–28：`pgr_astar` 调用
2. 同文件 L33–40：`findNearestWalkableNode`（KNN + `is_walkable`）
3. 同文件 L46–51：`buildRouteFromNodes`（节点序列 → LineString）
4. 同文件 L56–69：`checkLineCrossNoFlyZone`（直线穿越检测）
5. 同文件 L75–82：`checkPathCrossNoFlyZone`（路径穿越检测）
6. `backend/.../service/impl/RouteServiceImpl.java` 全文（217 行，**Step 1–8 的注释就是完整算法说明**）
7. `docs/sql/05_setup_pgrouting_navigation.sql`（11KB，**网格生成 + 避让设计**）
8. `README.md` 第 317–322 行（面试亮点 1–4）

### 课后实践题

**题 1**：按顺序说出 `RouteServiceImpl#plan` 的 8 个步骤，每步在做什么。
**题 2**：`pgr_astar` 的 SQL 里 `edge = -1` 的记录为什么要过滤掉？
**题 3**：项目如何判断「A\* 成功绕开了限飞区」？请写出判断条件的真值表。
**题 4**：15 米分辨率的导航网格，一平方公里校园大约有多少节点？如果改成 5 米会怎样？
**题 5**：为什么用「网格 + A\*」而不是「直接连一条直线」？如果两点直线不穿限飞区，A\* 还有意义吗？

### 参考答案 + 解析

**题 1 答案**（照 `RouteServiceImpl#plan` 的 Step 注释）
```
Step 0: 飞行高度兜底 —— altitude 为 null 时用默认 50m（避免 BigDecimal.valueOf(null) NPE）
Step 1: 找起点最近的可飞行网格节点 —— findNearestWalkableNode(startLng, startLat)
Step 2: 找终点最近的可飞行网格节点 —— findNearestWalkableNode(endLng, endLat)
Step 3: 调用 pgr_astar 求最短路径 —— findShortestPath(startNodeId, endNodeId)
Step 4: 提取路径节点 ID 列表（按 path_seq 排序）
Step 5: 根据节点 ID 列表构建航线几何并计算距离
        - buildRouteFromNodes → ST_MakeLine + ST_Length(geography)
Step 5.1: 防空判 —— routeGeojson 为空时抛异常
        （起终点为同一节点时 ST_MakeLine 产不出有效 LineString，
          必须在 saveRoute 访问 waypoints[0] 之前拦截，否则越界崩溃）
Step 6: 计算途径点坐标（用 Jackson 从 GeoJSON 提取，替代脆弱的手工字符串截取）
Step 7: 计算预计飞行时间 —— ceil(distanceM / FLIGHT_SPEED)，FLIGHT_SPEED = 5 m/s
Step 8: 真实穿越检测
        8.1 起终点【直线】是否穿越限飞区 → crossedZones
        8.2 A* 规划的【路径边集合】是否仍与限飞区相交 → pathCrossZones
        判定：avoidedNoFlyZone = straightLineCrossZone && !routeStillCrossZone
```
**解析**：这套流程的精妙处在于 **Step 8 的双重检测**：
- 只检测「直线穿越」→ 只知道「本来会穿」，不知道「现在绕开了没」；
- 只检测「路径穿越」→ 如果本来就不穿，路径也不穿，看不出 A* 有没有起作用；
- **两者都检测** → 才能得出「**本来要穿，规划后不穿了 = 成功避让**」这个有业务价值的结论。
> 前端展示的正是这个结论（`RoutePlanPanel.vue`）："直线穿越限飞区：是 / 规划路径穿越：否 / **成功避让：是**"。**这是「用数据讲清系统的智能行为」，比单纯画一条线有说服力得多。面试重点。**

**题 2 答案**：
`pgr_astar` 返回的结果里，**起点那条记录的 `edge` 是 `-1`**（起点没有入边）。
如果不过滤：
```java
List<Integer> edgeIds = pathResult.stream()
    .filter(m -> m.get("edge") != null && ((Number) m.get("edge")).intValue() > 0)   // ★ 过滤
    .map(m -> ((Number) m.get("edge")).intValue())
    .distinct()
    .collect(Collectors.toList());
```
`-1` 会被当成一个合法的边 id 传进 `checkPathCrossNoFlyZone` 的 `IN (...)` 里，导致：
1. **查不到对应边**（没有 id=-1 的边），结果无影响但**语义错误**；
2. 更糟的情况：如果某张表恰好有 id 为负数或 0 的行，会**误判穿越**。
**解析**：这是「**理解第三方库的返回约定**」的典型例子。`pgr_astar` 的返回列是：
| 列 | 含义 |
|---|---|
| `seq` | 结果序号 |
| `path_seq` | **路径上的顺序**（用于排序！） |
| `node` | 当前节点 id |
| `edge` | **到达该节点所经过的边 id**（起点为 -1） |
| `cost` | 该段代价 |
| `agg_cost` | 累计代价 |
> 项目用 `path_seq` 排序（Step 4），**用 `agg_cost` 就能得到总代价**。**认真读一遍官方文档的返回列说明，能省掉大量猜测。**
> 顺带：`Map<String,Object>` 里从数据库取的数值可能是 `Long`/`Integer`/`BigDecimal`，所以项目统一用 `((Number) x).intValue()` 转换——**这是 JDBC 类型不确定性的防御写法**，比直接强转 `(Integer)` 安全。

**题 3 答案**
```java
boolean straightLineCrossZone = crossedZones != null && !crossedZones.isEmpty();
boolean routeStillCrossZone = pathCrossZones != null && !pathCrossZones.isEmpty();
boolean avoidedNoFlyZone = straightLineCrossZone && !routeStillCrossZone;
```
真值表：

| 直线穿越 | 路径穿越 | avoidedNoFlyZone | 业务含义 |
|---|---|---|---|
| false | false | **false** | 本来就不用绕，A\* 也没穿（**没发生避让行为**）|
| false | true | **false** | 诡异情况：直线不穿但路径穿了 → **说明规划有问题** |
| true | false | **true** | **✅ 成功避让**（本系统的核心价值）|
| true | true | **false** | **避让失败**（路径仍然穿越，应该告警）|

**解析**：
- 第 3 行（`true, false`）是**系统想要的结果**：路径规划确实起了作用。
- 第 4 行（`true, true`）值得注意：**这说明避让逻辑没生效**。项目里如果出现这种情况，说明「边级过滤 + 成本惩罚」没拦住——**这应该被监控和告警，而不是静默返回**。
- 第 2 行（`false, true`）理论上不该出现。如果出现，说明「直线检测」和「路径检测」的口径不一致（比如一个用直线几何、一个用边的包围盒），**是潜在 bug 的信号**。
> **面试加分**：主动说出「第 4 行是我设计时要避免的失败态」，展示你**思考过失败场景**，而不只是实现了 happy path。

**题 4 答案**
**节点数量估算**：
```
校园约 1 平方公里 = 1,000,000 m²
15m 分辨率 → 网格步长 15m
节点数 ≈ (1000/15) × (1000/15) ≈ 67 × 67 ≈ 4,489 个节点
边数 ≈ 节点数 × 8（8 邻域）÷ 2 ≈ 17,000 条边（有向图另算）
```
（实际还要扣掉建筑占地、限飞区、不可飞行区域，所以更少。）
**改成 5 米**：
```
节点数 ≈ (1000/5) × (1000/5) = 40,000 个节点     （约 9 倍）
边数 ≈ 40,000 × 8 / 2 = 160,000 条边           （约 9 倍）
```
影响：
1. **路径更精细**：能绕开更窄的障碍、路径更贴合直线（15m 网格的路径会有"锯齿感"）；
2. **`docs/sql/05_setup_pgrouting_navigation.sql` 重建耗时增加约 9 倍**（项目注释说 15m 是"重建秒级且幂等"，5m 可能就要几十秒）；
3. **A\* 搜索空间大 9 倍** → 单次规划耗时增加（虽然 A* 的启发式能剪掉不少）；
4. **存储增加**：节点表 + 边表大小各约 9 倍。
**解析**：这是典型的**「精度 vs 性能」权衡**。项目的选择（README 扩展方向）：
> 「导航网格升级：更高分辨率（5m）、动态限飞区热更新」
——**把它放进"未来迭代"而不是现在就做，说明当前的 15m 已经够用**（校园尺度下，15m 的绕行误差对无人机来说可接受）。
> **面试话术**：「15m 分辨率是精度和性能的平衡点。校园尺度约 1 平方公里，15m 网格约 4500 个节点，A\* 规划在毫秒级；如果要更精细可以降到 5m，但节点数会涨到 4 万、重建耗时涨 9 倍。**我选 15m 是因为对无人机绕障来说这个精度已经足够，把余量留给未来。**」

**题 5 答案**
**为什么不直接连直线**：
1. **直线会穿楼**：两点之间的直线可能穿过教学楼、宿舍楼——无人机撞楼。网格避让能绕开建筑（不可飞行区域不建节点/边）。
2. **直线会穿限飞区**：这是项目的核心需求（`no_fly_zone`）。
3. **直线不尊重"可飞行"语义**：`drone_nav_node.is_walkable` 标记了哪些格点可飞。
4. **直线没有"路径"概念**：只有两个端点，无法描述「沿这条路走」，也就无法做实时位置推进（需要一串航点）。
**如果两点直线不穿限飞区，A\* 还有意义吗**：
**有，但结果会退化**：
- 如果两点间的直线走廊上没有障碍，A* 会在网格上找出一条**近似直线**的路径（因为 8 邻域网格只能走 0°/45°/90°，所以会有**阶梯状锯齿**）；
- 更有意义的是：**A\* 返回一条"可执行的航点序列"**，前端能拿它做位置推进和动画；而直线只有两个端点。
**解析**：注意「**锯齿**」这个副作用——这正是「网格化」的代价：
> 网格路径本质是「曼哈顿风格」的折线，看起来不平滑。优化手段有：
> 1. **路径平滑（Path Smoothing）**：用视线检测（Line of Sight）合并共线/可直达的航点，把锯齿拉直；
> 2. **更细网格**：减小锯齿幅度，但代价是性能（见题 4）；
> 3. **Theta\***：允许任意角度的 A\* 变体（pgRouting 不直接提供）。
> **能说出「我知道锯齿问题，也知道怎么优化」，就比只会调 `pgr_astar` 高一个层次。**

### 验证方法
```powershell
# 1) 直接调路径规划接口
curl -X POST http://localhost:8080/api/route/plan -H "Content-Type: application/json" `
  -d '{\"startLng\":114.4650,\"startLat\":37.9850,\"endLng\":114.4720,\"endLat\":37.9830,\"altitude\":50}'
# 期望返回：routeGeojson / waypoints / distanceM / estimatedSeconds /
#          avoidedNoFlyZone / straightLineCrossZone / routeStillCrossZone / crossedZones

# 2) 在数据库里看网格规模
psql -U postgres -d shp_data -c "SELECT COUNT(*) FROM drone_nav_node;"
psql -U postgres -d shp_data -c "SELECT COUNT(*) FROM drone_nav_edge;"

# 3) 看执行计划（确认 KNN 走了空间索引）
psql -U postgres -d shp_data -c "EXPLAIN ANALYZE
  SELECT id FROM drone_nav_node WHERE is_walkable = true
  ORDER BY geom <-> ST_SetSRID(ST_MakePoint(114.468,37.984),4326) LIMIT 1;"
```
前端：打开航线规划面板，选一个「起点在限飞区一侧、终点在另一侧」的组合，观察 `avoidedNoFlyZone = true` 且航线明显绕行。

### 自测清单
- [ ] 能背出 `pgr_astar` 的 8 步流程
- [ ] 知道 `edge = -1` 的含义和为什么要过滤
- [ ] 能画出 `avoidedNoFlyZone` 的真值表
- [ ] 会算网格节点规模，理解 15m 的选择
- [ ] 知道 `EXPLAIN ANALYZE` 和 `<->` KNN 算子

---

## Day 25｜订单状态机与自动调度

### 学习目标
- 理解订单状态机（状态 + 允许的迁移）
- 理解 `@Scheduled` 定时任务与并发控制
- **掌握「行级锁防重复派单」的写法**

### 核心概念
- **状态机**：`pending → assigned → delivering → delivered / cancelled`。**非法迁移必须被拒绝**。
- **`@Scheduled`**：Spring 定时任务。`fixedRate`（固定频率）/ `fixedDelay`（上次结束后延迟）/ `cron`。
- **行级锁 `FOR UPDATE`**：锁住一行直到事务提交，**防止并发下重复处理同一行**。
- **`@Transactional`**：包在事务里，异常自动回滚。
- **幂等**：同一个操作执行多次，结果和执行一次相同。

### 项目对照
1. `backend/.../service/impl/OrderServiceImpl.java` L157–230：`assignDrone`（**含行级锁**）
2. 同文件 L230–310：`confirmDeliver`（**30 米到达校验 + 后续调度**）
3. 同文件 L359–386：`cancel`
4. `backend/.../service/impl/AutoOrderScheduler.java`（6.4KB）：自动补单
5. `backend/.../service/impl/AutoConfirmScheduler.java`（4.5KB）：自动确认送达
6. `backend/.../mapper/DeliveryOrderMapper.java`：`FOR UPDATE` 查询
7. `backend/src/test/java/.../OrderServiceImplTest.java`（16KB）：**状态机测试**

### 课后实践题

**题 1**：画出订单状态迁移图，标出哪些迁移是非法的。
**题 2**：`assignDrone` 里为什么要用 `FOR UPDATE` 加行级锁？不加会怎样？
**题 3**：`confirmDeliver` 里「30 米到达校验」是怎么做的？为什么需要这个校验？
**题 4**：写一个 `@Scheduled` 定时任务，每 30 秒自动给待接单订单派无人机，要求全局在飞上限 8 单。写出骨架并说明并发注意点。
**题 5**：无人机送达后要「续派下一单 / 回食堂待命 / 回食堂充电」。请写这个决策逻辑。

### 参考答案 + 解析

**题 1 答案**
```
                    ┌──────────────────────────────────────┐
                    ▼                                      │
  [创建] ──► pending ──assign──► assigned ──start──► delivering ──deliver──► delivered
                │                    │                    │
                └────── cancel ──────┴────────────────────┘
                            │
                            ▼
                        cancelled
```
**合法迁移**：
| 从 | 到 | 触发 |
|---|---|---|
| （新建） | `pending` | `create` |
| `pending` | `assigned` | `assignDrone`（分配并规划航线）|
| `pending` | `cancelled` | `cancel` |
| `assigned` | `delivering` | 无人机起飞（实际由位置推进推进状态）|
| `delivering` | `delivered` | `confirmDeliver`（**≤30m 校验**）|
| `delivering` | `cancelled` | `cancel`（释放无人机）|

**非法迁移**（必须拒绝）：
- `delivered → pending/assigned/delivering`（已送达的订单不能复活）
- `cancelled → 任何状态`
- `pending → delivered`（没分配就送达）
- `delivered → cancelled`
**解析**：
- 项目 `OrderServiceImplTest`（16KB）重点测的就是**状态机**——「订单状态机」是 README 里点名的测试内容之一。
- **为什么状态机重要**：并发/重试/人为误操作都可能触发非法迁移。没有状态校验，会出现「取消的订单又变成配送中」「送达的订单被再次送达扣两次电量」这类**数据一致性问题**。
> **推荐实现方式**：把允许的迁移定义成一张表，用统一方法校验：
> ```java
> private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
>     "pending",    Set.of("assigned", "cancelled"),
>     "assigned",   Set.of("delivering", "cancelled"),
>     "delivering", Set.of("delivered", "cancelled"),
>     "delivered",  Set.of(),
>     "cancelled",  Set.of()
> );
> private void assertTransition(String from, String to) {
>     if (!ALLOWED_TRANSITIONS.getOrDefault(from, Set.of()).contains(to))
>         throw new IllegalStateException("非法状态迁移: " + from + " -> " + to);
> }
> ```
> **把规则数据化，比散落的 if-else 可靠得多。**

**题 2 答案**
```java
// DeliveryOrderMapper 里
@Select("SELECT * FROM delivery_order WHERE id = #{id} FOR UPDATE")
DeliveryOrder selectByIdForUpdate(@Param("id") Integer id);
```
**不加锁会怎样**（并发场景）：
```
时刻 T1: 自动补单线程 读到订单 #100 状态 = pending
时刻 T2: 用户手动分配  读到订单 #100 状态 = pending   ← 两个线程都认为可以派
时刻 T3: 自动补单线程 分配无人机 A 给 #100，状态改为 assigned
时刻 T4: 用户手动分配  分配无人机 B 给 #100，覆盖状态为 assigned
结果：#100 派了两架无人机；无人机 A 成了"幽灵任务"（没有订单，但状态是 delivering）
```
**加锁后**：`FOR UPDATE` 让 T2 的读**阻塞**直到 T1 的事务提交。T2 读到的是**已更新的状态**（`assigned`），于是校验失败、拒绝重复分配。
**解析**：项目注释原话（`OrderServiceImpl` L158）：
> 「行级加锁：锁定订单行直至事务提交，**防止自动补单/自动续派/手动分配并发下重复派单**。」
> 三个并发来源都点出来了——这正是「不加锁会出问题」的完整场景。
> **注意配套条件**：`FOR UPDATE` 必须在 `@Transactional` 里才有意义（锁在事务提交时释放）。**没有事务的话，`FOR UPDATE` 立即释放，等于没加锁。**
```java
@Override
@Transactional                                       // ★ 必须有
public DeliveryOrder assignDrone(Integer orderId, Integer droneId) {
    DeliveryOrder order = orderMapper.selectByIdForUpdate(orderId);   // ★ 加锁读
    // ... 校验状态、选无人机（也走加锁查询）、规划航线 ...
}
```
> 也有另一条路：**乐观锁**（版本号 `version` 字段 + `UPDATE ... WHERE version = ?`）。项目选了悲观锁，因为「派单」是**写多且必须成功**的场景，悲观锁语义更直接。**能说出「悲观锁和乐观锁各自适用什么场景」是加分项。**

**题 3 答案**
```java
/** 到达判定阈值：30 米 */
private static final double ARRIVE_THRESHOLD_M = 30.0;

// ===== 校验无人机是否已到达收货地点 =====
// 取宿舍楼坐标（质心）与无人机当前位置，算球面距离
double distance = ...;   // ST_Distance 或前端同口径计算
if (distance > ARRIVE_THRESHOLD_M) {
    throw new IllegalStateException("无人机尚未到达收货地点（距离 " + ... + " 米）");
}
```
**为什么要这个校验**：
1. **防作弊/防误操作**：没有校验的话，无人机还在餐厅门口就能「确认送达」，整个配送业务闭环失去意义；
2. **保证业务真实性**：这是「数字孪生」与「纯演示动画」的分界线——**状态变更必须由真实空间位置驱动**；
3. **为自动确认提供依据**：`AutoConfirmScheduler` 正是靠这个距离判断「到了 → 自动确认送达」。
**解析**：
- **30 米这个阈值怎么定的**：宿舍楼有体积（几十米见方），无人机停在楼附近而非精确质心；加上 GPS/网格离散化误差。30 米是「足够宽松到不会误判未到达，又足够严格到不会提前确认」的平衡点。
- **口径一致性**：距离计算必须与导航网格的距离口径一致（`ST_Length(geography)` / haversine / `EllipsoidGeodesic`），否则会出现「路径算出来目的地还有 31 米」这种卡死情况。项目 `NavigationMapper#buildRouteFromNodes` 的注释专门强调了这一点：「计算总距离（geography 真实球面米，**与无人机 haversine 推进口径一致**）」。
> **面试话术**：「我用 30 米作为到达阈值，因为宿舍楼有物理尺寸、网格是 15m 离散化的、位置推进还有插值误差——**阈值必须覆盖这些误差来源，同时不能太宽松以至于失去约束力**。」

**题 4**
```java
@Slf4j
@Component
@RequiredArgsConstructor
@EnableScheduling
public class AutoOrderScheduler {

    private final OrderService orderService;
    private final DroneMapper droneMapper;

    /** 全局在飞上限 */
    private static final int MAX_FLYING_ORDERS = 8;

    @Scheduled(fixedRate = 30_000)     // 每 30 秒执行一次
    public void autoCreateAndAssign() {
        try {
            // ① 先看当前在飞订单数（delivering + assigned）
            int flying = orderService.countFlyingOrders();
            if (flying >= MAX_FLYING_ORDERS) {
                log.debug("在飞订单已达上限 {}，跳过本次补单", MAX_FLYING_ORDERS);
                return;
            }

            // ② 找出可接单的无人机（空闲 + 电量 > 30%）
            List<Drone> idleDrones = droneMapper.selectIdleWithBatteryAbove(30);
            if (idleDrones.isEmpty()) return;

            // ③ 逐个补单（每次最多补到上限）
            int quota = MAX_FLYING_ORDERS - flying;
            for (Drone drone : idleDrones) {
                if (quota-- <= 0) break;
                orderService.createAndAssignOne();
            }
        } catch (Exception e) {
            // ★ 定时任务必须自己兜异常，否则一次异常会影响后续调度
            log.error("自动补单任务执行失败", e);
        }
    }
}
```
**并发注意点**（这是本题的核心）：
1. **定时任务必须自己 try/catch 全部异常**：`@Scheduled` 方法抛异常不会中断调度器，但**会打乱后续执行节奏**（`fixedRate` 下会堆积），而且**异常堆栈容易淹没在日志里**。项目里 `AutoOrderScheduler` / `AutoConfirmScheduler` 都包了 try/catch。
2. **「先检查上限，再执行」的检查-执行不是原子的**：如果定时任务和「手动下单」并发，可能突破上限。**真正的防线在 Service 层的行级锁**（题 2）——定时任务里的上限检查只是**优化**（少做无用功），不是**保证**。
3. **`fixedRate` vs `fixedDelay`**：
   - `fixedRate`：每 30 秒**开始**一次（不管上次跑完没跑完）→ 如果单次执行超过 30 秒，会**任务堆积**
   - `fixedDelay`：上次**结束后**再等 30 秒 → **不会堆积**
   本项目任务很快（毫秒级），用 `fixedRate` 没问题；**如果任务可能慢，一定用 `fixedDelay`**。
4. **多实例部署会重复执行**：两个后端实例同时跑定时任务 → 双倍补单。生产环境需要**分布式锁**（Redis / 数据库 advisory lock）或**只在单实例开启调度**（`@ConditionalOnProperty`）。
   > **这一条是面试高频追问！** 「你的定时任务在多实例下怎么保证只跑一次？」——答「用分布式锁或者在配置层控制只在主节点启用」。
5. **`@EnableScheduling`** 要加在配置类或启动类上（只加一次即可）。

**题 5 答案**（照 `OrderServiceImpl#confirmDeliver` L272–341 的逻辑）
```java
// ===== 送达后：决策下一步 =====
private void dispatchNextForDrone(Drone drone) {
    // ① 模拟电量消耗（每次配送消耗 5-15%）
    int cost = 5 + random.nextInt(11);          // [5, 15]
    int battery = Math.max(0, drone.getBatteryPct() - cost);
    drone.setBatteryPct(battery);

    // ② 优先续派下一单（取最早创建的待接单）
    DeliveryOrder next = orderMapper.selectEarliestPending();
    if (next != null && battery > 30) {
        // 续派：无人机留在原地/当前位置直接飞下一单
        assignDrone(next.getId(), drone.getId());
        log.info("无人机 {} 续派订单 {}", drone.getDroneNo(), next.getOrderNo());
        return;
    }

    // ③ 无待接单但电量充足 → 回食堂 idle 待命
    //    注释原话："不充电，等待自动补单立即起飞，缩短空档"
    if (battery > 30) {
        goBackToCanteenIdle(drone);
        return;
    }

    // ④ 电量不足(≤30%) → 回食堂充电
    goCharge(drone);
}

/** 回食堂充电：charging 状态，15s +5%，≥80% 恢复 idle */
private void goCharge(Drone drone) {
    double[] spot = canteenSpotFor(drone);       // ★ CanteenLocator 统一计算落点
    drone.setStatus("charging");
    drone.setCurrentLng(BigDecimal.valueOf(spot[0]));
    drone.setCurrentLat(BigDecimal.valueOf(spot[1]));
    droneMapper.updateById(drone);
}

/** 回食堂待命：idle 状态但位置在食堂 */
private void goBackToCanteenIdle(Drone drone) {
    double[] spot = canteenSpotFor(drone);
    drone.setStatus("idle");
    drone.setCurrentLng(BigDecimal.valueOf(spot[0]));
    drone.setCurrentLat(BigDecimal.valueOf(spot[1]));
    droneMapper.updateById(drone);
}
```
**解析**：这个决策树有三个设计亮点：
1. **优先级明确**：续派 > 待命 > 充电。**「能干活就干活」**——最大化无人机利用率。
2. **「回食堂 idle」和「回食堂 charging」是两种状态**，区别在注释里：
   > 「无待接单但电量充足 → 回食堂 idle 待命（**不充电**），等待自动补单立即起飞，**缩短空档**」
   **这是一个精细的优化**：如果电量够，就只是"飞回去停着"，不必占用充电状态（充电状态可能有个"15s +5%"的定时器在跑，浪费计算）。**用户看到的是"无人机回巢待命"，语义也更好。**
3. **落点由 `CanteenLocator` 统一计算**（注释 L338）：
   > 「落点由 `CanteenLocator` 统一计算（**同一无人机恒定落点**，避免坐标反复抖动）」
   **这是一个非常真实的工程细节**：如果每次回食堂都用「餐厅质心 + 随机偏移」，同一架无人机每次落点都不同，视觉上会「抖来抖去」，而且如果多架无人机随机落点，还可能重叠。
   **正确做法**：按无人机 id 做确定性计算（比如 `id % N` 分配到食堂周边的固定停机位），**同一架无人机永远落在同一个位置**。
> **面试话术**：「我特意让食堂落点是**确定性**的——同一架无人机每次回巢都停在同一个位置。如果用随机偏移，地图上会看到无人机反复抖动，而且多机可能重叠。**这种"视觉稳定性"的细节，是数字孪生项目必须考虑的。**」

### 验证方法
1. **状态机**：跑单元测试
   ```powershell
   cd backend
   $env:JAVA_HOME = "C:\jdk-17.0.20+8"   # ★ 必须 JDK 17，不能用 JDK 25
   mvn test -Dtest=OrderServiceImplTest
   ```
2. **业务闭环**：打开前端订单面板，等 30 秒看是否自动出现新订单；点订单 → 播放动画 → 观察无人机飞达后是否自动确认（`AutoConfirmScheduler`）；
3. **并发防护**：同时用两处入口给同一订单分配无人机（比如双击按钮 / 手动 + 定时），确认**只成功一次**。

### 自测清单
- [ ] 能画出订单状态迁移图并说出非法迁移
- [ ] 知道 `FOR UPDATE` 为什么必须配 `@Transactional`
- [ ] 知道 30 米阈值和距离口径一致性的关系
- [ ] 知道定时任务为什么必须自己 try/catch，以及多实例下的问题
- [ ] 能解释「同一无人机恒定落点」为什么重要

---

## Day 26｜测试与工程质量：48 个单测 + 6 个验证脚本

### 学习目标
- 会用 JUnit5 + Mockito 写单元测试
- 理解「源码级回归验证脚本」这个非常规但很实用的手段
- 会为「静默失效型 bug」写守护

### 核心概念
- **单元测试**：只测一个类/方法，依赖用 **Mock** 替代。
- **`@ExtendWith(MockitoExtension.class)`**：启用 Mockito 注解。
- **`@Mock` / `@InjectMocks`**：造替身 / 把替身注入被测对象。
- **断言**：`assertEquals` / `assertThrows` / `assertTrue`。
- **回归测试**：为已修复的 bug 写测试，防止将来改回去。
- **源码级验证脚本**：不跑运行时，直接**扫描源代码文本**检查「是否违反约定」。项目用 `.mjs` + Node 实现。

### 项目对照
1. `backend/src/test/java/.../common/GeoMathTest.java`（4.3KB）
2. `backend/src/test/java/.../common/GeoJsonSupportTest.java`（3.6KB）
3. `backend/src/test/java/.../service/impl/OrderServiceImplTest.java`（16KB，**重点**）
4. `backend/src/test/java/.../service/impl/RouteServiceImplTest.java`（10KB）
5. `backend/src/test/java/.../service/impl/SpatialServiceImplTest.java`（5.4KB，**表名白名单测试**）
6. `frontend/scripts/verify-cesium-reactivity.mjs`（6KB）
7. `frontend/scripts/verify-cesium-api-usage.mjs`（12.4KB，**最大最狠的一个**）
8. `frontend/scripts/verify-popup-position.mjs`（8.1KB）
9. `frontend/scripts/verify-frontend.mjs`（5.9KB）
10. `frontend/scripts/capture-runtime-errors.mjs` / `verify-building-outlines.mjs` / `verify-cesium-behavior.mjs`
11. `frontend/package.json` L20：`verify:all`（**一条命令跑全部**）

### 课后实践题

**题 1**：为 `SpatialServiceImpl#validateTable` 写单元测试：合法表名通过、非法表名抛异常、null 抛异常。
**题 2**：为「订单状态机」写一个测试：**已送达的订单不能再次送达**。
**题 3**：项目为什么需要 `verify-cesium-reactivity.mjs` 这种「源码扫描」脚本？它比运行时测试强在哪？
**题 4**：`GeoMathTest` 测的是什么？为什么「距离口径」需要专门写测试？
**题 5**：跑测试时 README 强调必须用 JDK 17 而不是 JDK 25。为什么？这个现象说明什么工程问题？

### 参考答案 + 解析

**题 1**
```java
@ExtendWith(MockitoExtension.class)
class SpatialServiceImplTest {

    @Mock
    private SpatialQueryMapper spatialQueryMapper;      // 数据层替身

    @InjectMocks
    private SpatialServiceImpl spatialService;          // 被测对象（自动注入 mock）

    @Test
    @DisplayName("合法表名应通过校验")
    void validateTable_legal_shouldPass() {
        assertDoesNotThrow(() -> spatialService.validateTable("teaching_building"));
        assertDoesNotThrow(() -> spatialService.validateTable("school"));
        assertDoesNotThrow(() -> spatialService.validateTable("tennis_court"));
    }

    @Test
    @DisplayName("非法表名应抛 IllegalArgumentException")
    void validateTable_illegal_shouldThrow() {
        // SQL 注入尝试
        assertThrows(IllegalArgumentException.class,
                () -> spatialService.validateTable("teaching_building; DROP TABLE school; --"));
        assertThrows(IllegalArgumentException.class,
                () -> spatialService.validateTable("pg_user"));       // 系统表
        assertThrows(IllegalArgumentException.class,
                () -> spatialService.validateTable("evil_table"));
    }

    @Test
    @DisplayName("null 表名应抛 IllegalArgumentException")
    void validateTable_null_shouldThrow() {
        assertThrows(IllegalArgumentException.class, () -> spatialService.validateTable(null));
    }

    @Test
    @DisplayName("白名单应恰好包含 8 张表，且顺序固定")
    void allowedTables_shouldBeExactlyEightAndOrdered() {
        // 通过 getAllLayers 间接验证（init 里按 ALLOWED_TABLES 顺序构建缓存）
        List<LayerMeta> layers = spatialService.getAllLayers();
        assertEquals(8, layers.size());
        assertEquals("school", layers.get(0).getTableName());      // order guaranteed
        assertEquals("tennis_court", layers.get(7).getTableName());
    }
}
```
**解析**：这道题覆盖了四种典型测试：
1. **正向路径**（合法通过）
2. **负向路径**（非法拒绝）—— 尤其要包含**真实的注入字符串**
3. **边界**（null）
4. **契约测试**（顺序固定）—— 这个最容易被忽略，但正是 Day 7 讲的 `List` vs `Set.of` 那个坑的守护者。**如果有人把 `ALLOWED_TABLES` 改成 `Set.of`，这个测试会失败**（因为顺序不保证）。
> **`@InjectMocks` 的作用**：Mockito 会尝试用构造器注入 `@Mock` 的字段。**注意它依赖 `@RequiredArgsConstructor` 生成的构造器**。如果被测类用字段注入（`@Autowired`），`@InjectMocks` 需要反射注入，可靠性差一些——**这也是「构造器注入优于字段注入」的一个理由。**

**题 2**
```java
@Test
@DisplayName("已送达的订单不能再次送达")
void confirmDeliver_alreadyDelivered_shouldThrow() {
    // given：造一个已送达的订单
    DeliveryOrder delivered = new DeliveryOrder();
    delivered.setId(100);
    delivered.setStatus("delivered");
    delivered.setDroneId(3);
    when(orderMapper.selectByIdForUpdate(100)).thenReturn(delivered);

    // when & then
    IllegalStateException ex = assertThrows(IllegalStateException.class,
            () -> orderService.confirmDeliver(100));

    assertTrue(ex.getMessage().contains("状态") || ex.getMessage().contains("送达"));
    // ★ 关键：确认没有产生副作用
    verify(droneMapper, never()).updateById(any());          // 没改无人机
    verify(flightRouteMapper, never()).updateById(any());    // 没改航线
}

@Test
@DisplayName("无人机距离收货点超过 30 米时不允许确认送达")
void confirmDeliver_tooFar_shouldThrow() {
    DeliveryOrder order = new DeliveryOrder();
    order.setId(101);
    order.setStatus("delivering");
    order.setDroneId(3);
    when(orderMapper.selectByIdForUpdate(101)).thenReturn(order);

    Drone drone = new Drone();
    drone.setId(3);
    drone.setCurrentLng(BigDecimal.valueOf(114.4700));   // 故意放远
    drone.setCurrentLat(BigDecimal.valueOf(37.9900));
    when(droneMapper.selectById(3)).thenReturn(drone);
    // 宿舍楼在别处
    when(dormitoryMapper.selectCentroid(anyInt()))
            .thenReturn(Map.of("centroid", "{\"type\":\"Point\",\"coordinates\":[114.4650,37.9840]}"));

    IllegalStateException ex = assertThrows(IllegalStateException.class,
            () -> orderService.confirmDeliver(101));
    assertTrue(ex.getMessage().contains("尚未到达"));
    verify(droneMapper, never()).updateById(any());
}
```
**解析**：**`verify(xxx, never())` 是这两道题的关键**。
> **为什么「断言抛异常」还不够**：异常可能在**副作用已经发生之后**才抛出（比如「先更新了无人机状态，再校验距离」）。只断言异常，测试会通过，但**业务数据已经被污染了**。
> **必须同时断言「没有副作用」**——这才是完整的测试。**这个思路（断言异常 + 断言无副作用）是测试设计的进阶技巧，面试提一下很亮眼。**

**题 3 答案**：
因为要守的是**「静默失效型」的架构约束**，这类问题**运行时测试很难覆盖**：
```js
// verify-cesium-reactivity.mjs 检查的东西（示意）
// ❌ 禁止：const viewer = ref(null)
// ✅ 要求：const viewer = shallowRef(null)
// ❌ 禁止：const dataSources = reactive({})
// ✅ 要求：const dataSources = shallowReactive({})
// 以及 measureController / baseAnnotationLayer / 容器 DOM
```
**为什么源码扫描比运行时测试强**：
1. **运行时不一定会触发**：`ref(viewer)` 的错误只在「几何构建走 Worker」时才炸。如果测试环境没触发几何构建（比如只渲染了一个点），**测试会通过，但生产环境会崩**。
2. **它检查的是"写法"而不是"结果"**：架构约束的本质是**「不要这么写」**，而不是「不要产生这个结果」。源码扫描能直接看到写法。
3. **快**：毫秒级完成，可以挂在 CI 的 pre-commit 里。
4. **报错信息可以写得很直白**：直接告诉开发者「stores/map.js:46 应该用 shallowRef」（**新人友好**）。
**解析**：项目有 6 个验证脚本，各守一类坑（从脚本名就能看出）：
| 脚本 | 守什么 |
|---|---|
| `verify-cesium-reactivity.mjs` | Cesium 对象不能进响应式状态 |
| `verify-cesium-api-usage.mjs`（12KB，最大）| **Cesium API 用法**（如禁止直接调 `SceneTransforms.*`，必须走兼容封装）|
| `verify-cesium-behavior.mjs` | 行为约束（如 `clampToGround` 不能配 `extrudedHeight`）|
| `verify-building-outlines.mjs` | 建筑描边是否按规范创建 |
| `verify-popup-position.mjs` | 弹窗定位是否走了兼容封装 |
| `verify-frontend.mjs` | 通用前端代码规范 |
> 这种「**用脚本把架构决策固化下来**」的做法，业内叫 **Architecture Fitness Function（架构适应度函数）**。**面试时提这个术语，含金量很高。**
> **一句话总结**：**「代码评审会忘、注释会被忽略、新人会犯错——只有会自动失败的检查不会忘。」**

**题 4 答案**：
`GeoMathTest` 测的是**距离计算口径**（Haversine / 球面距离 / 坐标转换的正确性）。
**为什么「距离口径」需要专门写测试**：
1. **口径错了一个都发现不了**：如果距离公式写错，所有算出来的距离都偏 5%，但**页面照常显示、不报错**。用户看到「500 米」不会觉得有问题——**只有对比才知道错了**。
2. **多个地方要用同一个口径**：前端 `computeDistance`、后端 `ST_Length(geography)`、导航网格推进的 haversine——**三处必须一致**。测试就是这份「一致性契约」的守护者。
3. **数值边界容易错**：跨 180° 经线、极点附近、同一坐标（距离 0）——这些边界如果不测，出错了也没人知道。
4. **它是"已知答案"的基准**：测试里可以硬编码「已知两点间距离 ≈ X 米」，任何改动只要偏离就报警。
```java
@Test
@DisplayName("同一坐标点距离应为 0")
void distance_samePoint_shouldBeZero() { ... }

@Test
@DisplayName("北京到上海直线距离约 1067 公里")
void distance_beijingToShanghai() {
    double d = GeoMath.distance(116.407, 39.904, 121.473, 31.230);
    assertEquals(1067_000, d, 20_000);      // ±20km 容差
}
```
**解析**：**「容差（delta）」是数值测试的关键**。浮点计算不可能精确相等，用 `assertEquals(expected, actual, delta)` 允许合理误差。
> **面试话术**：「我为距离口径写了专门的单测，因为**错的口径不会报错，只会静默地给出错误结果**。测试里我用北京到上海这类"众所周知的距离"做基准，任何公式改动都会立刻被发现。」

**题 5 答案**
**现象**：用 JDK 25 跑测试时，Mockito **全部报错**：
```
MockitoException: Could not modify all classes ...
IllegalStateException: Compiled by older versions of scalac
```
**原因**（README 原话）：
> 「Spring Boot 3.2.5 带的 **ByteBuddy 1.14.1 无法在 JDK 25 上做类插桩**，会让 Mockito 全部报错。」
Mockito 靠 ByteBuddy 在运行时**生成/修改字节码**造 mock 对象。ByteBuddy 需要理解目标 JVM 的 class 文件格式；JDK 25 的 class 格式更高（major version 69），ByteBuddy 1.14.1 不认识，于是插桩失败。
**注意一个细节**：README 说 **「编译本身用 JDK 25 也能过，仅跑测试受限」**——因为编译只需要 `javac` 支持（JDK 25 向下兼容编译到 target 17），而**类插桩需要理解运行时的 class 格式**。
**这个现象说明什么工程问题**：
1. **依赖版本是生态问题，不是你的代码问题**：你的代码一个字没错，换个 JDK 就炸。**排查时先质疑环境，别先怀疑自己。**
2. **「能编译」≠「能运行」≠「能测试」**：三个阶段的约束不同。**CI 里必须固化工具链版本**（`JAVA_HOME`、Maven 版本、Node 版本）。
3. **`pom.xml` 里 `java.version=17` 是契约**：显式声明目标版本，就是为了让整个团队在同一个基准上。
4. **README 里专门写了这一条**，说明这个坑**必然会被每个新加入的人踩一次**。**把「环境陷阱」写进 README，是最有价值的文档工作之一。**
> **面试话术**：「我遇到过 JDK 版本导致 Mockito 全挂的问题——编译能过但跑测试不行，因为 ByteBuddy 做类插桩时依赖对 class 文件格式的支持。**结论是：编译期、运行期、测试期的工具链约束不同，CI 里必须固化版本。**」这种「具体踩坑 + 抽象结论」的回答，比背概念强得多。

### 验证方法
```powershell
# 后端：48 个测试
cd backend
$env:JAVA_HOME = "C:\jdk-17.0.20+8"
mvn test
# 期望：Tests run: 48, Failures: 0, Errors: 0, Skipped: 0

# 前端：源码级验证
cd ..\frontend
npm run verify:all
# 期望：各脚本全部通过（打印 OK / passed）
```

### 自测清单
- [ ] 会写 `@Mock` + `@InjectMocks` + `assertThrows` 的测试
- [ ] 知道「断言异常」之外还要「断言无副作用」
- [ ] 理解源码级验证脚本的价值（框架适应度函数）
- [ ] 知道为什么距离口径需要专门测试
- [ ] 能解释 JDK 版本坑的原因

---

## Day 27｜前端性能优化实战

### 学习目标
- 会用 DevTools 定位渲染性能瓶颈
- 掌握 Cesium 场景的性能优化手段
- 会做「减少重复计算 / 减少对象创建 / 减少拾取」

### 核心概念
- **帧率（FPS）与帧时间**：60fps = 16.7ms/帧。任何一帧里超过 16.7ms 的逻辑都会掉帧。
- **GC 压力**：频繁创建临时对象（尤其每帧创建）会导致 GC 频繁触发、表现为周期性卡顿。
- **渲染批次（Draw Call）**：每次切换材质/纹理都要一次 draw call。**同材质同类对象越集中越好。**
- **拾取开销**：`scene.pick` 内部会跑渲染 pass，**很贵**。

### 项目对照（全是优化点）
1. `CesiumViewer.vue` L569–586：**rAF 节流拾取**（高频事件压到每帧一次）
2. `CesiumViewer.vue` L578–583：**几何加载中跳过拾取**（避免和几何任务抢时间）
3. `CesiumViewer.vue` L57 + L624–625：**复用 Color 常量**（避免每次悬停 new）
4. `utils/cesium.js` L452–493：**图标模块级缓存**（避免重复 `toDataURL`）
5. `utils/cesium.js` L104–119：**不用 clampToGround 避免几何反复重建**
6. `OrderServiceImpl` L387–390：**聚合下推到 SQL**（避免全表读进内存）
7. `TileMapper.xml` L42–52：**`&&` 索引预过滤**（避免全表扫描）
8. `utils/measure.js` L114–160：**全量重建**（用正确性换性能，规模小才可接受）
9. `application.yml` L20–22：**关闭 SQL 日志**（避免刷屏 + IO 开销）

### 课后实践题

**题 1**：列出本项目至少 6 处性能优化，并说明每处优化的是**什么资源**（CPU / 内存 / 网络 / GPU）。
**题 2**：`CesiumViewer.vue` L624–625 说「复用同一份 Color 常量，避免每次悬停都新建对象」。悬停事件很频繁，假设每秒 100 次悬停变化，每次 new 一个 Color——一年下来是多少次对象创建？（算一下，然后说这个优化值不值）
**题 3**：`OrderServiceImpl#getDeliveryStats` 的优化是「把聚合下推到 SQL」。用一句话说明「为什么原写法（`selectList(null)` 全表读进内存再遍历）会随数据量线性劣化」。
**题 4**：前端页面滚动/拖动时掉帧，你会按什么顺序排查？

### 参考答案 + 解析

**题 1 答案**

| # | 优化点 | 位置 | 优化资源 | 手段 |
|---|---|---|---|---|
| 1 | rAF 节流拾取 | `CesiumViewer.vue` L569 | **CPU / GPU** | 高频事件压到每帧一次 |
| 2 | 几何加载中跳过拾取 | L578 | **CPU** | 不与几何任务抢时间 |
| 3 | 复用 Color 常量 | L57 / L624 | **内存 / GC** | 不重复创建对象 |
| 4 | 无人机图标缓存 | `cesium.js` L452 | **CPU** | 避免重复 `toDataURL`（同步阻塞） |
| 5 | 不用 `clampToGround` 拉伸 | `cesium.js` L104 | **CPU / GPU** | 避免几何反复重建 |
| 6 | 配送统计下推 SQL | `OrderServiceImpl` L387 | **内存 / DB** | 不全表读进内存 |
| 7 | MVT `&&` 索引预过滤 | `TileMapper.xml` L42 | **DB IO** | 走 GiST 索引，避免全表扫描 |
| 8 | 关闭 MyBatis SQL 日志 | `application.yml` L20 | **IO / CPU** | 不打印每条 SQL |
| 9 | `manualChunks` 分包 | `vite.config.js` L34 | **网络** | 利用浏览器缓存 |
| 10 | 描边合并到独立 dataSource | `cesium.js` L176 | **GPU** | 同类对象集中，减少批次 |

**解析**：**优化的第一步永远是「识别瓶颈在哪类资源上」**：
- **CPU**：过高频的事件处理、重复的同步计算、坐标变换
- **内存/GC**：每帧创建临时对象
- **网络**：数据量大、无缓存、无分包
- **GPU**：draw call 过多、几何过于复杂
> 项目里最典型的「**CPU 优化**」是 rAF 节流（L569–586 的注释把原理说透了）：
> 「鼠标事件可达上百 Hz，而屏幕刷新只有 60 Hz，多余的拾取纯属浪费。」
> 「`scene.pick` 内部会跑一遍渲染 pass（`Primitive.update` → 几何任务）。」
> **「知道每个 API 的内部开销」是性能优化的前提。**

**题 2 答案**
```
每秒 100 次 × 3600 秒 × 8 小时 × 365 天 ≈ 1.05 × 10^9 次（约 10 亿次）
```
（现实中没有用户会连续悬停 8 小时，所以实际数字小得多。）
**这个优化值不值**：
- **单次创建 `Cesium.Color` 的成本**：很低（就是个对象，含 4 个浮点数），大约几百纳秒。
- **但「不值」的论点是错的**——真正的成本不在「创建一次」，而在**GC 压力**：
  - 每秒 100 个短命对象 → 每秒触发多次 minor GC
  - 每次 GC 都要**暂停应用线程（stop-the-world）**，表现为周期性的微卡顿
  - **在渲染循环里（每帧都跑）创建对象，才是最危险的**——因为 GC 暂停正好打断渲染
- **更重要的理由：语义**。`HOVER_COLOR` 是一个**常量**（悬停高亮色），常量就该只创建一次。**这不是性能优化，这是「正确性」**——把常量写成每次 new，本身就不合理。
**解析**：项目注释给的是两个理由：
> 「复用同一份 Color 常量，避免每次悬停都新建对象。」
> 加上 L56 的：`markRaw` 锁死。
**正确的性能观**：
1. **不要为「省一次对象创建」做复杂的缓存**——那是微优化，收益极小且增加复杂度；
2. **要为「每帧/每秒创建大量对象」做缓存**——那才是真问题（GC 暂停）；
3. **常量就该定义成常量**——这是代码质量问题，顺便带来性能收益。
> **面试话术**：「我对悬停高亮色做了常量复用 + `markRaw`。**与其说是性能优化，不如说是把常量当常量写**——顺带避免了高频事件下的 GC 压力。**我对微优化很克制：只有确认在热点路径上（每帧/每秒执行）才会动手。**」这种「**克制的性能观**」比「我到处都做了优化」更让面试官放心。

**题 3 答案**
一句话：
> **因为「把整表读进内存」的成本与表行数成正比，而订单表只增不删，所以这个成本会随时间无限增长；而「SQL 聚合」的成本只与索引和结果集大小有关，基本恒定。**
展开：
```java
// ❌ 原写法：O(n) 内存 + O(n) 网络 + O(n) 反序列化
List<DeliveryOrder> all = orderMapper.selectList(null);   // 6000+ 行全部读进 JVM
for (DeliveryOrder o : all) { /* 在内存里累加统计 */ }
// 问题：
// - 内存占用 = 行数 × 单行对象大小（6000 行 × 几百字节 ≈ 几 MB，还会涨）
// - 网络/反序列化开销线性增长
// - JVM 还要处理这几千个对象（GC 压力）

// ✅ 现写法：数据库聚合，只返回几行结果
// SQL: SELECT status, COUNT(*), AVG(...) FROM delivery_order GROUP BY status
// 收益：
// - 传输量：几行 vs 6000+ 行
// - 内存：几乎为零
// - 数据库能用索引 + 聚合优化，比 JVM 循环快
```
**解析**：项目注释（`OrderServiceImpl` L388–389）：
> 「聚合全部下推到 SQL：此前是 `orderMapper.selectList(null)` 把整张订单表读进内存再遍历。**订单表只增不删，那种写法会随数据量线性劣化（现已 6000+ 行，且只会更多）。**」
**这条经验极其重要**，它是**后端最常见的性能反模式**：
> **「能交给数据库做的聚合，不要捞到应用层做。」**
> 判断标准：**这个操作的结果集大小是不是固定的（或很小的）？** 如果是（比如「按状态分组统计」只有 5 行），就该下推 SQL。
> **反例（不该下推的情况）**：如果需要对每行做**复杂业务逻辑**（调外部服务、复杂规则判断），那没法下推，只能在应用层做——但那时应该**分页处理**，而不是全表加载。
> **面试话术**：「我做过一个优化：把配送统计从『全表读进内存再遍历』改成『SQL 聚合』。**关键触发点是订单表只增不删——这类表上的全表加载是定时炸弹**，数据量小时看不出来，一旦涨到几十万行就会把内存吃光。」

**题 4 答案**
**排查顺序（从免费到昂贵）**：
```
① 确认「是不是真的掉帧」
   DevTools → Performance 面板录制 → 看 FPS 曲线、长任务（Long Task，>50ms 的黄色块）
   先量化，别凭感觉。

② 看是不是「主线程被长时间占用」
   Performance 面板里找长任务的调用栈
   → 常见元凶：大批量 DOM 操作、超大循环、同步的 JSON 解析/toDataURL

③ 看是不是 GC 导致的周期性卡顿
   Memory 面板 → 录一段时间 → 看内存曲线是否「锯齿状」（频繁上下）
   → 是：说明有高频对象创建，去热点路径找 new

④ 如果是 Cesium 场景（本项目）
   a. 打开 Cesium 自带的调试面板：viewer.scene.debugShowFramesPerSecond = true
   b. 检查拾取频率：是否有未节流的 mousemove → pick（本项目已用 rAF 节流）
   c. 检查几何复杂度：建筑数量、多边形顶点数（顶点数过万要简化）
   d. 检查 draw call：`viewer.scene.debugShowCommands` 或看同材质对象能否合并
   e. 检查是否误用了 clampToGround + extrudedHeight（几何反复重建）

⑤ 如果是数据/网络
   Network 面板看请求数量、单次响应大小、是否串行等待
   → 减少请求数（合并/缓存）、开启压缩（gzip/brotli）、分包缓存

⑥ 最后才考虑「降级方案」
   - 降低要素精度（LOD）
   - 按视野删减（视锥剔除之外的业务剔除）
   - 减少同时显示的图层数
```
**解析**：**核心原则是「先测量，再优化；从免费手段到昂贵手段」**。
> 项目里最值得学的性能排查案例是 Day 10 的 MVT 瓦片：**「不可索引表达式 → 全表扫描」**。它的排查方法是：
> ```sql
> EXPLAIN ANALYZE SELECT ... ;
> -- 看是否有 "Seq Scan"（全表扫描）而不是 "Index Scan"
> ```
> **数据库层的性能问题，一定要用 `EXPLAIN ANALYZE` 看执行计划**，而不是猜。
> **另一个原则**：**「优化要有数据支撑」**。项目 README 里那些实测数字（「100m 边算成 72m/138m，面积偏差 5.6%」「实测偏差 < 0.01%」「6000+ 行」）**就是数据支撑**。**面试时能说出具体数字，可信度翻倍。**

### 验证方法
```js
// 在浏览器 Console 里开启 Cesium 的 FPS 显示
// （需要先拿到 viewer 实例，可在 stores/map.js 的 initViewer 末尾临时加 window.__viewer = viewer.value）
window.__viewer.scene.debugShowFramesPerSecond = true
```
1. 空场景 FPS 应接近 60；
2. 快速划动鼠标 → FPS 不应明显下降（rAF 节流生效）；
3. 关掉所有图层 vs 全开图层对比 FPS；
4. Performance 面板录制 5 秒，检查有无 Long Task。

### 自测清单
- [ ] 能列出 6 处以上项目优化并归类到资源类型
- [ ] 知道 `scene.pick` 很贵，必须节流
- [ ] 理解「全表读进内存」为什么是定时炸弹
- [ ] 能说出性能排查的顺序（先测量后优化）
- [ ] 会用 `EXPLAIN ANALYZE` 和 Cesium FPS 面板

---

## Day 28｜把项目讲清楚：简历、作品集、面试问答

### 学习目标
- 把 27 天的学习成果**转化为简历语言**
- 准备 **STAR 结构**的项目讲述
- 掌握 20 个 WebGIS 高频面试题的回答框架

### 核心概念
- **STAR**：Situation（背景）→ Task（任务）→ Action（行动）→ Result（结果）。讲项目的标准结构。
- **量化**：「优化了性能」不算成果，「把瓦片请求从全表扫描优化到走索引，响应从 800ms 降到 30ms」才算。
- **技术深度 vs 技术广度**：求职时**一两个讲得极深的点 > 十个浅尝辄止的点**。

### 项目对照（现成的素材）
1. `README.md` 第 315–326 行：**10 条面试亮点**（作者已经写好了，你要做的是**内化成自己的话**）
2. `README.md` 第 18–80 行：**6 条关键实现约束**（这是你「踩坑经验」的素材库）
3. `docs/superpowers/specs/`：设计文档（**学「怎么写设计方案」**）
4. `docs/superpowers/plans/`：实施计划（**学「怎么拆任务」**）
5. `docs/优化方案-2026-09-12.md`（80KB）：优化记录
6. `docs/bugfix-plan-2026-09-11.md`：bug 修复计划
7. `frontend/scripts/`：**6 个验证脚本**（面试杀手锏）
8. 项目根目录的 `WebGIS开发作品集.pdf` 和简历 docx

### 课后实践题

**题 1**：把「建筑点击弹窗」这个功能写成 STAR 结构的一段话（150 字以内）。
**题 2**：用「项目里 6 条关键实现约束」中的任意 2 条，写出「踩坑 → 定位 → 解决 → 沉淀」的完整叙述。
**题 3**：回答面试题：「你这个项目里最难的技术点是什么？」（要求：给出一个有说服力的答案，不要泛泛而谈）
**题 4**：回答面试题：「Cesium 里怎么加载十万个点？」（要求：给出分层方案）

### 参考答案 + 解析

**题 1 答案**（STAR 示例）
> **S**：校园数字孪生项目需要用户点击三维建筑查看院系信息。
> **T**：保证「点了楼一定能出弹窗」，且弹窗随地球旋转持续跟随建筑。
> **A**：拾取做了三级兜底（`pickPosition` → `globe.pick` → `pickEllipsoid`），解决点楼顶时交点落到楼后空地的问题；坐标转换封装了 `worldToWindowCoordinates` 兼容层（Cesium 1.121 改名），避免升版后弹窗静默消失；弹窗定位在 `postRender` 每帧重算，用 `transform` 而非 `top/left` 避免重排。
> **R**：点楼体任意位置都能命中；拖动地球弹窗不脱节；封装后升 Cesium 版本零改动。
**解析**：这段好在哪：
1. **有具体技术名词**（`pickPosition`、`postRender`、`transform`）—— 证明你**真做过**；
2. **有「为什么」**（点楼顶交点落到楼后、API 改名）—— 证明你**理解**；
3. **有结果**（任意位置能命中、升级零改动）—— 证明**有效果**。
> **避坑**：不要写「使用 Cesium 实现了建筑点击功能」——**这是"我用了什么"，不是"我做了什么"**。面试官想听的是**判断和取舍**。

**题 2 答案**（两条示例）

**约束 2：拉伸建筑不能用 `clampToGround`**
> **踩坑**：建筑白模一开始设了 `clampToGround: true`，页面直接崩，报 `DataCloneError: Failed to execute 'postMessage' on 'Worker'`。
> **定位**：错误信息指向几何构建的 Worker 通信。查文档发现 `clampToGround` 走 `GroundPrimitive` 路径，而 `GroundPrimitive` **不支持** `height` / `extrudedHeight`——我在同一个实体上提了两个互斥要求，Cesium 只能反复重建几何去协调，而这个重建过程正是几何任务最密集的地方，把响应式代理的问题一起引爆了。
> **解决**：`clampToGround = false`，`height = 0` + `extrudedHeight = 层数 × 3.5`。校园平坦，视觉上与贴地一致。
> **沉淀**：写进 README「关键实现约束」，并在 `verify-cesium-behavior.mjs` 里加了检查脚本；同时发现 `polygon.outline` 也只对贴地多边形有效，拉伸体改用独立贴地 polyline 勾边。

**约束 5：测面积用 ENU 逆矩阵**
> **踩坑**：测面积功能一直不正常，100 米的边量出来 72 米和 138 米，面积偏差 5.6%。
> **定位**：原实现拿 `eastNorthUpToFixedFrame` 返回矩阵的**列向量**做点积来获取局部坐标。但那些列是**位置矢量**（模长≈地球半径 6371km），而且 east/north/up 三列**并非正交**。用非正交基做投影等于把图形剪切变形。
> **解决**：改用 `Matrix4.inverse` 把世界坐标变到局部 ENU 系，得到严格正交的（东、北）坐标，再套鞋带公式。
> **沉淀**：实测偏差降到 **< 0.01%**；把推导过程写进 `utils/measure.js` 的注释（「别再改回去」），并总结成 README 约束第 5 条。
**解析**：这两段的共同结构：
```
踩坑（具体报错/现象）
  → 定位（怎么查的、发现了什么原理）
  → 解决（怎么改）
  → 沉淀（文档/脚本/约束，防止再犯）
```
**「沉淀」这一步最关键，也最容易被忽略**。它证明你不是「修完就忘」，而是**把经验变成了团队的资产**。这是**高级工程师的标志**。
> 项目作者把 6 条都写进了 README 顶部「关键实现约束（改代码前必读）」——**这个位置本身就是设计**：放在最显眼处，新人一定会看到。

**题 3 答案**（推荐答案：pgRouting A\* + 限飞区边级避让）
> 最难的不是调 `pgr_astar` 本身，而是**「让 A\* 规划出来的路径真的不穿限飞区」**。
>
> 我用的是**三层设计**：
> 1. **节点级安全缓冲**：生成导航网格时，距限飞区 5 米以内的格点标记为 `is_walkable = false`。这解决"节点本身在限飞区里"的情况，但**不够**——两个可飞行节点之间的连线仍可能穿过限飞区。
> 2. **边级过滤**：建边时如果这条边与限飞区相交，**直接不建这条边**（硬约束）。这才是真正的避让。
> 3. **成本惩罚**：对「靠近但未穿越」限飞区的边加成本惩罚（软约束）。因为如果只做硬过滤，A\* 会**贴着限飞区边界飞**——安全余量太小。加惩罚后路径会主动远离。
>
> 验证方式我也做了**双重检测**：既检测「起终点直线是否穿限飞区」（证明问题真实存在），也检测「规划路径是否仍穿越」（证明避让生效）。前端会展示「直线穿越：是 / 路径穿越：否 / 成功避让：是」。
>
> 另外还有个边界坑：起点和终点落在**同一个网格节点**时，`ST_MakeLine` 产不出有效的 LineString，后面的 `waypoints[0]` 会数组越界崩溃。我在生成航线几何后立刻做了防空判断，在访问数组前拦截。
**解析**：为什么这个答案有说服力：
1. **点出了"难在哪"**（不是调 API，而是保证效果）—— 这是真正的难点；
2. **三层递进的设计**（节点 → 边 → 成本）—— 展示了系统思维；
3. **主动说了边界的坑**（同一节点越界崩溃）—— 证明你**真的调试过**；
4. **讲了验证方式**（双重检测）—— 证明你**能证明自己做对了**。
> **反面示例**（不要这么说）：「用了 pgRouting 做路径规划，A\* 算法。」—— **一句话就没了，面试官无法判断你的水平。**

**题 4 答案**（分层方案）
> 十万个点直接建 Entity，浏览器必崩——每个 Entity 都是独立的 JS 对象 + 独立的渲染批次。要**分层处理**：
>
> **第一层：数据源头就减**
> - 如果点是静态的，用 **3D Tiles**（`Cesium3DTileset`）或 **MVT 矢量瓦片**，按需加载视野内的数据。项目里 MVT 接口已经用 `ST_AsMVT` 实现好了，扩展即可。
> - 如果必须一次全量，用 **Draco 压缩**或**量化位置**把几何数据压小。
>
> **第二层：批量渲染**
> - 用 **`PointPrimitiveCollection`**（`scene.primitives.add`），而不是一个个 `Entity`。它把所有点放在**一个批次**里渲染，draw call 从 10 万降到 1。
> - 用 `billboard` 的话，正确做法是共享**同一张纹理**，让 Cesium 合批。
>
> **第三层：视图相关剔除**
> - **视锥剔除**：Cesium 内置（`scene.culling`）。
> - **距离 LOD**：远处的点用更小的图标、或者干脆不显示（按像素距离滤）。
> - **按需分页**：只加载当前视野 + 缓冲区（buffer）内的点，拖动地图时增量加载。
>
> **第四层：交互降级**
> - 十万个点不能靠 `scene.pick` 逐个拾取。应该用**空间索引**（前面后端用的 GiST，前端可用 R-tree/kdbush）先筛出「鼠标附近的候选点」，再精确命中。
> - 聚类（Cluster）：按缩放级别聚合显示（`EntityCluster` 或服务端聚合），**十万个点在低缩放下聚成几百个**。
>
> **面试时我会补一句**：具体选哪套要看**业务需求**——是「看整体分布」还是「精确点选某一个」。前者聚类/MVT 就够，后者必须上空间索引 + 服务端查询。
**解析**：这个答案的结构是 **「源头 → 渲染 → 剔除 → 交互」四层**，覆盖了完整链路。
> **关键技巧：主动补一句"看业务需求"**。这展示你**不会为了炫技而过度设计**——很多候选人一听到"十万个点"就开始背 3D Tiles，面试官反而觉得你不懂取舍。
> **另一个技巧：关联自己的项目**（「项目里 MVT 接口已经实现好了」）—— 把通用问题和自己的实践连起来，可信度立刻提升。

### 验证方法
1. **自测讲述**：把自己的项目用**3 分钟**讲一遍，录下来听。要求：包含「业务价值 + 技术难点 + 量化结果」；
2. **对照 README 的 10 条亮点**：每一条都能说出「是什么、为什么这么做、有什么效果」；
3. **准备 3 个"我自己发现并解决的问题"**（不是跟着教程做的，是自己踩的坑）。

### 自测清单
- [ ] 能 3 分钟讲清项目（业务 + 架构 + 难点 + 结果）
- [ ] 能讲 2 个「踩坑 → 沉淀」的完整故事
- [ ] 能回答「最难的技术点」并给出有深度的答案
- [ ] 准备了 3 个「自己独立解决」的问题

---

## Day 29｜查漏补缺：把 28 天的知识串成体系

### 学习目标
- 用「一张图」把整个项目的数据流串起来
- 找出自己的薄弱环节并补齐
- 做一次完整的项目自检

### 核心概念：全链路数据流（**背下来，面试必用**）

```
【用户点击一栋教学楼】
        │
        ▼
① 浏览器：CesiumViewer.vue  ScreenSpaceEventHandler(LEFT_CLICK)
        │
        ▼
② 三级兜底拾取：pickPosition → globe.pick → pickEllipsoid
        │
        ▼
③ 世界坐标 → 经纬度：Cartographic.fromCartesian → Math.toDegrees
        │
        ▼
④ 先试实体拾取：scene.pick → entity._buildingType（命中则直接弹窗）
        │
        ▼ 未命中
⑤ Axios GET /api/spatial/point-query?table=teaching_building&lng=..&lat=..
        │   （Vite 代理 → 8080）
        ▼
⑥ Spring Boot：SpatialController.pointQuery
        │
        ▼
⑦ SpatialServiceImpl.validateTable（★ 白名单防注入）
        │
        ▼
⑧ MyBatis：SpatialQueryMapper.xml#selectByPoint
        │   SELECT id, name, height, dept_name, description, ...
        │          ST_AsGeoJSON(geom) AS geom
        │   FROM teaching_building
        │   WHERE ST_Intersects(geom, ST_SetSRID(ST_MakePoint(#{lng},#{lat}),4326))
        │   LIMIT 1
        ▼
⑨ PostgreSQL + PostGIS（GiST 索引加速相交判断）
        │
        ▼
⑩ 返回 {code:200, message:success, data:{...}}
        │   （Jackson SNAKE_CASE 序列化）
        ▼
⑪ 前端 axios 响应拦截器：res.code === 200 → return res.data
        │
        ▼
⑫ mapStore.selectBuilding(data) → BuildingPopup.vue 渲染
        │
        ▼
⑬ postRender 每帧重算位置：worldToWindowCoordinates → 弹窗跟随建筑
        │
        ▼
⑭ 照片：/buildings/teaching_building-{id}.jpg（缺图 → onerror 回退占位图）
```

**另一条链路（无人机配送闭环）**：
```
AutoOrderScheduler（每 30s 补单，上限 8 单）
    → OrderServiceImpl.assignDrone（★ FOR UPDATE 行级锁）
        → RouteServiceImpl.plan（pgr_astar + 限飞区避让）
            → 保存 flight_route（status = flying）
            → 无人机状态 = delivering
    → 位置推进（每 2s 插值推进 + haversine 距离口径）
        → 前端 syncDronePositions + smoothMoveEntity（postUpdate 平滑）
    → AutoConfirmScheduler（≤30m 自动确认送达）
        → 电量消耗 5–15%
        → 续派下一单 / 回食堂 idle 待命 / 回食堂充电（15s +5%，≥80% 恢复）
```

### 课后实践题

**题 1**：不看上面的图，自己画出「点击教学楼查详情」的完整链路（前后端 + 数据库），然后对比。
**题 2**：不看笔记，说出下面 10 个词的含义：
`SRID`、`GeoJSON`、`GiST`、`geography`、`ST_AsMVT`、`extrudedHeight`、`shallowRef`、`DataCloneError`、`pgr_astar`、`FOR UPDATE`
**题 3**：自检：下面 10 项能力，你能独立完成几项？（诚实打分，不足的回去补）
**题 4**：写一份「我的项目自检报告」，包含：我最有把握的 3 个技术点、我最薄弱的 3 个点、接下来 7 天的补强计划。

### 参考答案 + 解析

**题 1 答案**：见上方全链路图。**关键是要能说出每一步的"为什么"**：
- 为什么先试实体拾取？→ 省一次网络请求，且能区分具体实体
- 为什么要有兜底拾取？→ 点楼顶时交点会落到楼后空地
- 为什么表名要白名单？→ `${table}` 是字符串拼接，有注入风险
- 为什么用 `ST_SetSRID`？→ 让点与 geom 列坐标系一致，否则报错
- 为什么 `LIMIT 1`？→ 接口契约是返回单个对象，多查是浪费
- 为什么 SNAKE_CASE？→ `application.yml` 的 `property-naming-strategy: SNAKE_CASE`，让 Java 的 `tableName` 输出为 `table_name`，与前端约定一致
- 为什么弹窗每帧重算位置？→ 地球旋转后屏幕位置会变

**题 2 答案**

| 词 | 含义 |
|---|---|
| **SRID** | 空间参考标识符。4326 = WGS84 经纬度；3857 = Web Mercator（米） |
| **GeoJSON** | 用 JSON 描述地理数据的开放标准（FeatureCollection/Feature/geometry） |
| **GiST** | 通用搜索树索引，PostGIS 空间索引类型。`&&` 算子能用它 |
| **geography** | PostGIS 球面类型，单位是**米**；geometry 是平面类型（4326 下单位是**度**）|
| **ST_AsMVT** | 把查询结果打包成 Mapbox 矢量瓦片（protobuf） |
| **extrudedHeight** | 把多边形从 `height` 拉伸到该高度，形成立体块 |
| **shallowRef** | Vue 只代理最外层的 ref，内部对象保持原始引用（**Cesium 对象必须用它**）|
| **DataCloneError** | `postMessage` 结构化克隆失败。Vue Proxy 进 Worker 时触发 |
| **pgr_astar** | pgRouting 的 A\* 最短路径函数，需边表有 source/target/cost/x1,y1,x2,y2 |
| **FOR UPDATE** | SQL 行级排他锁，锁到事务提交。用于防并发重复派单 |

**题 3 自检清单**
- [ ] 能独立写空间 SQL（点选 / 缓冲 / 距离 / 面积 / 分组统计）
- [ ] 能解释 `${}` 和 `#{}` 的区别，并写出白名单校验
- [ ] 能新增一个 Spring Boot 接口（Controller + Service + Mapper + XML）
- [ ] 能解释 `@Valid` 为什么必须显式引入 validation starter
- [ ] 能独立在 Cesium 里加载一个 GeoJSON 图层并拉伸成白模
- [ ] 能解释`shallowRef` / `markRaw` 的原因并排查 `DataCloneError`
- [ ] 能写三级兜底拾取 + rAF 节流悬停
- [ ] 能解释 ENU 逆矩阵算面积的原理
- [ ] 能说出 `pgr_astar` 的 8 步流程和限飞区三层避让
- [ ] 能写出带 `FOR UPDATE` 的事务方法

**题 4 答案**：这一题没有标准答案，但**必须真的写下来**。
格式建议：
```markdown
## 我的项目自检报告（Day 29）

### 一、最有把握的 3 个技术点
1. Cesium 白模与描边（含 clampToGround 互斥、polyline 勾边、图层联动）
2. PostGIS 空间查询（含 geography 口径、`&&` 索引预过滤）
3. Vue + Cesium 的响应式边界（shallowRef/markRaw/DataCloneError）

### 二、最薄弱的 3 个点
1. pgRouting 的导航网格生成脚本细节（只看懂了大意，没自己跑过改参数）
2. MyBatis-Plus 的分页插件与复杂关联查询
3. 部署（Nginx + dist + 后端 jar），没有实际操作过

### 三、接下来 7 天补强计划
- D1–2：把 05_setup_pgrouting_navigation.sql 逐段拆解，改分辨率到 5m 跑一次，对比节点数和规划耗时
- D3–4：给订单列表加分页（MyBatis-Plus 分页插件），并写单测
- D5–6：用 Nginx 把 dist + 后端跑起来，配 /api 转发，验证生产构建可用
- D7：把上面三件事写成博客/笔记（★ 输出倒逼输入）
```
**解析**：为什么「写下来」这么重要：
1. **暴露盲区**：不写下来的话，你会一直觉得"大概都会了"；
2. **可执行**：计划要具体到「哪个文件、做什么、怎么验证」；
3. **面试可用**：「你最近在学什么？」→ 直接讲你的补强计划，**展示学习能力**；
4. **最后一步是关键**：**「写成博客/笔记」——输出倒逼输入**。能讲清楚才算真懂，这一条对求职帮助极大。

### 验证方法
找一个人（或对镜子）**口述整个项目 10 分钟**，录音回听。听的时候问自己：
- 有没有说不清的地方？（那就是盲区）
- 有没有一直说"大概""可能"？（那就是不熟）
- 有没有让对方听懂业务价值？（只讲技术不讲价值，面试分低）

### 自测清单
- [ ] 能画出全链路数据流图（两条链路）
- [ ] 10 个核心术语能秒答
- [ ] 自检清单里至少 8 项能打勾
- [ ] 写完了自检报告 + 7 天补强计划

---

## Day 30｜求职冲刺：作品集、投递与面试实战

### 学习目标
- 把项目整理成可展示的**作品集**
- 制定**投递策略**
- 掌握**面试现场**的应对技巧

### 核心概念
- **作品集三件套**：可访问的 Demo（或录屏）+ 项目文档（README）+ 源码仓库。
- **简历金字塔**：项目经历（最重要）> 技术栈（关键词）> 教育背景。
- **投递漏斗**：投递 100 份 → 约 20 份有回应 → 约 8 场面试 → 1–3 个 offer。**这是正常比例，不要被拒信心态崩。**

### 项目对照（现成材料）
1. 项目根目录 `WebGIS开发作品集.pdf`（1MB）
2. 项目根目录 `闫孜昊-WebGIS开发工程师-简历.docx`
3. `ui-screenshot.png` / `ui-screenshot-2.png` / `ui-screenshot-3.png`（**截图素材**）
4. `scripts/portfolio/build-portfolio-html.mjs`（19.8KB）：**作品集 HTML 生成脚本**
5. `scripts/portfolio/rewrite-resume.mjs`（15KB）：**简历生成脚本**
6. `docs/superpowers/specs/`：**设计方案**（展示你的设计能力）

### 课后实践题

**题 1**：把项目整理成一份「作品集 README」。要求包含：一句话简介、技术栈、3 张截图、3 个技术亮点、如何运行。
**题 2**：把项目经历写成简历里的 4 条 bullet（每条不超过 2 行，含量化结果）。
**题 3**：列一份「WebGIS 开发工程师」岗位的**技能关键词清单**（用于简历和面试准备）。
**题 4**：模拟面试：面试官问「你这个项目是你自己做的还是跟着教程做的？」怎么回答？

### 参考答案 + 解析

**题 1 答案**（作品集 README 模板）
```markdown
# 校园数字孪生 WebGIS 系统（无人机外卖配送）

基于真实校园空间数据的三维数字孪生平台：三维可视化 + 空间分析 + 无人机 A* 路径规划。

![界面](ui-screenshot.png)

## 技术栈
Vue3 · Vite · Cesium 1.145 · Pinia · Element-Plus ｜ Spring Boot 3.2 · MyBatis-Plus
PostgreSQL · PostGIS · pgRouting

## 三个技术亮点
1. **pgRouting A\* + 限飞区边级避让**：15m 导航网格，节点缓冲 + 边级过滤 + 成本惩罚三层设计，
   路径主动远离限飞区；双重穿越检测验证避让效果。
2. **PostGIS 空间查询 + MVT 瓦片**：`ST_Intersects` 点选、`ST_DWithin` 缓冲区；
   MVT 用 `geom && bbox` 走 GiST 索引预过滤，避免全表扫描。
3. **Cesium 三维交互**：建筑白模拉伸 + 三级兜底拾取 + rAF 节流悬停高亮 + 每帧跟随弹窗。

## 工程实践
- 48 个后端单元测试 + 6 个前端源码级架构验证脚本
- 统一响应体 + 全局异常处理（业务语义化 HTTP 状态码）
- 表名白名单防 SQL 注入；`FOR UPDATE` 行级锁防并发重复派单

## 运行
（见 README 的环境要求与快速启动）
```
**解析**：作品集的核心是**「让面试官 30 秒内知道你会什么」**：
1. **一句话简介**放在最前面（业务 + 技术）；
2. **截图**必须有（三维效果是 WebGIS 的卖点，文字描述不如一张图）；
3. **三个技术亮点**要具体（带技术名词，不要写"熟悉 Cesium"）；
4. **工程实践**是差异化（很多求职者只有功能，没有测试、没有异常处理、没有安全考虑）；
5. **运行说明**体现专业度（面试官可能真的会跑一下）。
> 项目里已经有 `scripts/portfolio/build-portfolio-html.mjs` —— **用脚本生成作品集**本身就是个亮点（说明你会工程化）。

**题 2 答案**（简历 bullet 示例）
```markdown
校园数字孪生 WebGIS 系统（无人机外卖配送）｜个人项目｜2026.09
· 独立完成 Vue3 + Cesium 三维校园可视化与 Spring Boot + PostGIS 后端，
  覆盖 8 类校园空间数据，实现建筑白模拉伸、点击查详情、测距测面积等功能。
· 基于 pgRouting 15m 导航网格实现 A* 无人机路径规划，通过节点安全缓冲、
  跨限飞区边过滤与成本惩罚三层设计实现边级避让，并用直线/路径双重穿越检测验证效果。
· 优化 MVT 瓦片查询：用 `geom && bbox`（GiST 索引算子）替换不可索引的
  ST_Intersects(ST_Transform(...)) 表达式，消除每次瓦片请求的全表扫描。
· 建立质量防线：48 个后端单元测试 + 6 个前端架构约束验证脚本，
  并沉淀 README「6 条关键实现约束」，规避 DataCloneError / clampToGround 互斥等隐蔽坑。
```
**解析**：每条 bullet 的结构都是 **「做了什么 + 用的什么技术 + 达到什么效果」**：
- 第 1 条：**范围 + 技术栈 + 功能**（让面试官知道项目规模）
- 第 2 条：**算法难度**（最核心的亮点，放第 2 条因为最吸引人）
- 第 3 条：**性能优化**（有具体的技术对比，体现深度）
- 第 4 条：**工程规范**（差异化优势，很多候选人没有）
> **避坑**：
> - ❌「熟悉 Vue3、Cesium、Spring Boot」（这是技术栈罗列，不是经历）
> - ❌「负责前端开发」（没有信息量）
> - ✅「用 X 技术解决了 Y 问题，达到 Z 效果」
> **量化是关键**：数据量（8 类数据 / 15m 网格 / 48 个测试 / 6 个脚本）比形容词有用得多。

**题 3 答案**（WebGIS 岗位技能关键词）
```
【GIS 基础】WebGIS、GIS、坐标系（WGS84/CGCS2000/Web Mercator）、SRID、
          矢量/栅格、GeoJSON、MVT/PBF 瓦片、瓦片金字塔、空间索引（GiST/R-tree）
【空间分析】空间查询（相交/包含/邻近）、缓冲区分析、叠加分析、量算（距离/面积）、
          路径规划（Dijkstra/A*）、网络分析、坐标转换与投影
【空间数据库】PostgreSQL、PostGIS（ST_* 函数）、pgRouting、空间索引优化、EXPLAIN ANALYZE
【三维 GIS】Cesium、Three.js、3D Tiles、倾斜摄影（OSGB）、BIM/glTF、地形、白模、
          相机控制、拾取（pick）、Entity/Primitive、性能优化
【前端】Vue3（组合式 API）、React（大厂常用）、Vite/Webpack、Pinia/Vuex、
        Element-Plus/Ant Design、Axios、ECharts、ES6+、Canvas/WebGL 基础
【后端】Java + Spring Boot、MyBatis/MyBatis-Plus、RESTful、参数校验、
        全局异常、事务与锁、定时任务、Maven、SQL 优化
【通用】Git、Linux 基础、Nginx、Docker（加分）、Redis（加分）、
        单元测试、代码规范、性能分析
【软技能】需求理解、方案设计（写设计文档）、问题定位与复盘、跨团队沟通
```
**解析**：
- **面试提问的分布大致是**：GIS 基础 30% + 空间数据库/分析 25% + 三维/前端 30% + 后端/通用 15%。
- **权重最高的是「坐标系」和「空间分析」**——这是 WebGIS 与普通前端的分水岭。**坐标系答不上来，基本就挂了。**
- **加分项**：3D Tiles、倾斜摄影、BIM、Shader、GeoServer、大数据量渲染方案。**面试时主动提这些，能拉开差距。**
- **本项目覆盖了其中大部分**：Cesium ✅、PostGIS ✅、pgRouting ✅、MVT ✅、Vue3 ✅、Spring Boot ✅、MyBatis-Plus ✅、性能优化 ✅、单元测试 ✅。

**题 4 答案**（诚实 + 展示增量）
> 「核心框架和 MVP 是我自己搭的，业务逻辑、接口、三维交互都是我自己写的。同时我在开发过程中**参考了官方文档和社区经验**来解决具体问题——比如 Cesium 的 `clampToGround` 与 `extrudedHeight` 互斥这条，是我遇到 `DataCloneError` 后查 Cesium 官方 issue（#12438）确认的。
>
> 不过我可以说清楚**每一处技术选择的原因**：为什么用 `shallowRef`、为什么测面积要用 ENU 逆矩阵、为什么瓦片查询要加 `&&` 预过滤、为什么订单要加 `FOR UPDATE`。如果您想验证，我可以现场推演或改代码。
>
> 我也把踩过的坑整理成了 README 的『6 条关键实现约束』，还有 6 个自动化的架构验证脚本——**这些是为了防止自己或后来的人再犯同样的错**。」
**解析**：这个回答好在四点：
1. **诚实**：承认参考了文档/社区（**没有人是凭空发明的，装"全靠自己"反而不可信**）；
2. **给出可验证的承诺**：「每一处技术选择的原因我都能说清」「可以现场推演或改代码」——**这是最强的自证方式**；
3. **拿出实证**：README 约束、验证脚本、单测——**这些是"我真的做了深度工作"的物理证据**；
4. **把「参考」转化为「学习能力」**：查文档、查 issue、然后沉淀成团队资产，**这是高级工程师的行为模式**。
> **绝对不要说的话**：
> - ❌「完全是我自己从零写的，没参考任何资料」（假，且容易被追问穿）
> - ❌「跟着教程做的」（自降身价）
> - ❌「主要是别人做的，我负责一部分」（如果真是这样，那要提前想好"你负责的那部分"能讲多深）
> **最佳姿态**：**「我做了 A、B、C，其中 X 处我参考了 Y，因为我当时遇到了 Z 问题——我把它彻底搞懂了并沉淀下来了。」**

### 验证方法
1. **完整跑一遍演示**：`启动后端.bat` → `启动前端.bat` → 录屏 2 分钟（覆盖：三维浏览、点建筑、测量、下单、航线规划、飞行动画、统计面板）；
2. **检查作品集**：README + 3 张截图 + PDF 是否一致、截图是否清晰、有无错别字；
3. **模拟面试**：找朋友/同学当面试官，随机问 10 个上面准备过的问题，**计时回答**。

### 自测清单
- [ ] 作品集 README 完成（含截图和 3 个技术亮点）
- [ ] 简历 4 条 bullet 完成（含量化）
- [ ] 技能关键词清单完成
- [ ] 演示录屏完成
- [ ] 完成 1 次模拟面试

---

## 附录 A：常用命令速查

### 项目启动
```powershell
# 后端（项目根目录提供一键脚本，自动使用 IDEA 自带 JDK 25 / Maven 3.9）
.\启动后端.bat

# 前端（首次会自动 npm install）
.\启动前端.bat

# 手动启动
cd backend;  mvn spring-boot:run
cd frontend; npm run dev
```

### 后端测试（★ 必须用 JDK 17）
```powershell
cd backend
$env:JAVA_HOME = "C:\jdk-17.0.20+8"
mvn test                                  # 全部 48 个测试
mvn test -Dtest=OrderServiceImplTest      # 单个测试类
mvn test -Dtest=OrderServiceImplTest#confirmDeliver_alreadyDelivered_shouldThrow
```

### 前端检查与构建
```powershell
cd frontend
npm run dev           # 开发服务器 5173
npm run lint          # ESLint
npm run build         # 生产构建 → dist/
npm run preview       # 预览构建产物 4173
npm run check         # lint + build（提交前必跑）
npm run verify:all    # 6 个架构验证脚本全跑
```

### 接口自测
```powershell
# 图层元数据
curl http://localhost:8080/api/spatial/layers
# 点选查询
curl "http://localhost:8080/api/spatial/point-query?table=teaching_building&lng=114.4682&lat=37.9842"
# 缓冲区（米）
curl "http://localhost:8080/api/spatial/buffer?table=dormitory&lng=114.4682&lat=37.9842&radius=300"
# 整表 GeoJSON
curl http://localhost:8080/api/spatial/geojson/road
# 校园边界
curl http://localhost:8080/api/spatial/campus-bounds
# 航线规划
curl -X POST http://localhost:8080/api/route/plan -H "Content-Type: application/json" `
  -d '{\"startLng\":114.4650,\"startLat\":37.9850,\"endLng\":114.4720,\"endLat\":37.9830,\"altitude\":50}'
# 非法表名（期望 400）
curl -i "http://localhost:8080/api/spatial/point-query?table=evil&lng=1&lat=1"
# Swagger
start http://localhost:8080/swagger-ui.html
```

### 数据库
```powershell
# 建表 / 种子 / 验证（按序）
psql -U postgres -d shp_data -f docs/sql/01_create_tables.sql
psql -U postgres -d shp_data -f docs/sql/02_seed_data.sql
psql -U postgres -d shp_data -f docs/sql/04_verify_data.sql
psql -U postgres -d shp_data -f docs/sql/05_setup_pgrouting_navigation.sql

# 常用查询
psql -U postgres -d shp_data -c "SELECT COUNT(*) FROM drone_nav_node;"
psql -U postgres -d shp_data -c "SELECT PostGIS_version();"
psql -U postgres -d shp_data -c "SELECT status, COUNT(*) FROM delivery_order GROUP BY status;"

# ★ 执行计划（看有没有走索引）
psql -U postgres -d shp_data -c "EXPLAIN ANALYZE
  SELECT id FROM drone_nav_node WHERE is_walkable = true
  ORDER BY geom <-> ST_SetSRID(ST_MakePoint(114.468,37.984),4326) LIMIT 1;"
```

### Git
```powershell
git status
git add -A
git commit -m "feat: 新增 xxx 接口"
git log --oneline -10
git diff HEAD~1 --stat
```

---

## 附录 B：项目踩坑清单（面试「你踩过什么坑」标准答案库）

| # | 坑 | 现象 | 根因 | 解法 | 沉淀位置 |
|---|---|---|---|---|---|
| 1 | Cesium 对象进响应式 | 页面一开就崩，`DataCloneError` | Vue Proxy 无法结构化克隆，几何构建走 Worker | `viewer` 用 `shallowRef`，`dataSources` 用 `shallowReactive` | README 约束1 + `verify-cesium-reactivity.mjs` |
| 2 | 拉伸体配 `clampToGround` | 几何反复重建、性能崩、易触发 #1 | 贴地走 GroundPrimitive，不支持 height/extrudedHeight | `clampToGround = false`，`height=0` + `extrudedHeight` | README 约束2 + `verify-cesium-behavior.mjs` |
| 3 | 拉伸体的 `outline` 无效 | 建筑没有描边 | `polygon.outline` 只对贴地多边形有效 | 另建贴地 polyline 描边，并用映射表联动显隐 | `cesium.js#addBuildingOutlines` |
| 4 | `SceneTransforms` API 改名 | 点击有数据但弹窗不出现 | 1.121 前后改名，旧调用运行时才抛 TypeError | 兼容封装（新名→旧名→null） | `cesium.js#worldToWindowCoordinates` |
| 5 | `isLoading?.()` | 悬停无反应、点击静默失效 | `isLoading` 是布尔属性，不是方法 | 显式判 `=== true` | README 约束4 |
| 6 | async 事件回调异常 | 点击功能静默失效 | 异常变未处理 rejection，不亮红字 | 整个 handler 包 try/catch | `CesiumViewer.vue#registerClickHandler` |
| 7 | ENU 列向量点积算面积 | 100m 边算成 72m/138m，偏差 5.6% | 列是位置矢量且非正交 → 剪切变形 | 用 `Matrix4.inverse` 变到局部 ENU 系 | README 约束5 + `measure.js#computeEnuArea` |
| 8 | `Cartesian3.fromCartesian` | 每次调用抛 TypeError | 该方法只存在于 `Cartographic` | 用 `Cartographic.fromCartesian` | `measure.js` 注释 |
| 9 | `ST_DWithin` 用 geometry | 半径语义错成「度」，全表扫描 | geometry 下单位是坐标单位 | 两边都 `::geography` | `SpatialQueryMapper.xml` L50–55 |
| 10 | MVT 瓦片全表扫描 | 瓦片请求慢 | `ST_Intersects(ST_Transform(...))` 不可索引 | 加 `geom && bbox` 预过滤 | `TileMapper.xml` L42–52 |
| 11 | `resultType="byte[]"` | 抛 `IllegalArgumentException: argument type mismatch` | 被解析成 `Byte[]` 对象数组 | 用 `_byte[]` | `TileMapper.java` 注释 |
| 12 | 缺 validation starter | `@Valid` 静默不生效 | 不是 web starter 的传递依赖 | 显式引入 `spring-boot-starter-validation` | `pom.xml` L34–43 |
| 13 | `dataSources.add()` 没 await | `getByName()` 查不到刚加的图层 | `DataSourceCollection.add` 是异步的 | `await` 后再取 | `cesium.js#addBuildingOutlines` |
| 14 | 弹窗定位脱节 | 拖动地球后弹窗不动 | 只在点击时算了一次屏幕坐标 | `postRender` 每帧重算 | `BuildingPopup.vue` |
| 15 | 取环逻辑写错 | MultiPolygon 描边/形心错 | coordinates 嵌套层级不同（每层 type 多一层括号） | 按 type 分支取外环 | `cesium.js#getFeatureCentroid` |
| 16 | JDK 25 跑测试 | Mockito 全部报错 | ByteBuddy 1.14.1 无法在 JDK 25 插桩 | 测试必须用 JDK 17 | README 测试章节 |
| 17 | 图层显隐不同步 | 勾选框变了但地图没反应 | 只改了 Vue 状态，没改 `dataSource.show` | store 里手动双向同步 | `stores/map.js#setLayerVisible` |
| 18 | 描边残留 | 关掉教学楼后描边还在 | 描边是独立 dataSource | `OUTLINE_KEY_OF` 映射联动 | `stores/map.js` L244–248 |
| 19 | 全表读进内存做统计 | 数据量增长后内存/耗时线性劣化 | `selectList(null)` 后内存遍历 | 聚合下推到 SQL | `OrderServiceImpl#getDeliveryStats` |
| 20 | 并发重复派单 | 一单派两架无人机 | 检查-执行非原子 | `FOR UPDATE` 行级锁 + `@Transactional` | `OrderServiceImpl#assignDrone` |
| 21 | 起终点同一网格节点 | 数组越界崩溃 | `ST_MakeLine` 产不出有效 LineString | 生成几何后立刻防空判断 | `RouteServiceImpl` Step 5.1 |
| 22 | `pgr_astar` 的 `edge=-1` | 误判/无效边参与穿越检测 | 起点的 edge 是 -1（无入边） | 过滤 `edge > 0` | `RouteServiceImpl` Step 8.2 |
| 23 | 食堂落点抖动 | 无人机回巢位置反复变 | 每次随机偏移 | `CanteenLocator` 确定性落点 | `OrderServiceImpl#canteenSpotFor` |
| 24 | `removeEventListener` 失效 | 监听器堆积、重复触发 | 用匿名函数注册，remove 不掉 | 存 handler 引用，统一清理 | `CesiumViewer.vue` L108/L190 |
| 25 | rAF 回调在销毁后触发 | 报错 + 内存泄漏 | 未 `cancelAnimationFrame` | 卸载时取消 | `CesiumViewer.vue` L650–656 |

> **用法**：面试被问「你踩过什么坑？」→ 从这张表里挑 **2–3 个有技术含量的**（推荐 #1、#5、#7、#10、#20），按「现象 → 根因 → 解法 → 沉淀」四步讲。

---

## 附录 C：20 道 WebGIS 高频面试题（附答题框架）

### GIS 基础类
**1. 什么是 WebGIS？和普通 Web 开发有什么区别？**
→ 答「数据维度」：普通 Web 处理文本/数字，WebGIS 处理带坐标的空间数据（点/线/面），需要空间数据库（PostGIS）+ 地图引擎（Cesium/Leaflet/OpenLayers）+ 空间分析能力（相交/邻近/缓冲/路径规划）。**最后补一句：所以 WebGIS 的核心竞争力是「空间思维 + 空间数据处理能力」。**

**2. WGS84、GCJ-02、BD-09 有什么区别？**
→ WGS84 是国际标准（GPS 原始坐标）；GCJ-02 是国测局加密坐标（高德/腾讯用）；BD-09 是百度在 GCJ-02 上再加密。
→ **项目实践**：本项目数据虽标注 WGS84，但实际按高德（GCJ-02）底图采集，底图也用高德 → 同基准无需平移。曾改用天地图（WGS84）底图后出现 **约 109m 偏移**。
→ **加分**：偏移量在几十米到几百米，取决于位置和偏移算法。

**3. 4326 和 3857 有什么区别？什么时候用哪个？**
→ 4326：WGS84 经纬度，单位「度」，用于**存储和交换**数据。
→ 3857：Web Mercator，单位「米」，用于**Web 地图瓦片和投影显示**。
→ **项目实践**：数据存 4326；MVT 瓦片计算时转 3857（`ST_TileEnvelope` 在 3857 下工作），但**索引预过滤时又转回 4326** 以命中建在原始列上的 GiST 索引。

**4. 什么是 GeoJSON？它的结构是怎样的？**
→ 见 Day 3。**重点说清 coordinates 的嵌套层级**（每层 type 多一层中括号）和「后端 geom 用 `ST_AsGeoJSON` 文本往返」的取舍（跨语言、易调试、无重依赖；代价是体积大，所以另有 MVT 方案）。

**5. 空间索引是什么？为什么需要它？**
→ GiST/R-tree，为「相交/邻近判断」优化。没有索引 → 全表逐行做几何运算。
→ **项目实践**：MVT 查询用 `geom && bbox` 走 GiST，替换不可索引的 `ST_Intersects(ST_Transform(...))`。
→ **延伸**：会用 `EXPLAIN ANALYZE` 看是否 `Index Scan`。

### 空间数据库类
**6. PostGIS 常用空间函数有哪些？**
→ `ST_Intersects`（相交）、`ST_DWithin`（范围内）、`ST_Distance`（距离）、`ST_Area`/`ST_Length`（量算）、`ST_Buffer`（缓冲）、`ST_Centroid`（形心）、`ST_AsGeoJSON`/`ST_GeomFromGeoJSON`（转换）、`ST_Transform`（投影变换）、`ST_AsMVT`/`ST_AsMVTGeom`/`ST_TileEnvelope`（瓦片）、`ST_Extent`（范围）。
→ **一定要提 `geography` 口径**：「算距离必须 `::geography`，否则 `ST_DWithin(geom, pt, 100)` 的 100 是度不是米。」

**7. `ST_DWithin` 和 `ST_Distance` 配合使用有什么坑？**
→ 见 Day 2 题 4：geography vs geometry 的单位问题。

**8. 怎么做矢量瓦片（MVT）？有什么好处？**
→ `ST_TileEnvelope` 算瓦片范围 → `ST_AsMVTGeom` 转瓦片坐标 → `ST_AsMVT` 打包。
→ 好处：**传输量小**（protobuf + 按需加载）、**客户端可样式化**、**矢量可拾取**（属性里带 id，点击不用再发请求）、**减少渲染批次**。
→ **项目实践**：`TileMapper.xml`，含 `&&` 索引预过滤优化。

**9. 十万级要素的地图怎么渲染？**
→ 见 Day 28 题 4 的四层方案（源头减量 → 批量渲染 → 视图剔除 → 交互降级）。

### 路径规划类
**10. A\* 和 Dijkstra 的区别？**
→ A\* = Dijkstra + **启发式函数 h(n)**（估计到终点的距离），优先扩展「看起来更接近目标」的节点，**大多数情况下搜索空间更小、更快**。Dijkstra 是 A\* 在 h(n)=0 时的特例。

**11. pgRouting 怎么用？需要什么前提？**
→ `pgr_astar`/`pgr_dijkstra`。边表需要 `id, source, target, cost`，A\* 还需要 `x1,y1,x2,y2`（启发式用）；节点表需要 `id, geom`。
→ **项目实践**：15m 网格 + 8 邻域 + 限飞区避让（三层设计）。

**12. 怎么让路径绕开某个区域？**
→ 三层：**节点级安全缓冲**（区域附近的节点标记不可通行）→ **边级过滤**（跨区域的边不建）→ **成本惩罚**（靠近区域的边加成本，防贴边飞行）。
→ **加分**：说明为什么需要第三层——「只有硬过滤会导致路径贴着边界飞，安全余量太小。」

### 三维/Cesium 类
**13. Cesium 里怎么加载 GeoJSON？怎么做白模？**
→ `GeoJsonDataSource.load(geojson, { clampToGround: false })` 然后遍历 entity 设 `polygon.height = 0`、`polygon.extrudedHeight = 层数 × 3.5`。
→ **必须提**：`clampToGround` 和 `extrudedHeight` 互斥；`polygon.outline` 对拉伸体无效，要另画贴地 polyline。

**14. Cesium 里怎么拾取（点击）物体？**
→ `scene.pick(pos)` 拿实体（返回包装对象，实体在 `.id`）；`scene.pickPosition(pos)` 拿三维交点（需要深度纹理）；`globe.pick(ray)` 与地形求交；`pickEllipsoid` 与椭球求交。
→ **项目实践**：三级兜底 + 有效性校验（`magnitude > 1` 排除地球背面），解决点楼顶交点落到楼后空地的问题。

**15. Cesium 怎么和 Vue 结合？有什么坑？**
→ **核心答案：绝不把 Cesium 对象放进 Vue 响应式状态。**
→ 原因：Proxy 无法结构化克隆 → 几何构建走 Worker → `DataCloneError` → 页面崩。
→ 解法：`shallowRef`（viewer/measureController/容器 DOM）、`shallowReactive`（dataSources）、`markRaw`。
→ **加分**：提到用源码扫描脚本守护这条约束。

**16. Cesium 性能怎么优化？**
→ rAF 节流拾取、避免每帧创建对象（复用 Color 常量）、图标缓存、不用 clampToGround 拉伸、`disableDepthTestDistance` 慎用、按需加载（3D Tiles/MVT）、减少 Entity 数量（用 Primitive/Collection 合批）。

**17. 怎么在世界坐标和屏幕坐标之间转换？**
→ 世界→屏幕：`SceneTransforms.worldToWindowCoordinates`（**注意 1.121 前叫 `wgs84ToWindowCoordinates`，必须做兼容封装**）。
→ 地理→世界：`Cartesian3.fromDegrees(lng, lat, h)`。
→ 世界→地理：`Cartographic.fromCartesian(c)` 然后 `Math.toDegrees`。

### 前端/后端/工程类
**18. 前端怎么和后端联调？跨域怎么解决？**
→ Vite 代理（开发）/ Nginx 转发（生产）+ 后端 CORS 配置。
→ **加分**：解释为什么 CORS 配 `allowCredentials(true)` 时不能用 `allowedOrigins("*")`（CSRF 风险）。

**19. 你怎么保证代码质量？**
→ 单元测试（48 个，覆盖状态机/距离口径/白名单）、源码级架构验证脚本（6 个，固化架构约束）、统一异常处理、参数校验、ESLint、`npm run check` 提交前必跑。
→ **加分**：提「架构适应度函数」这个概念。

**20. 你觉得 WebGIS 开发最核心的能力是什么？**
→ 参考答题框架：
> 我觉得是**「空间思维 + 工程能力的结合」**。
> 单纯会调 Cesium API 做不出好东西——比如做路径规划，难点不在调 `pgr_astar`，而在**把业务约束（限飞区）翻译成图论上的约束**（节点过滤 / 边过滤 / 成本惩罚）。
> 同样，做三维可视化不只是"把楼画出来"，而是要考虑**数据口径一致性**（前端量算和后端 PostGIS 的距离要一致）、**坐标基准**（GCJ-02 与 WGS84 差 109 米）、**性能与精度的取舍**（15m 网格 vs 5m 网格）。
> 所以我认为 WebGIS 工程师的核心竞争力是：**能把空间问题抽象成计算问题，再用工程手段把它做稳。**

---

## 附录 D：30 天学习打卡表

| Day | 主题 | 概念 | 读码 | 做题 | 验证 | 打卡 |
|---|---|---|---|---|---|---|
| 1 | 认识 WebGIS + 跑起来 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 2 | PostGIS 与空间 SQL | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | GeoJSON 与坐标转换 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4 | 环境与 SQL 脚本 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | Spring Boot 第一个接口 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 6 | 参数校验与全局异常 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 7 | MyBatis-Plus 与动态 SQL | ☐ | ☐ | ☐ | ☐ | ☐ |
| 8 | 空间查询接口实战 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 9 | 统一响应、异常与 CORS | ☐ | ☐ | ☐ | ☐ | ☐ |
| 10 | MVT 矢量瓦片 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 11 | Vue3 基础 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 12 | Pinia 与响应式陷阱 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 13 | Vite 工程化 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 14 | Cesium Viewer 与第一个图层 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 15 | 建筑白模与互斥属性 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 16 | 相机与飞行 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 17 | 鼠标交互与三维拾取 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 18 | 弹窗与浮窗定位 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 19 | 图层体系与加载编排 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 20 | 测距与测面积（ENU） | ☐ | ☐ | ☐ | ☐ | ☐ |
| 21 | 无人机实体与 Canvas 图标 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 22 | 航线绘制与飞行动画 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 23 | 三维拾取与业务联动 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 24 | pgRouting 与 A\* | ☐ | ☐ | ☐ | ☐ | ☐ |
| 25 | 订单状态机与自动调度 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 26 | 测试与工程质量 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 27 | 前端性能优化 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 28 | 简历、作品集与面试 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 29 | 查漏补缺与串体系 | ☐ | ☐ | ☐ | ☐ | ☐ |
| 30 | 求职冲刺 | ☐ | ☐ | ☐ | ☐ | ☐ |

### 每日日志模板（复制到你的笔记里用）

```markdown
## Day __ ｜ 主题：______
日期：____-__-__     用时：__ h

### 今天学到的 3 个关键点
1.
2.
3.

### 我踩的坑 / 报错
- 现象：
- 报错原文：
- 根因：
- 解决：

### 今天的实践题完成情况
- 题1：✅/❌   题2：✅/❌   题3：✅/❌
- 最难的是：

### 明天要补的
-
```

---

## 附录 E：如果时间不够（14 天压缩版）

时间紧张的话，**优先保住「面试能讲」的部分**：

| 天 | 内容 | 说明 |
|---|---|---|
| 1 | 跑起项目 + 看懂 README 六条约束 | 唯一必须「动手」的一步 |
| 2 | PostGIS 空间 SQL（点选/缓冲/距离/面积） | GIS 基础，面试必问 |
| 3 | GeoJSON + SRID/坐标系（4326/3857/GCJ-02） | 面试必问，差距点 |
| 4 | MVT 瓦片 + 索引优化（`&&`、EXPLAIN） | 性能亮点 |
| 5 | Spring Boot 接口 + 统一响应 + 全局异常 | 后端基础 |
| 6 | `@Valid` 校验 + 白名单防注入 | 安全亮点 |
| 7 | Cesium Viewer + 加载 GeoJSON + 白模 | 三维基础 |
| 8 | **`shallowRef` / DataCloneError** | 最能体现深度的点 |
| 9 | 三级兜底拾取 + rAF 节流 | 交互亮点 |
| 10 | ENU 逆矩阵算面积 | 数学亮点 |
| 11 | pgRouting A\* + 限飞区三层避让 | **项目最强亮点** |
| 12 | 订单状态机 + `FOR UPDATE` 并发 | 后端亮点 |
| 13 | 测试（48 单测 + 6 验证脚本） | 工程素养 |
| 14 | 简历 + 作品集 + 模拟面试 | 收尾 |

**压缩版纪律**：每天**只学不练等于没学**。至少保证：
1. 每条链路能画出流程图；
2. 每个「坑」能讲出现象→根因→解法→沉淀；
3. 附录 C 的 20 道题能答出 15 道。

---

## 结语

这份日志一共 30 天，但它真正想教你的不是 30 天的知识，而是**一件事**：

> **看到一个新项目，知道怎么拆开它、看懂它、改对它、并把它讲清楚。**

你看这个项目最值钱的地方，不是「用了 Cesium」或者「用了 PostGIS」——这些查文档都会。最值钱的是 README 顶部那 **6 条「关键实现约束」**：

- 它们是**踩过坑之后写下的**，每一条背后都是一次崩溃、一次排查、一次原理追查。
- 它们被放在**最显眼的位置**，还配了**自动化验证脚本**去守——因为作者知道「人类的记忆不可靠，机制才可靠」。

所以求职时，你要展示的不是「我会多少技术」，而是：

**「我能把一件复杂的事做对，并且让别人也能做对。」**

这，才是 WebGIS 开发工程师（以及任何工程师）真正的核心竞争力。

祝你在 30 天后拿到心仪的 offer。

---

*文档基于项目 `D:\iDEA-Data\webgis-campus-digitaltwin-mvp` 的真实源码编写，所有文件路径、行号、代码片段、版本号均来自该项目。*
