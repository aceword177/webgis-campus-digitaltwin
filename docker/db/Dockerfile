# 数据库镜像：PostGIS 官方镜像 + pgRouting
#
# 为什么需要自定义：官方 postgis/postgis 镜像只带 PostGIS，不含 pgRouting，
# 而本项目的 A* 路径规划依赖 pgr_astar。PGDG 源已在官方镜像里配置好，
# 直接 apt 装对应大版本的 pgrouting 包即可。
#
# 换 PostgreSQL 大版本时：把 base 镜像 tag 和 postgresql-<大版本>-pgrouting 一起改，
# 两者必须一致（pgRouting 是 PG 扩展，强绑大版本）。
FROM postgis/postgis:17-3.5

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-17-pgrouting \
 && rm -rf /var/lib/apt/lists/*

# 初始化脚本由 docker-compose.yml 挂载到 /docker-entrypoint-initdb.d，
# 仅在数据卷为空（首次启动）时按文件名顺序执行：
#   00_spatial_tables.sql  8 张校园空间表 + 62 个要素（ArcMap 矢量化产物）
#   01_create_tables.sql   6 张业务表
#   02_seed_data.sql       业务种子数据
#   03_fix_no_fly_zone.sql 限飞区修正
#   04_verify_data.sql     只读校验（不写数据）
#   05_setup_pgrouting_navigation.sql  15m 导航网格（3100 节点 / 10693 边）
#   06_add_building_profile.sql        建筑简介字段
