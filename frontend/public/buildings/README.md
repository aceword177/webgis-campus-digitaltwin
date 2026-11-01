# 建筑影像目录

点击地图上的建筑后，弹窗顶部的图从**本目录按固定规则取图**，不需要改代码、不需要写数据库字段。

## 目录里现在有什么

**28 张**卫星影像（教学楼 7 + 宿舍楼 10 + 其他建筑 11），每张 800×400 JPEG，约 45 KB。

> 它们**不是实景照片**，而是用项目底图（高德卫星影像，与空间数据同基准）按每栋建筑的轮廓裁切的影像图，
> 由 `scripts/dev/gen-building-images.mjs` 生成，来源与参数见 [SOURCES.md](./SOURCES.md)。
> 弹窗右下角有「卫星影像」角标，避免被误认为实拍照片。

## 命名规则

```
{表名}-{建筑id}.jpg
```

| 建筑图层 | 表名 | 示例文件名 | 对应建筑 |
|---|---|---|---|
| 教学楼 | `teaching_building` | `teaching_building-1.jpg` | 6号教学楼（商学院） |
| 教学楼 | `teaching_building` | `teaching_building-5.jpg` | 2号教学楼（实训楼） |
| 宿舍楼 | `dormitory` | `dormitory-1.jpg` | 3号宿舍楼 |
| 宿舍楼 | `dormitory` | `dormitory-10.jpg` | 9号宿舍楼 |
| 其他建筑 | `other_buildings` | `other_buildings-4.jpg` | 食堂1 |

`id` 就是数据库里的主键，可查：

```sql
SELECT id, name, dept_name FROM teaching_building ORDER BY id;   -- 教学楼
SELECT id, name, gender    FROM dormitory         ORDER BY id;   -- 宿舍楼
SELECT id, name            FROM other_buildings   ORDER BY id;   -- 其他建筑
```

## 已有 id 速查

| 教学楼 id | 名称 | 院系 |
|---|---|---|
| 1 | 6号教学楼 | 商学院 |
| 2 | 5号教学楼 | 土木建筑学院 |
| 3 | 4号教学楼 | 人工智能学院 |
| 4 | 3号教学楼 | 网络空间安全学院 |
| 5 | 2号教学楼 | 实训楼 |
| 6 | 7号教学楼 | 人工智能学院 |
| 7 | 8号教学楼 | 艺术与传媒学院 |

| 宿舍楼 id | 名称 | 性别 |
|---|---|---|
| 1 | 3号宿舍楼 | 男 |
| 2 | 1号宿舍楼 | 男 |
| 3 | 2号宿舍楼 | 女 |
| 4 | 4号宿舍楼 | 女 |
| 5 | 5号宿舍楼 | 男 |
| 6 | 6号宿舍楼 | 男 |
| 7 | 7号宿舍楼 | 男 |
| 8 | 8号宿舍楼 | 女 |
| 9 | 10号宿舍楼 | 男 |
| 10 | 9号宿舍楼 | 女 |

## 重新生成

```bash
node scripts/dev/gen-building-images.mjs
```

前置：后端 `:8080` 在跑（取建筑几何）、本机装有 Edge（无头渲染裁切）。

参数在脚本顶部：`ZOOM = 18`（本区域卫星影像最高只到 18，19 会返回「此区域暂无卫星图」占位图）、
`OUT_W × OUT_H = 800 × 400`，取景按建筑包围盒留 1.4 倍边距。

## 想换成实景照片

直接覆盖同名文件即可，不用改代码：

- **格式**：`.jpg`（当前约定写死；要换 png/webp 需同步改 `BuildingPopup.vue` 里的扩展名）
- **比例**：2:1 横图，弹窗内按 288×132 像素 `object-fit: cover` 裁剪，比例差太多会裁掉边缘
- **体积**：建议单张 ≤ 200KB，弹窗每次点击都会请求
- **版权**：换成网图/实拍前确认授权；本项目自带的 28 张是底图裁切，来源见 SOURCES.md
- 换完记得把弹窗角标文案调成对应的（`BuildingPopup.vue` 里的 `.photo-badge`）

## 缺图怎么办

**不会出现裂图**。文件不存在时 `<img>` 的 `error` 事件会触发，弹窗自动换成带建筑名称的样式化占位图，功能不受影响。

## 关于部署

本目录是 Vite 的 `public` 目录子目录，文件会被原样拷贝到 `dist/buildings/`，访问路径就是 `/buildings/xxx.jpg`。
