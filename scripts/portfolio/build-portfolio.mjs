/**
 * 作品集生成器（Chromium 打印版）。
 *
 * 与旧版 build-portfolio-html.mjs 的区别：
 *  - 旧版靠 Word 打开 HTML 导出 PDF，Word 对 CSS 分页支持极差（正文字号/宽度被忽略、
 *    page-break 只在 <br> 上生效），压出来的页数不可控，第 11 页只剩 4 行属于典型溢出残留。
 *  - 这里改成一份"每页一个 <section class="page">"的 A4 稿，用 Edge/Chrome 的
 *    --print-to-pdf 直接打印：Chromium 完整支持 @page / page-break / object-fit，
 *    页数与版式是可预期的（本稿固定 10 页）。
 *
 * 产物：
 *   .temp-portfolio/portfolio.html   自包含 HTML（截图 base64 内嵌，可直接分发）
 *   .temp-portfolio/WebGIS开发作品集.pdf
 *
 * 截图来源：node scripts/dev/screenshot.mjs（先跑后端 + 前端 dev，再生成作品集）
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const tmp = path.join(root, '.temp-portfolio')
const shots = path.join(tmp, 'shots')
const OUT_HTML = path.join(tmp, 'portfolio.html')
const OUT_PDF = path.join(tmp, 'WebGIS开发作品集.pdf')

/* ------------------------------ 实测数字 ------------------------------ *
 * 所有数字都能在仓库内复现，改代码后请重跑：
 *   图层/要素数        GET /api/spatial/layers
 *   校园尺度/建筑统计   GET /api/stat/overview 、GET /api/spatial/campus-bounds
 *   导航网格规模       SELECT count(*) FROM drone_nav_node / drone_nav_edge
 *   A* 航线指标        POST /api/route/plan（固定起终点，见 AnalysisView.vue DEMO_ROUTE）
 *   订单/机队          GET /api/order/stats 、GET /api/drone/stats
 *   MVT 体积           /tiles/{table}/{z}/{x}/{y}.mvt 与 /api/spatial/geojson/{table}
 * --------------------------------------------------------------------- */
const N = {
  layers: 8,
  features: 62,
  sridCols: 12,
  navNodes: 3100,
  navEdges: 10693,
  tests: 51,
  scripts: 6,
  restApis: 32,
  campusEW: 834.7,
  campusNS: 626.5,
  campusArea: '32.89 万',
  buildings: 28,
  buildingArea: '6.29 万',
  avgFloors: 5.1,
  roads: 29,
  roadLen: 6807.91,
  orders: 12380,
  delivered: 12370,
  cancelled: 10,
  avgMinutes: 24.1,
  drones: 10,
  droneBattery: 64.6,
  // A* 演示（固定起终点：4 号教学楼北侧 → 3 号教学楼南侧）
  straightM: 122.9,
  planM: 273.4,
  detourM: 150.5,
  detourPct: 122,
  waypoints: 18,
  etaS: 55,
  // MVT vs GeoJSON（同一栋教学楼的 z16/53606/25282 瓦片）
  mvtBytes: 440,
  geojsonBytes: 3469,
  // 坐标系
  offsetNorth: -56.8,
  offsetEast: -92.6,
  offsetTotal: 108.6,
}

const REPO = 'https://github.com/aceword177/webgis-campus-digitaltwin'
const SHOWCASE = 'https://aceword177.github.io/webgis-campus-digitaltwin/showcase/'

const img = (name) => {
  const file = path.join(shots, name)
  if (!fs.existsSync(file)) {
    throw new Error(`缺少截图：${path.relative(root, file)}（先跑 node scripts/dev/screenshot.mjs）`)
  }
  return 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64')
}

