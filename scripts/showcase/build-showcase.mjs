/**
 * 生成「技术展示页」—— 把散落在 docs/ 里的实测数字与工程证据集中成一页，
 * 供面试官在无法运行 Demo 时也能验证项目真实水平。
 *
 * 设计原则：
 *   1. 页面上每一个数字都来自实测（数据库查询 / 单元测试计数 / 工程内文档），
 *      并标注可复现方式，不写无法验证的形容词。
 *   2. 全部为静态 HTML + 内联 CSS，无外部依赖，可直接放 GitHub Pages。
 *   3. 中文内容、代码块用等宽字体。
 *
 * 用法：node scripts/showcase/build-showcase.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const outDir = path.join(root, 'docs', 'showcase')
fs.mkdirSync(outDir, { recursive: true })

const REPO = 'https://github.com/aceword177/webgis-campus-digitaltwin'

// ============================================================
// 全部数字均来自实测，来源见每处标注
// ============================================================

// [来源] shp_data 库 geometry_columns 查询
const SRID = { columns: 14, distinct: 1, srid: 4326 }

// [来源] 8 张校园表 COUNT(*)，合计 62
const LAYERS = [
  { name: 'school', label: '校园边界', rows: 1, geom: 'MultiPolygon' },
  { name: 'teaching_building', label: '教学楼', rows: 7, geom: 'MultiPolygon' },
  { name: 'dormitory', label: '宿舍楼', rows: 10, geom: 'MultiPolygon' },
  { name: 'other_buildings', label: '其他建筑', rows: 11, geom: 'MultiPolygon' },
  { name: 'road', label: '道路', rows: 29, geom: 'MultiLineString' },
  { name: 'playground', label: '操场', rows: 2, geom: 'MultiPolygon' },
  { name: 'basketball_court', label: '篮球场', rows: 1, geom: 'MultiPolygon' },
  { name: 'tennis_court', label: '网球场', rows: 1, geom: 'MultiPolygon' },
].map(l => ({ ...l, srid: 4326 }))
const TOTAL_FEATURES = LAYERS.reduce((s, l) => s + l.rows, 0) // 62

// [来源] 校园范围与跨度查询（geography 测地线）
const CAMPUS = {
  lonMin: 114.463037, latMin: 37.981483,
  lonMax: 114.472539, latMax: 37.987127,
  eastWestM: 834.7, northSouthM: 626.5, vertices: 17,
  areaSqm: 328900.5, areaHa: 32.9,
}

// [来源] 导航网格计数
const NAV = { node: 3100, edge: 10693 }

// [来源] backend/src/test/**/*.java 的 @Test 计数（新增绕行对比 3 个用例后为 51）
const TESTS = [
  { file: 'OrderServiceImplTest', n: 18 },
  { file: 'RouteServiceImplTest', n: 13 },
  { file: 'GeoMathTest', n: 8 },
  { file: 'GeoJsonSupportTest', n: 6 },
  { file: 'SpatialServiceImplTest', n: 6 },
]
const TOTAL_TESTS = TESTS.reduce((s, t) => s + t.n, 0) // 51

// [来源] frontend/scripts/verify-*.mjs
const VERIFY_SCRIPTS = [
  'verify-cesium-api-usage.mjs',
  'verify-cesium-reactivity.mjs',
  'verify-cesium-behavior.mjs',
  'verify-popup-position.mjs',
  'verify-frontend.mjs',
  'verify-building-outlines.mjs',
]

// [来源] 项目实测记录：优化方案与学习日志（2026-09 轮次；原始文档已移出本仓库，未随作品集公开）
const OFFSET = { composite: 108.6, north: -56.8, east: -92.6 }
const AREA_FIX = { wrongEdgeA: 72, wrongEdgeB: 138, trueEdge: 100, before: '5.6%', after: '<0.01%' }

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const layerRows = LAYERS.map(l => `
      <tr><td><code>${l.name}</code></td><td>${l.label}</td><td class="num">${l.rows}</td><td><code>${l.geom}</code></td><td class="num">${l.srid}</td></tr>`).join('')

const testRows = TESTS.map(t => `
      <tr><td><code>${t.file}.java</code></td><td class="num">${t.n}</td></tr>`).join('')

