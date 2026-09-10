# 校园数字孪生 WebGIS 系统 (MVP)

> 面向 WebGIS 工程师就业的全栈项目 — 基于真实校园空间数据的数字孪生三维可视化平台

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **前端** | Vue3 + Vite + Cesium + Element-Plus + Pinia | Vue 3.4 / Vite 5 / Cesium 1.114 |
| **后端** | Spring Boot + MyBatis-Plus + HikariCP | Spring Boot 3.2 / Java 17 / MyBatis-Plus 3.5 |
| **数据库** | PostgreSQL + PostGIS | PostgreSQL 18 |
| **坐标系统** | WGS84 (SRID 4326) | — |

## 项目结构

```
webgis-campus-digitaltwin-mvp/
├── backend/                    # Spring Boot 后端
│   ├── src/main/java/com/campus/twin/
│   │   ├── CampusTwinApplication.java
│   │   ├── common/            # 统一响应、异常处理
│   │   ├── config/            # CORS、MyBatis-Plus、Swagger
│   │   ├── controller/        # 空间查询、瓦片、IoT、统计
│   │   ├── service/           # 业务逻辑
│   │   ├── mapper/            # 数据访问层
│   │   ├── entity/            # 8张空间表实体类
│   │   └── dto/               # 数据传输对象
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   └── mapper/            # 空间SQL XML
│   └── pom.xml
│
├── frontend/                   # Vue3 前端
│   ├── src/
│   │   ├── api/                # Axios 接口封装
│   │   ├── stores/             # Pinia 状态管理
│   │   ├── components/         # Vue 组件
│   │   │   ├── CesiumViewer.vue    # 三维场景核心
│   │   │   ├── LayerPanel.vue       # 图层控制面板
│   │   │   ├── BuildingPopup.vue    # 建筑点击弹窗
│   │   │   ├── MeasureTool.vue      # 测距/测面积工具
│   │   │   └── StatPanel.vue        # 统计面板
│   │   ├── utils/              # Cesium 工具封装
│   │   ├── App.vue
│   │   ├── main.js
│   │   └── style.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── docs/                       # 项目文档
│   ├── api.md                  # 接口文档
│   └── superpowers/specs/     # 设计文档
└── README.md
```

## 环境要求

- **JDK 17+**
- **Maven 3.6+**
- **Node.js 16+**（推荐 18+）
- **PostgreSQL 14+** 且已安装 **PostGIS** 扩展
- 校园空间数据已导入 PostGIS（8 张表：school, teaching_building, dormitory, other_buildings, road, playground, basketball_court, tennis_court）

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

确保 PostgreSQL 运行中，数据库 `shp_data` 已创建，空间数据已导入：

```sql
-- 确认 PostGIS 扩展
CREATE EXTENSION IF NOT EXISTS postgis;

-- 确认数据表
SELECT * FROM school;
SELECT * FROM teaching_building;
```

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

### 物联网模拟
- 55 个模拟设备点位（摄像头12、路灯20、烟感15、能耗8）
- 在线/离线状态区分（绿色/红色）
- 设备点击查看详情
- 告警列表（随机生成）

### 统计看板
- 建筑总数、建筑面积、平均楼层
- 道路条数、道路总长
- 运动场地数量
- 设备在线/离线/告警统计

## 后端接口一览

| 分类 | 接口 | 说明 |
|------|------|------|
| 空间查询 | `GET /api/spatial/layers` | 图层元数据 |
| | `GET /api/spatial/point-query` | 点选查询 |
| | `GET /api/spatial/buffer` | 缓冲区查询 |
| | `GET /api/spatial/geojson/{table}` | GeoJSON 输出 |
| | `GET /api/spatial/campus-bounds` | 校园边界 |
| MVT瓦片 | `GET /tiles/{table}/{z}/{x}/{y}.mvt` | 矢量瓦片 |
| 物联网 | `GET /api/iot/devices` | 设备列表 |
| | `GET /api/iot/device/{id}/realtime` | 设备实时数据 |
| | `GET /api/iot/alerts` | 告警列表 |
| | `GET /api/iot/stats` | 设备统计 |
| 统计 | `GET /api/stat/overview` | 校园概览 |

详见 [docs/api.md](docs/api.md)

## 面试亮点（技术点讲解）

1. **PostGIS 空间查询**：ST_Intersects 点选、ST_DWithin 缓冲区、ST_AsMVT 矢量瓦片生成
2. **MVT 矢量瓦片**：后端直接用 PostGIS 原生函数生成 protobuf 瓦片，前端 Cesium 加载，减少数据传输
3. **Cesium 白模拉伸**：GeoJsonDataSource + extrudedHeight，按建筑高度拉伸三维模型
4. **前后端分离**：Vue3 + Spring Boot REST API，Vite 代理解决跨域
5. **空间数据建模**：8 张空间表统一实体基类，建筑类实现 BuildingInfo 接口
6. **SQL 注入防护**：表名白名单校验，动态表名只允许预定义的 8 张表

## 扩展方向（后续迭代）

- [ ] 仿真业务层：消防疏散模拟、日照阴影模拟
- [ ] 倾斜摄影 OSGB / BIM glb 模型加载
- [ ] 真实 IoT 设备接入（InfluxDB 时序数据库）
- [ ] 时间轴昼夜模拟
- [ ] Nginx 部署 + 前端打包 dist 托管
- [ ] 设备告警三维高亮联动

## 许可证

MIT