/* ------------------------------ 版式 ------------------------------ */
const CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Microsoft YaHei", "微软雅黑", sans-serif;
    font-size: 9.6pt; line-height: 1.62; color: #1f2937;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page {
    position: relative;
    width: 210mm; height: 297mm;
    padding: 13mm 14mm 11mm;
    page-break-after: always;
    break-after: page;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; break-after: auto; }

  /* 页眉 */
  .ph {
    display: flex; align-items: baseline; justify-content: space-between;
    padding-bottom: 2mm; margin-bottom: 6mm;
    border-bottom: 1.6pt solid #14243a;
  }
  .ph-k { font-size: 8.4pt; letter-spacing: 2px; color: #2f6fb5; font-weight: 700; }
  .ph-t { font-size: 12.6pt; font-weight: 700; color: #14243a; letter-spacing: .5px; }
  .ph-r { font-size: 8pt; color: #90a0b4; letter-spacing: 1px; }

  /* 一句结论 */
  .claim {
    border-left: 3.2pt solid #2f6fb5; background: #f4f8fd;
    padding: 3mm 4mm; margin-bottom: 5mm;
    font-size: 10.6pt; font-weight: 700; color: #14243a; line-height: 1.55;
  }
  .claim em { font-style: normal; color: #2f6fb5; }

  /* 截图 */
  .shot { margin: 0 0 2mm; }
  .shot-wrap {
    width: 100%; height: 88mm; overflow: hidden;
    border: .8pt solid #d6dfea; border-radius: 1.4mm; background: #0a0e1a;
  }
  .shot-wrap.h72 { height: 72mm; }
  .shot-wrap.h78 { height: 78mm; }
  .shot-wrap img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top center; }
  .cap { font-size: 8.2pt; color: #7d8b9c; margin-top: 1.4mm; }

  /* 正文块 */
  h3 { font-size: 10.2pt; color: #14243a; margin: 4mm 0 1.6mm; }
  h3:first-of-type { margin-top: 1mm; }
  p { margin: 0 0 2.2mm; text-align: justify; }
  ul { margin: 0 0 2.6mm; padding-left: 4.6mm; }
  li { margin-bottom: 1.1mm; }
  b { color: #14243a; }
  .hl { background: #fff5d6; padding: 0 .6mm; }
  code {
    font-family: Consolas, "Courier New", monospace; font-size: 8.4pt;
    background: #f1f5fa; color: #1d4e89; padding: 0 .8mm; border-radius: .6mm;
  }
  pre {
    font-family: Consolas, "Courier New", monospace; font-size: 8.1pt; line-height: 1.55;
    background: #0f172a; color: #d7e3f4; padding: 3mm 3.4mm; border-radius: 1.4mm;
    margin: 0 0 3mm; white-space: pre-wrap;
  }
  pre .c { color: #7f9cc0; }
  pre .g { color: #7ee2a8; }
  pre .r { color: #ff9b9b; }

  /* 表格 */
  table { width: 100%; border-collapse: collapse; margin: 1.6mm 0 3mm; font-size: 8.8pt; }
  th, td { border: .6pt solid #dbe3ed; padding: 1.4mm 2mm; text-align: left; vertical-align: top; }
  th { background: #eef4fb; color: #14243a; font-weight: 700; }
  td.k { width: 30mm; background: #f8fbfe; color: #1d3a5c; font-weight: 700; }
  .num { font-family: Consolas, monospace; }

  /* KPI */
  .kpi { display: flex; gap: 2mm; margin: 0 0 4mm; }
  .kpi div {
    flex: 1; border: .6pt solid #dfe7f0; border-radius: 1.2mm; padding: 2.4mm 1mm;
    text-align: center; background: #fbfdff;
  }
  .kpi .n { display: block; font-size: 13pt; font-weight: 700; color: #2f6fb5; font-family: Consolas, monospace; }
  .kpi .l { display: block; font-size: 7.8pt; color: #6b7c90; margin-top: .6mm; }

  /* 两栏 */
  .cols { display: flex; gap: 6mm; }
  .cols > * { flex: 1; min-width: 0; }

  /* 封面 */
  .cover { text-align: center; padding-top: 6mm; }
  .cover .eyebrow { font-size: 9pt; letter-spacing: 6px; color: #8d9bad; }
  .cover h1 { font-size: 30pt; margin: 8mm 0 2mm; letter-spacing: 3px; color: #14243a; }
  .cover .role { font-size: 11.5pt; color: #2f6fb5; letter-spacing: 1.6px; }
  .cover .name { font-size: 12pt; color: #14243a; font-weight: 700; margin-top: 3mm; letter-spacing: 2px; }
  .cover .meta { font-size: 9pt; color: #7d8b9c; margin-top: 1.6mm; }
  .cover .claim { text-align: left; margin: 9mm 0 5mm; }
  .links { font-size: 8.6pt; color: #33465c; line-height: 1.9; }
  .links span { color: #2f6fb5; font-family: Consolas, monospace; }
  .foot {
    position: absolute; left: 14mm; right: 14mm; bottom: 6mm;
    display: flex; justify-content: space-between;
    font-size: 7.6pt; color: #9fadbf; border-top: .6pt solid #e4eaf2; padding-top: 1.6mm;
  }

  /* 坑页：先错后对 */
  .steps { display: flex; gap: 3mm; margin-bottom: 3mm; }
  .step {
    flex: 1; border: .6pt solid #e2e8f0; border-radius: 1.4mm; padding: 2.6mm 3mm;
    background: #fbfdff; font-size: 8.6pt; line-height: 1.55;
  }
  .step .t { display: block; font-size: 8.2pt; font-weight: 700; color: #2f6fb5; letter-spacing: .6px; margin-bottom: 1mm; }
  .step.bad { background: #fff7f7; border-color: #f3cccc; }
  .step.bad .t { color: #c0392b; }
  .step.good { background: #f4fbf6; border-color: #bfe3cd; }
  .step.good .t { color: #1e8e5a; }
`

/* ------------------------------ 页面 ------------------------------ */
const pageHead = (no, title) => `
    <div class="ph">
      <div><span class="ph-k">${no}</span>&nbsp;&nbsp;<span class="ph-t">${title}</span></div>
      <div class="ph-r">闫孜昊 · WebGIS 开发工程师</div>
    </div>`

const cover = `
<section class="page cover">
  <div class="eyebrow">WEBGIS · 三维可视化 · 空间数据服务</div>
  <h1>WebGIS 开发作品集</h1>
  <div class="role">校园无人机外卖配送系统 · WebGIS 数字孪生</div>
  <div class="name">闫孜昊</div>
  <div class="meta">求职意向：WebGIS 开发工程师 ｜ 全职 ｜ 2027 届本科 · 空间信息与数字技术</div>

  <div class="claim">
    <em>一句话：</em>8 个校园图层、62 个要素由我在 ArcMap 里手工矢量化生产，<br>
    同一套 PostGIS 数据同时驱动三维孪生、二维一张图与运营大屏，<br>
    并在其上跑通「无人机外卖配送」业务闭环。
  </div>

  <div class="kpi">
    <div><span class="n">${N.layers}</span><span class="l">自主矢量化图层</span></div>
    <div><span class="n">${N.features}</span><span class="l">生产要素</span></div>
    <div><span class="n">${N.restApis}</span><span class="l">REST 接口</span></div>
    <div><span class="n">${N.tests}</span><span class="l">后端单元测试</span></div>
    <div><span class="n">${N.scripts}</span><span class="l">前端校验脚本</span></div>
    <div><span class="n">${N.navNodes}</span><span class="l">导航网格节点</span></div>
  </div>

  <div class="shot">
    <div class="shot-wrap" style="height:108mm"><img src="${img('3d-view.jpg')}" alt="三维数字孪生场景"></div>
    <div class="cap">Cesium 三维孪生：建筑按 height 字段拉伸白模，叠加影像底图 / 道路 / 运动场地 / 校园边界，左侧六个业务面板联动</div>
  </div>

  <div class="links">
    源码仓库：<span>${REPO}</span><br>
    在线技术展示：<span>${SHOWCASE}</span><br>
    技术栈：Vue3 + Vite + Cesium 1.145 + OpenLayers 10 + ECharts 6 ｜ Spring Boot 3.2 + MyBatis-Plus ｜ PostgreSQL 18 + PostGIS 3.6 + pgRouting 4.0
  </div>

  <div class="foot">
    <span>本作品集所有数字均可在仓库内复现，验证方法随页标注</span>
    <span>2026.10</span>
  </div>
</section>`

const p2 = `
<section class="page">
  ${pageHead('02', '项目概述 · 技术选型 · 数据组织')}
  <div class="claim">
    这不是「下载一份数据来渲染」的项目：<em>空间底料自己生产</em>，<em>业务闭环真跑通</em>，
    前端三端（三维 / 二维 / 大屏）共用一套 PostGIS。
  </div>

  <p>校园空间数据全部由我在 ArcMap 中依影像底图手工矢量化（平面 + 属性 + 拓扑检查），导出 Shapefile 后导入 PostGIS；
  用 Cesium 渲染为可交互三维校园，并在其上实现「下单 → 自动派机 → A* 规划航线 → 实时推进 → 送达」的配送闭环。
  仓库同时提供二维一张图（OpenLayers + MVT 瓦片）与运营大屏（ECharts），用于验证同一套空间服务接口的通用性。</p>

  <div class="cols">
    <div>
      <h3>技术选型与职责</h3>
      <table>
        <tr><th>层级</th><th>技术</th><th>本项目中的职责</th></tr>
        <tr><td>三维渲染</td><td>Cesium 1.145</td><td>白模拉伸、点选弹窗（射线求交三级兜底）、悬停高亮、测距测面积</td></tr>
        <tr><td>二维渲染</td><td>OpenLayers 10</td><td>MVT 矢量瓦片、点位聚合、点选 / 缓冲区查询；<b>与三维共用同一套 PostGIS 服务接口</b></td></tr>
        <tr><td>可视化大屏</td><td>ECharts 6</td><td>6 个 KPI + 5 张图，全部取自业务表</td></tr>
        <tr><td>前端框架</td><td>Vue3 + Vite + Pinia</td><td>组合式 API、图层/订单/无人机状态编排</td></tr>
        <tr><td>空间数据库</td><td>PostGIS</td><td>ST_Intersects / ST_DWithin / ST_AsMVT / GiST 索引</td></tr>
        <tr><td>路径规划</td><td>pgRouting</td><td>15m 导航网格 + pgr_astar 最短路 + 限飞区避让</td></tr>
        <tr><td>后端服务</td><td>Spring Boot 3.2</td><td>REST 接口、定时调度、订单状态机、无人机位置推进</td></tr>
      </table>
    </div>
    <div>
      <h3>数据组织（实测计数）</h3>
      <table>
        <tr><th>表</th><th>图层</th><th>要素</th><th>几何</th></tr>
        <tr><td><code>school</code></td><td>校园边界</td><td class="num">1</td><td>MultiPolygon</td></tr>
        <tr><td><code>teaching_building</code></td><td>教学楼</td><td class="num">7</td><td>MultiPolygon</td></tr>
        <tr><td><code>dormitory</code></td><td>宿舍楼</td><td class="num">10</td><td>MultiPolygon</td></tr>
        <tr><td><code>other_buildings</code></td><td>其他建筑</td><td class="num">11</td><td>MultiPolygon</td></tr>
        <tr><td><code>road</code></td><td>道路</td><td class="num">29</td><td>MultiLineString</td></tr>
        <tr><td><code>playground</code></td><td>操场</td><td class="num">2</td><td>MultiPolygon</td></tr>
        <tr><td><code>basketball_court</code></td><td>篮球场</td><td class="num">1</td><td>MultiPolygon</td></tr>
        <tr><td><code>tennis_court</code></td><td>网球场</td><td class="num">1</td><td>MultiPolygon</td></tr>
        <tr><td colspan="2"><b>合计</b></td><td class="num"><b>${N.features}</b></td><td>—</td></tr>
      </table>
      <p style="font-size:8.6pt;color:#5b6b7d">另含 6 张业务表（订单/餐厅/商品/无人机/航线/限飞区）
      与 2 张导航表：<code>drone_nav_node</code> ${N.navNodes} 点、<code>drone_nav_edge</code> ${N.navEdges} 边。</p>
    </div>
  </div>

  <h3>实测规模（可复现）</h3>
  <div class="kpi">
    <div><span class="n">${N.campusEW}×${N.campusNS}</span><span class="l">校园跨度（米）</span></div>
    <div><span class="n">${N.campusArea}</span><span class="l">校园面积（m²）</span></div>
    <div><span class="n">${N.buildings}</span><span class="l">建筑（栋）</span></div>
    <div><span class="n">${N.avgFloors}</span><span class="l">平均层数</span></div>
    <div><span class="n">${N.roadLen}</span><span class="l">道路总长（米）</span></div>
    <div><span class="n">${N.sridCols}</span><span class="l">空间列 SRID 一致</span></div>
  </div>
  <p style="font-size:8.6pt;color:#5b6b7d">
    验证：<code>SELECT COUNT(*) FROM &lt;table&gt;</code> 对每张表计数；<code>geometry_columns</code> 查 SRID（${N.sridCols} 列、1 种取值）；
    校园跨度用 <code>::geography</code> 算包围盒东西/南北向距离。</p>

  <div class="foot"><span>02 / 10</span><span>每一页都配一条可核对的证据，而不是形容词</span></div>
</section>`

const p3 = `
<section class="page">
  ${pageHead('03', '证据 ① 三维孪生与图层联动')}
  <div class="claim">
    Cesium 把 PostGIS 的多边形<em>按 height 字段拉成体块</em>：同一份空间数据，既能在三维里看体量，也能在二维里看拓扑。
  </div>
  <div class="shot">
    <div class="shot-wrap" style="height:130mm"><img src="${img('3d-view.jpg')}" alt="Cesium 三维场景"></div>
    <div class="cap">三维场景实拍：蓝色教学楼 / 绿色宿舍楼 / 橙色其他建筑 / 红色操场，黄色虚线为校园边界；左上是六个业务面板入口，底部工具栏提供测距、测面积、图层控制与一键定位</div>
  </div>

  <h3>实现要点</h3>
  <ul>
    <li><b>白模拉伸：</b>读建筑的 <code>height</code> 字段，按层高 3.5m 换算 <code>extrudedHeight</code>；用
      <code>GeoJsonDataSource</code> 批量加载 8 个图层，避免逐实体创建。</li>
    <li><b>点选弹窗（三级兜底）：</b><code>pickPosition</code> → <code>scene.pick</code> → 形心索引兜底，
      实体上部被地形/贴地面遮挡时依然能命中；点击处理器整体 try/catch——因为 Cesium 回调是 async，
      异常会变成未处理的 Promise rejection，表现为「有数据但弹窗不出现」。</li>
    <li><b>图层显隐：</b>左侧面板独立控制 8 个图层的显隐，避免一次性加载全部要素。</li>
    <li><b>踩过的坑：</b>拉伸体块不能用 <code>clampToGround:true</code>（贴地多边形走 GroundPrimitive，
      不支持 height/extrudedHeight），否则 Cesium 反复重建几何；描边另用贴地 polyline。</li>
  </ul>

  <h3>为什么这条重要</h3>
  <p>WebGIS 岗位的候选人里，会调地图组件的人很多，但能把「影像 → 矢量数据 → 属性建库 → 三维表达」整条链路走通的人很少。
  三维这层只是展示，真正决定它能不能上线的是数据与坐标系——见第 08、09 页。</p>

  <div class="foot"><span>03 / 10</span><span>截图命令：node scripts/dev/screenshot.mjs 3d-view</span></div>
</section>`

const p4 = `
<section class="page">
  ${pageHead('04', '证据 ② 二维一张图（MVT 矢量瓦片）')}
  <div class="claim">
    同一份数据换一种渲染口径：二维侧走 <em>ST_AsMVT 矢量瓦片</em>，一条瓦片 ${N.mvtBytes} B，
    而同样内容的全量 GeoJSON 是 ${(N.geojsonBytes / 1024).toFixed(1)} KB——差 ${(N.geojsonBytes / N.mvtBytes).toFixed(1)} 倍。
  </div>
  <div class="shot">
    <div class="shot-wrap" style="height:106mm"><img src="${img('map2d-mvt.jpg')}" alt="OpenLayers 二维一张图"></div>
    <div class="cap">OpenLayers 10 加载 8 个图层的 MVT 瓦片 + 底图（高德，与数据同属 GCJ-02 基准，零平移对齐）；
      蓝色圆形为「订单量按宿舍楼聚合」的簇</div>
  </div>

  <h3>实现要点</h3>
  <ul>
    <li><b>瓦片服务：</b><code>GET /tiles/{table}/{z}/{x}/{y}.mvt</code>，PostGIS
      <code>ST_AsMVTGeom</code> + <code>ST_AsMVT</code> 直接出 protobuf，前端
      <code>VectorTileSource(format: new MVT())</code> 按需拉取。</li>
    <li><b>索引命中：</b>瓦片包络在 3857 下算，几何列是 4326、GiST 也建在 4326 上。
      若直接拿 3857 包络比 4326 列，PostgreSQL 会隐式转换或干脆不用索引；正确写法是
      先 <code>ST_Transform(bounds, 4326)</code> 走 <code>&amp;&amp;</code> 预过滤命中索引，再在子查询里精确 <code>ST_Intersects</code>。</li>
    <li><b>图层元数据驱动：</b>前端图层配色/标签全部来自 <code>/api/spatial/layers</code>，新增一张空间表不用改前端。</li>
    <li><b>基准一致：</b>数据与底图同为 GCJ-02，所以叠加零偏移；这是第 08 页那次 109m 事故之后定下的硬约束。</li>
  </ul>

  <h3>体积对照（实测）</h3>
  <table>
    <tr><th>图层</th><th>单张 MVT 瓦片</th><th>全量 GeoJSON</th><th>倍数</th></tr>
    <tr><td>教学楼（7 个要素）</td><td class="num">${N.mvtBytes} B</td><td class="num">${N.geojsonBytes} B</td><td class="num">${(N.geojsonBytes / N.mvtBytes).toFixed(1)}×</td></tr>
    <tr><td>道路（29 条）</td><td class="num">646 B</td><td class="num">7424 B</td><td class="num">11.5×</td></tr>
  </table>
  <p style="font-size:8.6pt;color:#5b6b7d">验证：<code>curl -s -o /dev/null -w '%{size_download}' /tiles/teaching_building/16/53606/25282.mvt</code>；
  GeoJSON 侧为 <code>/api/spatial/geojson/teaching_building</code> 的响应体大小。</p>

  <div class="foot"><span>04 / 10</span><span>截图命令：node scripts/dev/screenshot.mjs map2d-mvt</span></div>
</section>`

const p5 = `
<section class="page">
  ${pageHead('05', '证据 ③ 空间查询与点位聚合')}
  <div class="claim">
    查询全部交给数据库：点选走 <code>ST_Intersects</code>，缓冲区走 <code>ST_DWithin(::geography)</code>
    ——<em>以米为单位</em>，不是「度」；前端只负责把结果画出来。
  </div>
  <div class="shot">
    <div class="shot-wrap" style="height:114mm"><img src="${img('map2d-cluster.jpg')}" alt="缓冲区查询与点位聚合"></div>
    <div class="cap">界面实拍：180m 缓冲区查询命中 4 栋宿舍楼（1/2/3/4 号），蓝色为命中多边形，虚线圆为缓冲范围；
      右侧面板同时给出聚合统计（10 栋宿舍楼 / 200 单）</div>
  </div>

  <h3>实现要点</h3>
  <ul>
    <li><b>点选：</b>点击坐标 → <code>GET /api/spatial/point-query?table=&amp;lng=&amp;lat=</code> →
      依次尝试各图层，命中即返回要素属性（名称 / 层数 / 院系）。</li>
    <li><b>缓冲区：</b><code>GET /api/spatial/buffer?...&amp;radius=180</code>，SQL 侧用
      <code>ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(?),4326)::geography, radius)</code>；
      半径上限在 Controller 里显式校验，避免一次查询把整表 geography 计算拉满。</li>
    <li><b>点位聚合：</b>宿舍楼质心 + 订单量作为聚合值，用 OpenLayers <code>Cluster</code> 源，
      聚合距离 70px；缩放到不同层级时簇自动拆分/合并（当前 10 个点 → 6 个簇）。</li>
    <li><b>动态表名的安全处理：</b>表名来自前端，属动态 SQL；后端用白名单只允许 8 张空间表通过，
      并为此单独写了单测，从根上规避注入。</li>
  </ul>

  <h3>为什么这条重要</h3>
  <p>「前端能不能点、数据库能不能算」是两件事。把判定放在数据库里，前端只做表现，
  才能在数据量涨上来之后仍然可控；这也是我把 8 张空间表都建 GiST 索引的原因。</p>

  <div class="foot"><span>05 / 10</span><span>截图命令：node scripts/dev/screenshot.mjs map2d-cluster</span></div>
</section>`

const p6 = `
<section class="page">
  ${pageHead('06', '证据 ④ A* 航线：避让的代价可量化')}
  <div class="claim">
    固定起终点（4 号教学楼北侧 → 3 号教学楼南侧）：直线 ${N.straightM} m <em>穿越 2 个限飞区</em>；
    A* 规划 ${N.planM} m，绕行 <em>+${N.detourM} m（+${N.detourPct}%）</em>，穿越判决 true → false。
  </div>
  <div class="shot">
    <div class="shot-wrap" style="height:80mm"><img src="${img('map2d-route.jpg')}" alt="A* 航线对照"></div>
    <div class="cap">红色虚线＝起终点直线（穿越 4 号、3 号教学楼），绿色实线＝pgr_astar 在 15m 导航网格上求出的规划路径；
      右侧面板给出距离、绕行增量、途经点数、预计时长与穿越判决</div>
  </div>

  <h3>三步把「禁飞」真正落进图里</h3>
  <table>
    <tr><th>层级</th><th>做法</th><th>解决的问题</th></tr>
    <tr><td class="k">节点级</td><td>节点带 5m 安全缓冲判定，落入缓冲区内即标记不可飞</td><td>保证起终点与途经点本身不在禁飞范围</td></tr>
    <tr><td class="k">边级过滤</td><td>源-目标线段穿越限飞区（含缓冲）则不建这条边</td><td>网格粒度会漏掉「两端点都在区外、但连线穿过限飞区」的情况</td></tr>
    <tr><td class="k">成本惩罚</td><td>距限飞区 15m 内的边按距离比例抬高 <code>cost</code>（软约束）</td><td>防止航线贴着限飞区边缘飞（最短路径在数学上总是贴边）</td></tr>
  </table>

  <h3>为什么是两级而不是一级</h3>
  <p>只做硬过滤，航线会紧贴禁飞边界；只做成本惩罚，无法排除真正穿越禁飞的边。硬过滤保证安全，软惩罚留出安全余量——
  这也是我把它叫做「三级避让」而不是「绕行」的原因。</p>

  <h3>可复现</h3>
  <pre><span class="c"># 导航网格规模（实测）</span>
SELECT count(*) FROM drone_nav_node;   <span class="g">-- ${N.navNodes}</span>
SELECT count(*) FROM drone_nav_edge;   <span class="g">-- ${N.navEdges}</span>

<span class="c"># 固定起终点规划一次（坐标见 frontend/src/components/AnalysisView.vue 的 DEMO_ROUTE）</span>
POST /api/route/plan  {start_lng: 114.46651, start_lat: 37.9841,
                       end_lng: 114.466646, end_lat: 37.983, altitude: 50}
<span class="g">-- straight_distance_m ${N.straightM} / distance_m ${N.planM} / detour_m +${N.detourM}</span>
<span class="g">-- waypoints_count ${N.waypoints} / estimated_seconds ${N.etaS} / avoided_no_fly_zone true</span></pre>

  <div class="foot"><span>06 / 10</span><span>截图命令：node scripts/dev/screenshot.mjs map2d-route</span></div>
</section>`

const p7 = `
<section class="page">
  ${pageHead('07', '证据 ⑤ 运营大屏（ECharts）')}
  <div class="claim">
    6 个 KPI + 5 张图，<em>没有一个数字是写死的</em>：全部来自 <code>/api/order/stats</code>、
    <code>/api/drone/stats</code>、<code>/api/stat/overview</code>、<code>/api/spatial/layers</code> 与一次真实航线规划。
  </div>
  <div class="shot">
    <div class="shot-wrap" style="height:114mm"><img src="${img('dashboard.jpg')}" alt="运营大屏"></div>
    <div class="cap">大屏实拍（累计口径）：累计 ${N.orders.toLocaleString()} 单 / 已送达 ${N.delivered.toLocaleString()} / 已取消 ${N.cancelled} /
      完单率 99.9% / 平均 ${N.avgMinutes} 分钟 / 机队 ${N.drones} 架平均电量 ${N.droneBattery}%</div>
  </div>

  <h3>口径与取舍</h3>
  <ul>
    <li><b>「今日」与「累计」必须分开标：</b>面板顶部四个卡片取的是 <code>today_*</code> 字段，
      下方状态分布是累计口径。两者同名不同值，注释里也写明了——这类「看起来对、其实混了口径」的问题，
      在数据看板里比在代码里更难发现。</li>
    <li><b>0 是合法值：</b>取值用 <code>??</code> 不用 <code>||</code>，否则 0 会显示成「-」。</li>
    <li><b>航线对照图复用同一接口：</b>大屏里的「直线 vs 规划」用的就是第 06 页那次规划，口径一致、不会出现两个版本的数字。</li>
    <li><b>数据资产图：</b>读 <code>/api/spatial/layers</code> 的 <code>count</code>，等于把「62 个要素」这个说法变成了页面上的可核对图表。</li>
    <li><b>订单是模拟生成的，但链路是真的：</b>订单由项目内的「自动补单」调度器每 30 秒生成一单（约 1100 单/天），
      落的是真实表结构、真实订单状态机、真实派单与 A* 航线规划——不是预先导好的假 CSV。
      演示/录屏时用 <code>?present=1</code> 会把生成器关掉，避免数字在镜头里继续涨。</li>
  </ul>

  <div class="kpi">
    <div><span class="n">${N.orders.toLocaleString()}</span><span class="l">累计订单</span></div>
    <div><span class="n">99.9%</span><span class="l">完单率</span></div>
    <div><span class="n">${N.avgMinutes}</span><span class="l">平均配送（分钟）</span></div>
    <div><span class="n">${N.drones}</span><span class="l">无人机（架）</span></div>
    <div><span class="n">${N.droneBattery}%</span><span class="l">平均电量</span></div>
  </div>

  <div class="foot"><span>07 / 10</span><span>截图命令：node scripts/dev/screenshot.mjs dashboard</span></div>
</section>`

const p8 = `
<section class="page">
  ${pageHead('08', '坐标系核查：.prj 写 WGS84，数据其实是 GCJ-02')}
  <div class="claim">
    Shapefile 的 <code>.prj</code> 标注 <code>GCS_WGS_1984</code>，但数据实际是高德 GCJ-02 采集：
    <em>合成偏移 ${N.offsetTotal} m</em>（北 ${N.offsetNorth} m / 东 ${N.offsetEast} m）。
  </div>

  <h3>怎么发现的</h3>
  <p>建筑点选后，弹窗位置与影像上的楼体对不上；但不是所有图层都错——<b>图层之间彼此吻合</b>。
  这正是最危险的一种错：所有图层被同样平移后，它们彼此的相对关系完全正确，只在叠加底图时暴露。</p>

  <h3>验证会话（可直接重跑）</h3>
  <pre><span class="c">-- 1) 声明 SRID 是否统一：geometry_columns 是 PostGIS 元数据视图</span>
SELECT COUNT(*) AS cols, COUNT(DISTINCT srid) AS srids
FROM geometry_columns;                <span class="g">-- ${N.sridCols} 列 / 1 种取值（4326）</span>

<span class="c">-- 2) 数据是不是真经纬度 + 校园尺度是否合理</span>
<span class="c">--    若是投影坐标，数值会是六位数（约 500000 / 4000000）</span>
SELECT round(ST_Distance(...)::numeric, 1) FROM (SELECT ST_Union(geom) g FROM school) s;
<span class="g">-- 东西 ${N.campusEW} m × 南北 ${N.campusNS} m，面积 ${N.campusArea} m²，边界 17 个顶点</span>

<span class="c">-- 3) 与 WGS84 底图实测偏差：换算成局部 ENU 后对比</span>
<span class="g">-- 北向 ${N.offsetNorth} m，东向 ${N.offsetEast} m，合成 ${N.offsetTotal} m（Java 与 PostGIS 双向复算一致）</span></pre>

  <h3>结论与硬约束</h3>
  <ul>
    <li><b>不入库时「修正」坐标：</b>入库统一标注 SRID 4326（保持数据原样），叠加底图选择同基准的高德影像，
      前端坐标平移量恒为 0——而不是把数据 WGS84 化后再去凑底图。</li>
    <li><b>图层一致 ≠ 整体正确：</b>这条写进了仓库的「关键实现约束」，作为后续接新数据的检查项。</li>
    <li><b>为什么不用 <code>ST_SetSRID</code> 强行改：</b>那只是改元数据声明，不移动任何坐标，
      会把这个 109m 的偏移隐藏起来，比不修更危险。</li>
  </ul>

  <h3>三种基准在本校园的实测差异</h3>
  <table>
    <tr><th>基准</th><th>典型来源</th><th>与本校数据的偏差</th><th>本项目中的处理</th></tr>
    <tr><td class="k">GCJ-02</td><td>高德 / 腾讯地图、国内采集的 .shp</td><td class="num">0 m（同基准）</td><td>数据原样入库；底图选高德，前端平移量 0</td></tr>
    <tr><td class="k">WGS84</td><td>天地图、GPS 原始观测、多数开源底图</td><td class="num">约 ${N.offsetTotal} m</td><td>仅用于入库声明（SRID 4326）；不据此平移数据</td></tr>
    <tr><td class="k">Web Mercator</td><td>瓦片服务（3857）</td><td class="num">投影差，随纬度变化</td><td>只在生成 MVT 瓦片时临时变换，库里不落投影坐标</td></tr>
  </table>

  <pre><span class="c">// 偏移量复算（Java 与 PostGIS 双向一致）：GCJ-02 相对 WGS84 在本校园的位移</span>
北向偏移 = <span class="r">${N.offsetNorth} m</span>
东向偏移 = <span class="r">${N.offsetEast} m</span>
合成偏移 = <span class="r">${N.offsetTotal} m</span>     <span class="c">// 与影像底图上的实测错位量吻合</span></pre>
  <div class="foot"><span>08 / 10</span><span>验证脚本：docs/sql/04_verify_data.sql</span></div>
</section>`

const p9 = `
<section class="page">
  ${pageHead('09', '我踩过的最大的坑：把数据问题修成了底图问题')}
  <div class="claim">
    同一个 109m 偏移，我先把它归因成「底图基准不对」，换底图之后偏移立刻出现——<em>那个偏移是我自己造成的</em>。
  </div>

  <div class="steps">
    <div class="step">
      <span class="t">① 现象</span>
      三维场景里建筑与影像底图错位约一百米；但建筑之间的相对位置、道路与楼的关系都是对的。
    </div>
    <div class="step bad">
      <span class="t">② 我的错误判断</span>
      「数据是 WGS84，高德底图是 GCJ-02，所以底图偏了」——于是把底图换成天地图（WGS84），
      并按「偏差」给前端加了一个平移量。
    </div>
    <div class="step bad">
      <span class="t">③ 代价</span>
      换底图后偏移<strong>没有消失</strong>，反而从「贴不齐」变成「稳定偏 ${N.offsetTotal} m」：
      数据与高德底图本来就同属 GCJ-02、原本零偏移，被我拆散了。
    </div>
    <div class="step good">
      <span class="t">④ 根因</span>
      读 <code>.prj</code> 得到的 <code>GCS_WGS_1984</code> 是<strong>声明</strong>，不是事实。
      用 PostGIS/Java 双向复算 GCJ-02 与 WGS84 的差异，得到北 ${N.offsetNorth} m / 东 ${N.offsetEast} m，
      合成 ${N.offsetTotal} m——与实测错位量吻合，才定位到「数据本身就是 GCJ-02」。
    </div>
  </div>

  <h3>修法与结果</h3>
  <ul>
    <li>底图回到高德（与数据同基准），前端平移量删掉，恒为 0；实测叠加误差回到像素级。</li>
    <li>把这条写进仓库约束：「<code>.prj</code> 不可全信；图层彼此吻合只能证明图层间一致，不能证明整体坐标系正确」。</li>
    <li>新增一条自查：任何新图层入库前，先跑 <code>geometry_columns</code> 的 SRID 一致性与包围盒尺度检查。</li>
  </ul>

  <h3>这件事教会我什么</h3>
  <p><b>先证伪，再动手。</b>我当时手里已经有两个互相矛盾的事实（图层间吻合 vs 与底图不吻合），
  却先选了「改底图」这条成本更高的路。正确顺序应该是：先做最小可复现实验（同一栋楼在两种底图下的偏移量），
  再决定改数据还是改底图。<span class="hl">现在这个项目的每个结论后面都跟着一个可重跑的验证方法，就是从这次事故开始的。</span></p>

  <p style="font-size:8.6pt;color:#5b6b7d">
    同类的第二个坑：测面积用变换矩阵的<strong>列向量</strong>做点积（列主序混淆），
    100m 的边被量成 72m / 138m、面积偏差 5.6%；改用 ENU 逆矩阵投影后偏差 &lt; 0.01%。两者是同一个毛病的两面：<b>对「看起来对」的中间量缺少验证</b>。</p>

  <h3>如果重来一次，我的决策顺序</h3>
  <div class="steps">
    <div class="step good">
      <span class="t">① 先做最小复现</span>
      同一栋楼，在高德与天地图底图下各取一次顶点坐标差——五分钟就能拿到「偏移随底图变化还是恒定」这个关键判据。
    </div>
    <div class="step good">
      <span class="t">② 再问数据本身</span>
      用 <code>::geography</code> 校验包围盒尺度是否合理（若为投影坐标，数值会是六位数），确认「是不是真经纬度」。
    </div>
    <div class="step good">
      <span class="t">③ 最后才动代码</span>
      偏移若恒定 → 数据基准问题；偏移随底图变 → 底图问题。判据先于改法，避免又一次改错方向。
    </div>
  </div>

  <h3>同一毛病的第二个现场：面积量算</h3>
  <table>
    <tr><th>环节</th><th>错误实现</th><th>实测症状</th><th>修正</th></tr>
    <tr><td class="k">局部坐标</td><td>拿 <code>eastNorthUpToFixedFrame</code> 返回矩阵的<b>列向量</b>做点积取局部坐标（列主序混淆，拼出来的是混合量）</td><td>100 m 的边量成 72 m / 138 m，一条短一条长，面积偏差 <b>5.6%</b></td><td>改用 <code>Matrix4.inverse</code> 把点变到局部 ENU 系，偏差 <b>&lt; 0.01%</b></td></tr>
  </table>
  <p style="font-size:8.6pt;color:#5b6b7d">两个坑的共同点不是「不会写」，而是<b>接受了没有验证过的中间量</b>。所以现在每个关键数字后面都跟着一条可重跑的验证方法（见第 06、08 页）。</p>
  <div class="foot"><span>09 / 10</span><span>相关记录：docs/bug-records/（BUG-01~03 缺陷档案）· README「关键实现约束」</span></div>
</section>`

const p10 = `
<section class="page">
  ${pageHead('10', '质量保障 · 已知取舍 · 后续迭代')}
  <div class="claim">
    <em>${N.tests} 个后端单元测试 + ${N.scripts} 个前端校验脚本</em>：守的不是「有没有编译过」，
    而是那些<em>能编译、能启动、只在运行时炸</em>的三维开发问题。
  </div>

  <div class="cols">
    <div>
      <h3>后端单元测试（51）</h3>
      <table>
        <tr><th>测试类</th><th>@Test</th></tr>
        <tr><td><code>OrderServiceImplTest</code></td><td class="num">18</td></tr>
        <tr><td><code>RouteServiceImplTest</code></td><td class="num">13</td></tr>
        <tr><td><code>GeoMathTest</code></td><td class="num">8</td></tr>
        <tr><td><code>GeoJsonSupportTest</code></td><td class="num">6</td></tr>
        <tr><td><code>SpatialServiceImplTest</code></td><td class="num">6</td></tr>
      </table>
      <p style="font-size:8.6pt;color:#5b6b7d">覆盖距离口径、GeoJSON 解析、订单状态机、航线规划、表名白名单等关键路径。</p>
    </div>
    <div>
      <h3>前端校验脚本（6）</h3>
      <table>
        <tr><th>脚本</th><th>守什么</th></tr>
        <tr><td><code>verify-cesium-reactivity</code></td><td>Cesium 对象不得进 Vue 响应式</td></tr>
        <tr><td><code>verify-cesium-api-usage</code></td><td>Cesium API 跨版本改名</td></tr>
        <tr><td><code>verify-cesium-behavior</code></td><td>点选/形心兜底行为</td></tr>
        <tr><td><code>verify-popup-position</code></td><td>弹窗定位</td></tr>
        <tr><td><code>verify-building-outlines</code></td><td>拉伸体描边</td></tr>
        <tr><td><code>verify-frontend</code></td><td>组件约定与响应式使用</td></tr>
      </table>
    </div>
  </div>

  <h3>三个「只在运行时炸」的例子</h3>
  <table>
    <tr><th>问题</th><th>根因</th><th>防护</th></tr>
    <tr><td>Cesium 对象进 Vue 响应式</td><td>几何构建走 Web Worker，<code>postMessage</code> 含 Proxy 时结构化克隆抛
      <code>DataCloneError</code>，渲染循环直接停</td><td>持有 Cesium 实例的状态统一 <code>shallowRef/shallowReactive</code> + 脚本校验</td></tr>
    <tr><td>Cesium API 改名</td><td><code>wgs84ToWindowCoordinates</code> → <code>worldToWindowCoordinates</code>，旧写法语法合法、运行时 TypeError</td><td>兼容封装（新名 → 旧名 → null）+ 调用点校验</td></tr>
    <tr><td>布尔属性当方法调用</td><td><code>isLoading?.()</code> 对「存在但不是函数」照样调用；回调是 async，异常静默变成未处理 rejection</td><td>处理器整体 try/catch + 属性用法校验</td></tr>
  </table>

  <h3>已知取舍</h3>
  <ul>
    <li><b>规模：</b>单校区、62 个要素，是为「能自己造数据」而不是「造大数据」；城市级会先死在导航网格规模与瓦片缓存上。</li>
    <li><b>仿真：</b>无人机位置按航线插值推进，不是真实飞控遥测；接入真机需换成遥测上报 + 任务下发协议。</li>
    <li><b>部署：</b>目前是本地一键启动（<code>docker-compose.yml</code>），未做公网高可用。</li>
  </ul>

  <h3>接下来想做的事</h3>
  <p>倾斜摄影 OSGB / BIM glb 替换白模表达 · 导航网格升到 5m 并支持限飞区热更新 ·
  消防疏散与日照阴影模拟 · 城市级瓦片与导航网格的性能压测。</p>

  <div class="links" style="margin-top:3mm">
    源码：<span>${REPO}</span>　｜　技术展示：<span>${SHOWCASE}</span>
  </div>

  <div class="foot"><span>10 / 10</span><span>闫孜昊 · 17303105475 · ace9991@foxmail.com</span></div>
</section>`

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>WebGIS 开发作品集 · 闫孜昊</title>
<style>${CSS}</style>
</head>
<body>
${cover}
${p2}
${p3}
${p4}
${p5}
${p6}
${p7}
${p8}
${p9}
${p10}
</body>
</html>
`

fs.mkdirSync(tmp, { recursive: true })
fs.writeFileSync(OUT_HTML, html, 'utf8')
console.log(`HTML  ${path.relative(root, OUT_HTML)}  (${(html.length / 1024 / 1024).toFixed(1)} MB, 10 页)`)

/* ------------------------------ 打印 PDF ------------------------------ */
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-pdf-'))
const args = [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  `--user-data-dir=${profile}`,
  '--no-pdf-header-footer',
  '--print-to-pdf-no-header',
  '--virtual-time-budget=20000',
  `--print-to-pdf=${OUT_PDF}`,
  pathToFileURL(OUT_HTML).href,
]
await new Promise((resolve, reject) => {
  const p = spawn(EDGE, args, { stdio: 'ignore' })
  p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Edge 打印失败，退出码 ${code}`))))
  p.on('error', reject)
})
if (!fs.existsSync(OUT_PDF)) throw new Error('PDF 未生成')
const kb = fs.statSync(OUT_PDF).size / 1024
console.log(`PDF   ${path.relative(root, OUT_PDF)}  (${kb.toFixed(0)} KB)`)