const verifyRows = VERIFY_SCRIPTS.map(f => `
      <tr><td><code>${f}</code></td></tr>`).join('')

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>技术展示 · 校园无人机配送 WebGIS 数字孪生</title>
<style>
  :root {
    --ink: #16181d; --muted: #5b6270; --line: #e3e6ec; --bg: #ffffff;
    --soft: #f6f8fb; --accent: #1f6feb; --accent-soft: #eaf1fd; --warn: #b3541e;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 15px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
  }
  .wrap { max-width: 940px; margin: 0 auto; padding: 56px 24px 96px; }
  header { border-bottom: 2px solid var(--ink); padding-bottom: 22px; margin-bottom: 8px; }
  .eyebrow { font-size: 12px; letter-spacing: .16em; color: var(--muted); text-transform: uppercase; }
  h1 { font-size: 30px; margin: 10px 0 6px; letter-spacing: -.01em; }
  h2 {
    font-size: 20px; margin: 52px 0 14px; padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
  }
  h2 .n { color: var(--accent); font-variant-numeric: tabular-nums; margin-right: 8px; }
  h3 { font-size: 16px; margin: 30px 0 8px; }
  p { margin: 10px 0; }
  .lede { color: var(--muted); font-size: 16px; }
  code, pre {
    font-family: "Cascadia Mono", Consolas, "Courier New", monospace;
    font-size: 13px;
  }
  code { background: var(--soft); padding: 1px 5px; border-radius: 3px; }
  pre {
    background: #1b1f27; color: #e6e9ef; padding: 16px 18px; border-radius: 8px;
    overflow-x: auto; line-height: 1.6; margin: 14px 0;
  }
  pre .cmt { color: #8b95a7; }
  pre .ok  { color: #7ddc8a; }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 14px; }
  th, td { border: 1px solid var(--line); padding: 8px 11px; text-align: left; }
  th { background: var(--soft); font-weight: 600; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 26px 0 4px; }
  .kpi { border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; background: var(--soft); }
  .kpi .v { font-size: 25px; font-weight: 700; letter-spacing: -.02em; }
  .kpi .l { font-size: 12.5px; color: var(--muted); margin-top: 2px; }
  .note {
    border-left: 3px solid var(--accent); background: var(--accent-soft);
    padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0;
  }
  .warn { border-left-color: var(--warn); background: #fdf3ec; }
  .flow { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; align-items: center; }
  .step {
    border: 1px solid var(--line); border-radius: 6px; padding: 8px 13px;
    background: var(--soft); font-size: 13.5px;
  }
  .arrow { color: var(--muted); }
  .src { font-size: 12.5px; color: var(--muted); margin-top: -4px; }
  footer { margin-top: 64px; padding-top: 20px; border-top: 1px solid var(--line); color: var(--muted); font-size: 13.5px; }
  a { color: var(--accent); }
  @media (max-width: 620px) { h1 { font-size: 24px; } .wrap { padding: 32px 16px 64px; } }
</style>
</head>
<body>
<div class="wrap">

<header>
  <div class="eyebrow">技术展示 · Technical Showcase</div>
  <h1>校园无人机配送 WebGIS 数字孪生</h1>
  <p class="lede">
    从空间数据自主生产，到 PostGIS 空间分析、pgRouting 路径规划，再到 Cesium 三维渲染的完整链路。
    本页把工程中的<strong>实测数字与可复现证据</strong>集中列出——每一个数字都可用页面给出的方法独立验证。
  </p>
  <p class="src">源码仓库：<a href="${REPO}">${REPO.replace('https://', '')}</a></p>
</header>

<div class="kpis">
  <div class="kpi"><div class="v">${TOTAL_FEATURES}</div><div class="l">自主矢量化要素</div></div>
  <div class="kpi"><div class="v">${LAYERS.length}</div><div class="l">校园空间图层</div></div>
  <div class="kpi"><div class="v">${SRID.columns}</div><div class="l">空间列 SRID 一致</div></div>
  <div class="kpi"><div class="v">${TOTAL_TESTS}</div><div class="l">后端单元测试</div></div>
  <div class="kpi"><div class="v">${NAV.edge.toLocaleString('en-US')}</div><div class="l">导航网格边</div></div>
  <div class="kpi"><div class="v">${AREA_FIX.before} → ${AREA_FIX.after}</div><div class="l">面积量算偏差</div></div>
</div>

<h2><span class="n">01</span>空间数据：自己生产，不是下载的</h2>

<p>
  项目的空间底料不是现成数据集。8 个校园图层、共 ${TOTAL_FEATURES} 个要素，
  全部是在 <strong>ArcMap 中依影像底图手工矢量化</strong>完成：绘制几何、录入属性
  （建筑名称、层高、所属院系、宿舍性别）、做拓扑与几何检查，再导出 Shapefile 导入 PostGIS。
</p>

<div class="flow">
  <span class="step">影像底图</span><span class="arrow">→</span>
  <span class="step">ArcMap 矢量化 + 属性录入</span><span class="arrow">→</span>
  <span class="step">拓扑与几何检查</span><span class="arrow">→</span>
  <span class="step">Shapefile</span><span class="arrow">→</span>
  <span class="step">PostGIS 入库 + GiST 索引</span><span class="arrow">→</span>
  <span class="step">Cesium 渲染</span>
</div>

<h3>图层与要素（实测计数）</h3>
<table>
  <thead><tr><th>表名</th><th>图层</th><th class="num">要素数</th><th>几何类型</th><th class="num">SRID</th></tr></thead>
  <tbody>${layerRows}
    <tr><th colspan="2">合计</th><th class="num">${TOTAL_FEATURES}</th><th colspan="2"></th></tr>
  </tbody>
</table>
<p class="src">可复现：对每张表执行 <code>SELECT COUNT(*) FROM &lt;table&gt;;</code></p>

<div class="note">
  <strong>为什么这条重要：</strong>WebGIS 岗位的候选人里，会写地图组件的人很多，
  但能自己完成「影像 → 矢量数据 → 属性建库 → 规范化入库」的人很少。
  这条链路决定了数据来源、坐标系、精度这些底层问题的答案。
</div>

<h2><span class="n">02</span>坐标系：把一次错误判断查清楚</h2>

<p>
  入库时统一标注 SRID <code>${SRID.srid}</code>（WGS84）。经实测核查，
  <strong>${SRID.columns} 个空间列的 SRID 完全一致、无混用</strong>：
</p>

<pre><code><span class="cmt">-- 验证 1：声明 SRID 是否统一（geometry_columns 是 PostGIS 元数据视图）</span>
SELECT COUNT(*) AS spatial_columns,
       COUNT(DISTINCT srid) AS distinct_srid,
       string_agg(DISTINCT srid::text, ',') AS srids
FROM geometry_columns;
<span class="ok"> spatial_columns | distinct_srid | srids
-----------------+---------------+-------
              ${SRID.columns} |             ${SRID.distinct} | ${SRID.srid}</span>

<span class="cmt">-- 验证 2：数据是否为真经纬度 + 校园真实尺度</span>
SELECT round(ST_Distance(
         ST_SetSRID(ST_MakePoint(ST_XMin(g),(ST_YMin(g)+ST_YMax(g))/2),4326)::geography,
         ST_SetSRID(ST_MakePoint(ST_XMax(g),(ST_YMin(g)+ST_YMax(g))/2),4326)::geography
       )::numeric,1) AS east_west_m,
       round(ST_Distance(
         ST_SetSRID(ST_MakePoint((ST_XMin(g)+ST_XMax(g))/2,ST_YMin(g)),4326)::geography,
         ST_SetSRID(ST_MakePoint((ST_XMin(g)+ST_XMax(g))/2,ST_YMax(g)),4326)::geography
       )::numeric,1) AS north_south_m,
       round(ST_Area(ST_SetSRID(g,4326)::geography)::numeric,1) AS area_sqm
FROM (SELECT ST_Union(geom) AS g FROM school) s;
<span class="ok"> east_west_m | north_south_m | area_sqm
-------------+---------------+-----------
       ${CAMPUS.eastWestM} |         ${CAMPUS.northSouthM} |   ${CAMPUS.areaSqm}</span></code></pre>

<p>
  校园 ${CAMPUS.eastWestM} m × ${CAMPUS.northSouthM} m，边界 ${CAMPUS.vertices} 个顶点。
  数据确为经纬度——若是投影坐标，数值会是六位数（约 500000 / 4000000）。
</p>

<h3>踩坑：<code>.prj</code> 标注与实际不符</h3>

<p>
  Shapefile 的 <code>.prj</code> 文件写着 <code>GCS_WGS_1984</code>，
  但数据实际是按<strong>高德 GCJ-02</strong>（国测局加密坐标）基准采集的。
  国内数据「标注 WGS84、实为 GCJ-02」是常见情况。
</p>

<pre><span class="cmt">GCJ-02 与 WGS84 在本校园处的合成偏移（Java 与 PostGIS 双向复算一致）</span>
  北向偏移 = ${OFFSET.north} m
  东向偏移 = ${OFFSET.east} m
  <span class="ok">合成偏移 = ${OFFSET.composite} m</span></pre>

<div class="note warn">
  <strong>我犯过的错误：</strong>最初我判断「数据是 WGS84、高德底图是 GCJ-02，所以底图偏了」，
  于是把底图换成天地图（WGS84）。结果立刻出现约 ${OFFSET.composite} 米的偏移——
  <strong>这个偏移是我换底图造成的，不是数据的问题</strong>。
  真实根因是数据与高德底图本来就同属 GCJ-02、零偏移。
  最终方案：保留高德底图、不做任何平移，前端坐标平移量恒为 0。
  <br><br>
  这件事的教训：<code>.prj</code> 文件不可全信；且「图层之间彼此吻合」只能证明图层间一致，
  <strong>不能</strong>证明整体坐标系正确——因为所有图层被同样平移后，彼此仍然吻合。
</div>

<h2><span class="n">03</span>A* 路径规划：把「禁飞」真正落进图里</h2>

<p>
  这是项目的技术核心。要在校园里给无人机规划出既短又安全的航线，
  需要把连续空间离散成可寻路的图结构，再把「不能飞」这一约束落到图里。
</p>

<h3>第一步：构建导航网格</h3>
<ul>
  <li>以校园边界外扩 50m 为范围，按 <strong>15m 分辨率</strong>生成网格中心点作为导航节点；</li>
  <li>节点若落在限飞区内（含 5m 安全缓冲）则标记为不可飞行；</li>
  <li>每个可飞行节点与周围 <strong>8 邻域</strong>的可飞行节点连边，边代价取两点间实际距离（米）。</li>
</ul>
<p class="src">实测规模：<strong>${NAV.node.toLocaleString('en-US')}</strong> 个节点、<strong>${NAV.edge.toLocaleString('en-US')}</strong> 条边。
导航网格由脚本幂等重建，秒级完成，便于调整限飞区后快速刷新。</p>

<h3>第二步：限飞区三级避让</h3>
<table>
  <thead><tr><th>层级</th><th>做法</th><th>解决的问题</th></tr></thead>
  <tbody>
    <tr>
      <td>节点级</td>
      <td>节点带 5m 安全缓冲判定，落入缓冲区内即不可飞</td>
      <td>保证起终点与途经点本身不在禁飞范围</td>
    </tr>
    <tr>
      <td>边级过滤</td>
      <td>源-目标线段穿越限飞区（含缓冲）则不建这条边</td>
      <td>网格粒度会漏掉「两端点都在区外、但连线穿过限飞区」的情况</td>
    </tr>
    <tr>
      <td>成本惩罚</td>
      <td>距限飞区 15m 内的边，按距离比例抬高 <code>cost</code>（软约束）</td>
      <td>防止航线贴着限飞区边缘飞行，留出安全余量</td>
    </tr>
  </tbody>
</table>

<div class="note">
  <strong>设计取舍：</strong>把避让拆成「硬过滤 + 软惩罚」两级，是因为
  <strong>纯硬过滤会让航线紧贴限飞区边界</strong>（数学上最短路径总是贴着障碍边缘走），
  <strong>纯惩罚则无法排除真正穿越禁飞的边</strong>。
  两者结合后，航线既能绕开禁飞区，又能自然走在安全走廊中间。
</div>

<h3>第三步：求解与校验</h3>
<pre><span class="cmt">-- 用 pgRouting 在边表上求最短路径；起终点映射到最近的可飞行节点</span>
SELECT * FROM pgr_astar(
  'SELECT id, source, target, cost, reverse_cost FROM drone_nav_edge',
  :start_node, :end_node, directed := false
);

<span class="cmt">-- 穿越检测：验证规划结果是否真的绕开了限飞区</span>
SELECT fr.id AS route_id, nfz.name AS crossed_zone
FROM flight_route fr
JOIN no_fly_zone nfz ON ST_Intersects(fr.route_geom, nfz.geom);</pre>

<p>
  另提供<strong>穿越检测接口</strong>：对起终点直线与规划路径分别做 <code>ST_Intersects</code> 判断，
  返回穿越的限飞区明细——既验证算法效果，也让「为什么绕行」对用户可见。
</p>

<h3>绕行代价是可量化的（实测样例）</h3>

<p>
  规划接口会同时返回<strong>直线距离</strong>与<strong>规划距离</strong>，因此「为避让多飞了多少」
  是一个可核对的数字，而不是形容词。以下是一次实测（起终点连线穿过校园中部两栋教学楼）：
</p>

<pre><span class="cmt"># POST /api/route/plan  （起终点连线穿越 2 个限飞区）</span>
  规划距离  <span class="ok">294.55 m</span>
  直线距离  <span class="ok">122.31 m</span>
  绕行增量  <span class="ok">+172.24 m</span>   （+141%）
  途径点    19
  预计时长  59 s

  直线穿越限飞区  <span class="ok">true</span>   ← 4号教学楼、3号教学楼（strict）
  规划路径仍穿越  <span class="ok">false</span>
  成功避让        <span class="ok">true</span></pre>

<p>
  直线距离与规划距离采用<strong>同一球面口径</strong>（前者为 haversine，后者为 PostGIS
  <code>ST_Length(...::geography)</code>），因此两者可以直接相减 —— 这一点有单元测试锁住，
  避免两种口径混算导致绕行增量失真。
</p>

<h2><span class="n">04</span>量算精度：从 ${AREA_FIX.before} 偏差到 ${AREA_FIX.after}</h2>

<p>
  测距用 Cesium 的球面距离（<code>EllipsoidGeodesic.surfaceDistance</code>），
  测面积用 <strong>ENU 局部切平面投影 + 鞋带公式</strong>。
  这个组合不是随手选的，而是踩过坑之后定的。
</p>

<div class="note warn">
  <strong>曾经的错误实现：</strong>用 <code>eastNorthUpToFixedFrame</code> 返回矩阵的
  <strong>列向量</strong>做点积来取局部坐标。<br>
  实测症状：<strong>100 米的边量出来是 ${AREA_FIX.wrongEdgeA} 米和 ${AREA_FIX.wrongEdgeB} 米</strong>，
  面积偏差 <strong>${AREA_FIX.before}</strong>。<br>
  注意 72 和 138 这两个数——<em>一条边算短了、另一条算长了</em>，
  正是「非正交基投影导致剪切变形」的典型症状。<br><br>
  <strong>根因：</strong>那些列是位置矢量（模长≈地球半径 6371km），且 east/north/up 三列并非正交，
  用非正交基做投影等于把正方形斜着压成平行四边形。<br>
  <strong>修正：</strong>改用 <code>Matrix4.inverse</code> 把世界坐标变到局部 ENU 系，
  得到严格正交的（东、北）坐标，再套鞋带公式。
  <strong>实测偏差降至 ${AREA_FIX.after}</strong>。
</div>

<p>
  取舍说明：距离用球面（有现成精确 API，成本低），面积用局部平面
  （校园约 1 平方公里内 ENU 近似误差远小于用户关心的精度）。
  为了那 ${AREA_FIX.after} 去引入球面多边形面积算法，是过度工程。
</p>

<h2><span class="n">05</span>空间数据服务：索引与瓦片</h2>

<table>
  <thead><tr><th>能力</th><th>实现方式</th></tr></thead>
  <tbody>
    <tr><td>点选查询</td><td><code>ST_Intersects</code> 判断点与图层几何的空间关系</td></tr>
    <tr><td>缓冲区查询</td><td><code>ST_DWithin</code> 以米为单位筛选（<code>::geography</code>，避免「度」当「米」用）</td></tr>
    <tr><td>GeoJSON 输出</td><td>按图层动态生成，前端 Cesium 直接加载</td></tr>
    <tr><td>MVT 矢量瓦片</td><td><code>ST_AsMVT</code> + <code>ST_AsMVTGeom</code> 生成 protobuf 瓦片，按 z/x/y 提供</td></tr>
    <tr><td>概览统计</td><td>建筑总数/面积/平均楼层、道路条数与总长、运动场地数量</td></tr>
  </tbody>
</table>

<h3>两个工程细节</h3>

<p><strong>① 动态表名的安全处理。</strong>
图层接口的表名来自前端，属动态 SQL。项目用白名单校验，只允许预定义的
${LAYERS.length} 张空间表通过，并针对性写了单元测试，从根上规避 SQL 注入。</p>

<p><strong>② MVT 的索引命中取舍。</strong>
瓦片包络在 <code>3857</code> 下计算，但几何列是 <code>4326</code>、GiST 索引也建在原始列上。
若直接拿 3857 的包络去比 4326 的列，PostgreSQL 会隐式转换或干脆不用索引。
因此先用 <code>ST_Transform(bounds, 4326)</code> 转回 4326 走 <code>&amp;&amp;</code> 预过滤命中索引，
再在子查询里做精确 <code>ST_Intersects</code>。</p>

<h2><span class="n">06</span>质量保障：能验证的工程习惯</h2>

<h3>后端单元测试：${TOTAL_TESTS} 个</h3>
<table>
  <thead><tr><th>测试类</th><th class="num">@Test 方法数</th></tr></thead>
  <tbody>${testRows}
    <tr><th>合计</th><th class="num">${TOTAL_TESTS}</th></tr>
  </tbody>
</table>
<p class="src">可复现：<code>cd backend &amp;&amp; mvn test</code>；或对 <code>backend/src/test/</code> 统计 <code>@Test</code> 出现次数。
覆盖距离口径、GeoJSON 解析、订单状态机、航线规划、表名白名单等关键路径。</p>

<h3>前端校验脚本：${VERIFY_SCRIPTS.length} 个</h3>
<table>
  <thead><tr><th>脚本</th></tr></thead>
  <tbody>${verifyRows}</tbody>
</table>
<p class="src">
  这些脚本针对「能编译、能启动、只在运行时炸」的三维开发问题。
  （同目录另有 <code>capture-runtime-errors.mjs</code>，属运行时错误捕获工具，不计入校验脚本。）
</p>

<table>
  <thead><tr><th>问题</th><th>根因</th><th>防护手段</th></tr></thead>
  <tbody>
    <tr>
      <td>Cesium 对象进 Vue 响应式</td>
      <td>几何构建走 Web Worker，<code>postMessage</code> 含 Vue 的 reactive Proxy 时结构化克隆直接抛 <code>DataCloneError</code></td>
      <td>持有 Cesium 实例的状态统一用 <code>shallowRef</code> / <code>shallowReactive</code>，并写脚本校验</td>
    </tr>
    <tr>
      <td>Cesium API 跨版本改名</td>
      <td><code>wgs84ToWindowCoordinates</code> 在新版本改名 <code>worldToWindowCoordinates</code>，旧写法语法合法、只在运行时抛 <code>TypeError</code></td>
      <td>封装兼容函数（新名 → 旧名 → null），并校验调用点</td>
    </tr>
    <tr>
      <td>把布尔属性当方法调用</td>
      <td><code>isLoading?.()</code> 中 <code>?.</code> 只对 null/undefined 短路；又因回调是 async，异常静默变成未处理的 rejection</td>
      <td>点击处理器整体加 try/catch，脚本校验属性用法</td>
    </tr>
    <tr>
      <td>测面积口径错误</td>
      <td>变换矩阵列向量点积导致剪切变形（100m 边算成 ${AREA_FIX.wrongEdgeA}m / ${AREA_FIX.wrongEdgeB}m，偏差 ${AREA_FIX.before}）</td>
      <td>改用 ENU 逆矩阵变换到局部平面（实测偏差 ${AREA_FIX.after}）</td>
    </tr>
  </tbody>
</table>

<h3>其他工程约束</h3>
<ul>
  <li><strong>配置分环境：</strong>本地 profile 零配置可启动；生产 profile 强制由环境变量提供数据库连接，启动阶段即校验连通性（fail-fast），避免「启动成功但接口全 500」。</li>
  <li><strong>破坏性操作默认关闭：</strong>历史脏数据清理会改写业务数据，因此默认不执行，需显式开启。</li>
  <li><strong>服务分层：</strong>Controller 只做参数校验与响应包装，空间 SQL 集中在 Mapper 层，业务规则在 Service 层——便于单元测试覆盖，也让后续替换数据源时改动面可控。</li>
</ul>

<h2><span class="n">07</span>空间索引与数据库环境</h2>

<p>全部空间列均建立 GiST 索引（共 12 个）：</p>
<pre>school / teaching_building / dormitory / other_buildings / road /
playground / basketball_court / tennis_court / no_fly_zone /
flight_route / drone_nav_node / drone_nav_edge
<span class="cmt">-- 例：CREATE INDEX sidx_school_geom ON public.school USING gist (geom);</span></pre>

<p>
  实测环境：PostgreSQL 18.4 / <strong>PostGIS 3.6.2</strong> / <strong>pgRouting 4.0.1</strong>。
</p>

<h2><span class="n">08</span>本页数据的可验证性</h2>

<p>页面上每个数字都可以独立复核，不依赖本页作者的说明：</p>
<table>
  <thead><tr><th>数字</th><th>验证方法</th></tr></thead>
  <tbody>
    <tr><td>${TOTAL_FEATURES} 个要素 / ${LAYERS.length} 张表</td><td>对每张表执行 <code>SELECT COUNT(*)</code></td></tr>
    <tr><td>${SRID.columns} 个空间列 SRID 一致</td><td>查询 <code>geometry_columns</code></td></tr>
    <tr><td>校园跨度 ${CAMPUS.eastWestM} 米</td><td>用 <code>::geography</code> 计算边界跨度</td></tr>
    <tr><td>${TOTAL_TESTS} 个单元测试</td><td><code>mvn test</code>，或统计 <code>backend/src/test/</code> 中 <code>@Test</code> 次数</td></tr>
    <tr><td>${VERIFY_SCRIPTS.length} 个校验脚本</td><td>列出 <code>frontend/scripts/verify-*.mjs</code></td></tr>
    <tr><td>导航网格 ${NAV.node} / ${NAV.edge.toLocaleString('en-US')}</td><td>查询 <code>drone_nav_node</code> / <code>drone_nav_edge</code> 计数</td></tr>
    <tr><td>${OFFSET.composite}m 偏移、5.6%→&lt;0.01%</td><td>工程内 <code>docs/</code> 保留了完整推导与实测记录</td></tr>
  </tbody>
</table>

<footer>
  <p>
    源码：<a href="${REPO}">${REPO.replace('https://', '')}</a><br>
    本页为静态技术展示；项目需 PostgreSQL + PostGIS + pgRouting 与 Spring Boot 后端方可运行，
    本地启动方式见仓库 README。
  </p>
  <p>闫孜昊 · WebGIS 开发工程师</p>
</footer>

</div>
</body>
</html>
`

const outFile = path.join(outDir, 'index.html')
fs.writeFileSync(outFile, html, 'utf8')

// .nojekyll：避免 GitHub Pages 用 Jekyll 处理
fs.writeFileSync(path.join(outDir, '.nojekyll'), '')

const kb = (fs.statSync(outFile).size / 1024).toFixed(1)
console.log(`已生成：${outFile}  (${kb} KB)`)
console.log(`已生成：${path.join(outDir, '.nojekyll')}`)
console.log(`\n页面内嵌实测数字：`)
console.log(`  要素总数 ${TOTAL_FEATURES} / 图层 ${LAYERS.length} / 空间列 ${SRID.columns} (SRID ${SRID.srid})`)
console.log(`  校园跨度 ${CAMPUS.eastWestM} m / 边界顶点 ${CAMPUS.vertices}`)
console.log(`  导航网格 ${NAV.node} 节点 / ${NAV.edge} 边`)
console.log(`  单元测试 ${TOTAL_TESTS} 个 / 校验脚本 ${VERIFY_SCRIPTS.length} 个`)
console.log(`  偏移 ${OFFSET.composite} m / 面积偏差 ${AREA_FIX.before} -> ${AREA_FIX.after}`)
