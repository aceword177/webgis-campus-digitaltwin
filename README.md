# 校园无人机外卖配送系统（WebGIS 数字孪生 MVP v2.0）

> 面向 WebGIS 工程师就业的全栈项目 — 基于真实校园空间数据的数字孪生三维可视化 + 无人机外卖配送闭环

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **前端** | Vue3 + Vite + Cesium + Element-Plus + Pinia | Vue 3.4 / Vite 5 / Cesium 1.114 |
| **后端** | Spring Boot + MyBatis-Plus + HikariCP | Spring Boot 3.2 / Java 17 / MyBatis-Plus 3.5 |
| **数据库** | PostgreSQL + PostGIS + **pgRouting** | PostgreSQL 18 / pgRouting（A* 路径规划） |
| **坐标系统** | WGS84 (SRID 4326) | — |

## 项目结构

```
webgis-campus-digitaltwin-mvp/
├── backend/                    # Spring Boot 后端
│   ├── src/main/java/com/campus/twin/
│   │   ├── CampusTwinApplication.java
│   │   ├── common/            # 统一响应、异常处理
│   │   ├── config/            # CORS、MyBatis-Plus、Swagger、数据清理
│   │   ├── controller/        # 空间/瓦片/统计/无人机/订单/航线/限飞区/餐厅/商品
│   │   ├── service/           # 业务逻辑（含 pgr_astar 路径规划、位置推进、自动调度）
│   │   ├── mapper/            # 数据访问层（含 NavigationMapper 导航查询）
│   │   ├── entity/            # 8张空间表 + 6张业务表 + 2张导航表实体
│   │   └── dto/               # 数据传输对象
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   └── mapper/            # 空间SQL XML
│   └── pom.xml
│
├── frontend/                   # Vue3 前端
│   ├── src/
│   │   ├── api/                # Axios 接口封装（9 组）
│   │   ├── stores/             # Pinia 状态管理（Viewer/图层/无人机/订单/动画）
│   │   ├── components/         # Vue 组件
│   │   │   ├── CesiumViewer.vue    # 三维场景核心
│   │   │   ├── Sidebar.vue         # 侧边栏导航（5 面板）
│   │   │   ├── LayerPanel.vue      # 图层控制面板
│   │   │   ├── OrderPanel.vue      # 订单管理面板
│   │   │   ├── OrderDetail.vue     # 订单详情（飞行动画控制）
│   │   │   ├── DronePanel.vue      # 无人机管理面板
│   │   │   ├── RoutePlanPanel.vue  # 航线规划面板
│   │   │   ├── DeliveryStats.vue   # 配送统计面板
│   │   │   ├── BuildingPopup.vue   # 建筑点击弹窗
│   │   │   └── MeasureTool.vue     # 测距/测面积工具
│   │   ├── utils/              # Cesium 工具封装（白模/无人机/动画/限飞区）
│   │   ├── App.vue
│   │   ├── main.js
│   │   └── style.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── docs/                       # 项目文档
│   ├── api.md                  # 接口文档
│   ├── sql/                    # 建表/种子/限飞区/验证/导航网格脚本
│   ├── debug-archive/          # 历史调试产物归档
│   └── superpowers/            # 设计文档与实施计划
└── README.md
```

## 环境要求

- **JDK 17+**
- **Maven 3.6+**
- **Node.js 16+**（推荐 18+）
- **PostgreSQL 14+** 且已安装 **PostGIS** 与 **pgRouting** 扩展
- 校园空间数据已导入 PostGIS（8 张表：school, teaching_building, dormitory, other_buildings, road, playground, basketball_court, tennis_court）
- 配送业务数据与导航网格已初始化（`docs/sql/` 脚本按序执行）

## 快速启动

### 方式一：一键启动脚本（推荐，无需配置环境变量）

项目根目录提供了两个启动脚本，自动使用 IntelliJ IDEA 自带的 JDK 25 和 Maven 3.9：

```bash
# 启动后端（双击运行或命令行执行）
启动后端.bat

# 启动前端（首次会自动 npm install）
启动前端.bat
```

### 方式二：命令行手动启动

#### 1. 数据库准备

确保 PostgreSQL 运行中，数据库 `shp_data` 已创建，空间数据与业务数据已导入：

```sql
-- 确认 PostGIS / pgRouting 扩展
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;

-- 确认数据表
SELECT * FROM school;
SELECT * FROM restaurant;
```

> 导航网格（drone_nav_node / drone_nav_edge）由 `docs/sql/05_setup_pgrouting_navigation.sql` 生成，15m 分辨率、含限飞区边级避让与成本惩罚，重建秒级且幂等。

#### 2. 启动后端

> 注意：系统需安装 JDK 17+ 和 Maven 3.6+，或使用 IntelliJ IDEA 自带环境。

```bash
cd backend

# 修改数据库连接（如非默认配置）
# 编辑 src/main/resources/application.yml 中的 url/username/password

# 编译运行
mvn spring-boot:run
```

后端启动成功后：
- 接口地址：http://localhost:8080
- Swagger 文档：http://localhost:8080/swagger-ui.html

#### 3. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端启动后访问 http://localhost:5173

## 核心功能

### 三维可视化
- 校园倾斜影像底图（高德影像）
- 建筑白模拉伸（按 height 字段 × 3.5m/层），按类型着色
  - 教学楼：蓝色
  - 宿舍楼：橙色
  - 其他建筑：绿色
- 道路线渲染、运动场地半透明面、校园边界黄色描边

