# 配图来源与生成方式

本目录的 `*.jpg` **不是实景照片**，而是用项目底图（高德卫星影像，与空间数据同基准）
按每栋建筑的轮廓裁切的 2:1 影像图，代表"这栋楼在这个位置"的实拍影像。

- 生成脚本：`scripts/dev/gen-building-images.mjs`（`node scripts/dev/gen-building-images.mjs`）
- 瓦片：高德卫星影像 style=6，缩放级别 z=18，与本项目 Cesium 底图同源
- 输出：800×400 JPEG（q=0.84），弹窗内 288×132 object-fit: cover
- 重新生成需要：后端 :8080 在跑（取建筑几何）+ 本机装有 Edge（无头渲染）

## 为什么不用网图

拿其它学校的楼照片当"本校 6 号教学楼"，面试时一句"这是你们学校的楼吗"就问穿了；
而且网图还有版权问题。用自己底图裁切的影像，既真实可核对，也和项目的空间数据一一对应。

## 清单

| 表 | id | 建筑 | 文件 |
|---|---|---|---|
| teaching_building | 1 | 6号教学楼 | `teaching_building-1.jpg` |
| teaching_building | 2 | 5号教学楼 | `teaching_building-2.jpg` |
| teaching_building | 3 | 4号教学楼 | `teaching_building-3.jpg` |
| teaching_building | 4 | 3号教学楼 | `teaching_building-4.jpg` |
| teaching_building | 5 | 2号教学楼 | `teaching_building-5.jpg` |
| teaching_building | 6 | 7号教学楼 | `teaching_building-6.jpg` |
| teaching_building | 7 | 8号教学楼 | `teaching_building-7.jpg` |
| dormitory | 1 | 3号宿舍楼 | `dormitory-1.jpg` |
| dormitory | 2 | 1号宿舍楼 | `dormitory-2.jpg` |
| dormitory | 3 | 2号宿舍楼 | `dormitory-3.jpg` |
| dormitory | 4 | 4号宿舍楼 | `dormitory-4.jpg` |
| dormitory | 5 | 5号宿舍楼 | `dormitory-5.jpg` |
| dormitory | 6 | 6号宿舍楼 | `dormitory-6.jpg` |
| dormitory | 7 | 7号宿舍楼 | `dormitory-7.jpg` |
| dormitory | 8 | 8号宿舍楼 | `dormitory-8.jpg` |
| dormitory | 9 | 10号宿舍楼 | `dormitory-9.jpg` |
| dormitory | 10 | 9号宿舍楼 | `dormitory-10.jpg` |
| other_buildings | 1 | 体育馆 | `other_buildings-1.jpg` |
| other_buildings | 2 | 快递站 | `other_buildings-2.jpg` |
| other_buildings | 3 | 发廊 | `other_buildings-3.jpg` |
| other_buildings | 4 | 食堂1 | `other_buildings-4.jpg` |
| other_buildings | 5 | 医务室 | `other_buildings-5.jpg` |
| other_buildings | 6 | 水房 | `other_buildings-6.jpg` |
| other_buildings | 7 | 食堂2 | `other_buildings-7.jpg` |
| other_buildings | 8 | 音乐厅 | `other_buildings-8.jpg` |
| other_buildings | 9 | 杂物间 | `other_buildings-9.jpg` |
| other_buildings | 10 | 图书馆 | `other_buildings-10.jpg` |
| other_buildings | 11 | 行政楼 | `other_buildings-11.jpg` |