### 空间交互
- **建筑点击**：点击建筑弹出属性面板（名称、楼层、面积、坐标）
- **图层控制**：左侧面板独立控制每个图层显隐
- **测距工具**：左键连续打点，右键结束，显示每段距离
- **测面积工具**：左键绘制多边形，右键结束，显示面积
- **定位校园**：一键飞行到校园中心

### 无人机外卖配送
- **订单闭环**：手动下单或系统自动补单（每 30 秒，全局在飞上限 8 单），状态机 pending → delivering → delivered / cancelled
- **A\* 路径规划**：基于 pgRouting 15m 导航网格，`pgr_astar` 求最短路径，自动绕行限飞区
- **限飞区边级避让**：节点带 5m 安全缓冲判定；跨越限飞区的网格边直接过滤；靠近限飞区的边有成本惩罚（防贴边飞行）
- **真实穿越检测**：起终点直线是否穿越限飞区、规划路径是否仍穿越，结果实时展示
- **自动调度**：空闲且电量 >30% 的无人机自动接单；送达后自动续派下一单 / 回食堂待命 / 充电（15s +5%，≥80% 恢复）
- **实时位置推进**：配送中无人机每 2 秒沿航线插值推进，前端平滑移动 + 金色尾迹线
- **飞行动画**：订单详情可播放配送动画，支持跟随 / 第一人称 / 俯瞰三视角

### 统计看板
- 建筑总数、建筑面积、平均楼层
- 道路条数、道路总长、运动场地数量
- 无人机状态统计（空闲/配送中/充电/电量）
- 配送统计（今日订单、送达率、平均时长、餐厅订单量）

## 后端接口一览

| 分类 | 接口 | 说明 |
|------|------|------|
| 空间查询 | `GET /api/spatial/layers` | 图层元数据 |
| | `GET /api/spatial/point-query` | 点选查询 |
| | `GET /api/spatial/buffer` | 缓冲区查询 |
| | `GET /api/spatial/geojson/{table}` | GeoJSON 输出 |
| | `GET /api/spatial/campus-bounds` | 校园边界 |
| MVT瓦片 | `GET /tiles/{table}/{z}/{x}/{y}.mvt` | 矢量瓦片 |
| 统计 | `GET /api/stat/overview` | 校园概览 |
| 无人机 | `GET /api/drone/list` | 无人机列表（实时位置/电量） |
| | `GET /api/drone/stats` | 无人机状态统计 |
| | `POST /api/drone/{id}/update-position` | 位置/电量上报 |
| 订单 | `GET /api/order/list` | 订单列表 |
| | `POST /api/order/create` | 创建订单 |
| | `POST /api/order/{id}/assign` | 分配无人机 + 规划航线 |
| | `POST /api/order/{id}/deliver` | 确认送达（≤30m 校验） |
| | `POST /api/order/{id}/cancel` | 取消订单 |
| | `GET /api/order/stats` | 配送统计 |
| 航线 | `POST /api/route/plan` | A* 路径规划（限飞区避让） |
| | `GET /api/route/order/{orderId}` | 订单航线 |
| | `GET /api/route/active` | 飞行中航线 |
| 限飞区 | `GET /api/no-fly-zone/list` | 限飞区列表 |
| | `POST /api/no-fly-zone/check` | 线段穿越检测 |
| 餐厅/商品 | `GET /api/restaurant/list` | 餐厅列表 |
| | `GET /api/restaurant/{id}/products` | 餐厅商品 |
| | `GET /api/product/hot` | 热销商品榜 |

详见 [docs/api.md](docs/api.md)

## 面试亮点（技术点讲解）

1. **PostGIS 空间查询**：ST_Intersects 点选、ST_DWithin 缓冲区、ST_AsMVT 矢量瓦片生成
2. **pgRouting A\* 路径规划**：15m 分辨率导航网格 + 8 邻域连接，`pgr_astar` 求最短路径
3. **限飞区边级避让**：节点安全缓冲判定 + 线段级过滤（跨区不建边）+ 靠近限飞区的边成本惩罚（软约束防贴边）
4. **真实穿越检测**：起终点直线与规划路径双重 ST_Intersects 检测，返回穿越限飞区明细
5. **配送业务闭环**：自动补单 → A* 规划 → 位置实时推进 → 到达自动确认 → 充电/续派自循环
6. **MVT 矢量瓦片**：PostGIS 原生 ST_AsMVT 生成 protobuf 瓦片，Cesium 直接加载，减少数据传输
7. **Cesium 白模拉伸**：GeoJsonDataSource + extrudedHeight，按建筑高度拉伸三维模型
8. **前后端分离**：Vue3 + Spring Boot REST API，Vite 代理解决跨域；全局 SNAKE_CASE 序列化
9. **SQL 注入防护**：表名白名单校验，动态表名只允许预定义的 8 张表
10. **工程规范**：git 版本管理、定时任务分模块解耦、防御性编码（坐标缺失/几何解析失败兜底）

## 扩展方向（后续迭代）

- [ ] 仿真业务层：消防疏散模拟、日照阴影模拟
- [ ] 倾斜摄影 OSGB / BIM glb 模型加载
- [ ] 导航网格升级：更高分辨率（5m）、动态限飞区热更新
- [ ] 真实无人机机队接入（遥测上报 + 任务下发协议）
- [ ] 时间轴昼夜模拟
- [ ] Nginx 部署 + 前端打包 dist 托管
- [ ] 订单超时自动取消、多无人机任务调度优化

## 许可证

MIT
