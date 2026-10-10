/**
 * 生成作品集 HTML（自带样式 + base64 内嵌真实项目截图，单文件可直接分发）。
 *
 * 关键经验：Word 导入 HTML 时对 <style> 里的 width / height / page-break
 * 支持极差（实测会被忽略），但对元素上的 inline style 是认的。
 * 因此所有影响分页与图片尺寸的规则都写成 inline style。
 * A4 去掉 Word 默认 1 英寸页边距后正文宽约 159mm，截图取 150mm 留余量。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const tmp = path.join(root, '.temp-portfolio')
fs.mkdirSync(tmp, { recursive: true })

/**
 * 把项目截图转成 data URI，保证 HTML 自包含。
 *
 * 读取的是 .temp-portfolio/ 下预先缩放过的 JPEG 副本（1400px 宽、质量 88）。
 * 直接把 2549px 原图塞进 HTML，Word 会按原始像素排版，单张图就撑出十几页；
 * PNG 无损格式体积也过大（单张 2MB+），转 JPEG 后整份 HTML 约 1MB。
 */
const img = (file) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(tmp, file)).toString('base64')

const shot1 = img('ui-screenshot-web.jpg') // 三维场景 + 图层控制 + 航线
const shot2 = img('ui-screenshot-2-web.jpg') // 侧边栏五大面板 + 飞行航线
const shot3 = img('ui-screenshot-3-web.jpg') // 食堂覆盖缓冲区分析

const IMG_STYLE =
  'display:block;width:150mm;max-width:100%;height:auto;border:1px solid #d8e0ea;margin:2mm 0 1.5mm;'
const shot = (data, alt) => `<img src="${data}" alt="${alt}" width="567" style="${IMG_STYLE}">`

/*
 * 分页符的写法很讲究。实测（见 scripts/portfolio/probe-pagebreak*.mjs）：
 *   - 对 <div style="page-break-before:always"> 分段，Word 会把 div 内首个块级
 *     元素推到下一页、div 自身又另起一页 —— 每个分段白占两页（4 节 = 8 页）；
 *   - 在块级元素之间插 <br style="page-break-before:always"> 才是一次干净分页
 *     （4 节 = 4 页）；
 *   - <span>/空 <div> 上的分页样式 Word 直接忽略。
 * 所以这里用独立的 <br> 作分页符，各章节本身保持普通块级元素。
 */
const PAGE = '<br style="page-break-before:always">'

const CSS = `
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "微软雅黑","Microsoft YaHei",sans-serif; color: #222;
         font-size: 10pt; line-height: 1.6; }
  .cover { text-align: center; padding-top: 30mm; }
  .cover .eyebrow { font-size: 10.5pt; color: #7a8899; letter-spacing: 4px; }
  .cover h1 { font-size: 26pt; margin: 10mm 0 3mm; letter-spacing: 3px; color: #14243a; }
  .cover .role { font-size: 12pt; color: #2f6fb5; letter-spacing: 2px; margin-bottom: 14mm; }
  .cover .proj { font-size: 15pt; font-weight: 700; color: #14243a; margin-bottom: 2mm; }
  .cover .sub { font-size: 10pt; color: #66788c; margin-bottom: 8mm; }
  .cover .stack { display: inline-block; text-align: left; border: 1px solid #dfe6ee;
                  padding: 5mm 8mm; font-size: 9.5pt; color: #3c4a5a; }
  .cover .meta { margin-top: 12mm; font-size: 9.5pt; color: #7a8899; }
  h2 { font-size: 13pt; color: #14243a; margin: 0 0 3mm; padding-bottom: 1.5mm;
       border-bottom: 2px solid #2f6fb5; }
  h3 { font-size: 11pt; color: #1d3a5c; margin: 5mm 0 2mm; }
  p { margin: 0 0 2.5mm; text-align: justify; }
  ul { margin: 0 0 3mm; padding-left: 5mm; }
  li { margin-bottom: 1.4mm; }
  code { font-family: Consolas,"Courier New",monospace; background: #f2f5f9; color: #1d4e89;
         font-size: 9pt; }
  .cap { font-size: 8.5pt; color: #7a8899; text-align: center; margin-bottom: 4mm; }
  table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; font-size: 9pt; }
  th, td { border: 1px solid #dde5ee; padding: 1.6mm 2.4mm; text-align: left; vertical-align: top; }
  th { background: #eef3f9; color: #14243a; font-weight: 700; }
  td.k { width: 34mm; color: #1d3a5c; font-weight: 700; background: #f7fafd; }
  .kpi { width: 100%; border-collapse: collapse; margin: 3mm 0 4mm; }
  .kpi td { border: 1px solid #dfe6ee; text-align: center; padding: 3mm 1mm; width: 25%; }
  .kpi .n { display: block; font-size: 15pt; font-weight: 700; color: #2f6fb5; }
  .kpi .l { display: block; font-size: 8.5pt; color: #66788c; }
  .note { background: #f7fafd; border-left: 3px solid #2f6fb5; padding: 2.5mm 3.5mm;
          font-size: 9pt; color: #3c4a5a; margin: 3mm 0; }
`

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>WebGIS开发作品集 · 闫孜昊</title>
<style>${CSS}</style>
</head><body>

<div class="cover" style="page-break-after:always;">
  <div class="eyebrow">WEBGIS · 三维可视化 · 空间数据服务</div>
  <h1>WebGIS 开发作品集</h1>
  <div class="role">闫孜昊 &nbsp;|&nbsp; 求职意向：WebGIS 开发工程师</div>
  <div class="proj">校园无人机外卖配送系统（WebGIS 数字孪生）</div>
  <div class="sub">校园空间数据自主矢量化生产 → PostGIS 入库 → Cesium 三维渲染 · 个人独立开发</div>
  <div class="stack">
    <b>前端</b>：Vue 3.4 / Vite 5 / Cesium 1.145 / Pinia / Element-Plus<br>
    <b>后端</b>：Spring Boot 3.2 / Java 17 / MyBatis-Plus / HikariCP<br>
    <b>空间数据</b>：PostgreSQL + PostGIS + pgRouting（A* 路径规划）<br>
    <b>坐标系</b>：入库统一标注 WGS84（SRID 4326），14 个空间列 SRID 一致<br>
    <b>基准处理</b>：原始数据按高德 GCJ-02 基准采集（.prj 标注 WGS84 与实际不符），底图选同&nbsp;基准高德影像零平移对齐；实测与 WGS84 底图偏差约 109m
  </div>
  <div class="stack" style="margin-top:2mm">
    <b>源码仓库</b>：https://github.com/aceword177/webgis-campus-digitaltwin<br>
    <b>技术展示</b>：https://aceword177.github.io/webgis-campus-digitaltwin/showcase/
  </div>
  <div class="meta">遥感解译与空间数据处理基础 &nbsp;·&nbsp; 全栈自研 &nbsp;·&nbsp; 完整业务闭环可复现</div>
</div>

${PAGE}
  <h2>一、项目概述</h2>
  <p>这是一个把「空间数据」真正跑起来的 WebGIS 项目。项目底料是一套自主生产的校园空间数据——在 ArcMap 中依影像底图手工矢量化教学楼、宿舍楼、其他建筑、道路、操场、篮球场、网球场、校园边界共 8 个图层 62 个要素，统一坐标系与字段后导入 PostGIS；再用 Cesium 把这些数据渲染成可交互的三维场景，并在场景之上搭起一条完整的<b>无人机外卖配送业务链</b>：用户下单后，后端用 <code>pgr_astar</code> 在 15m 分辨率导航网格上规划航线，自动绕开限飞区；配送过程中无人机位置每 2 秒沿航线推进并回传，前端平滑渲染飞行轨迹；送达后自动续派、回库待命或充电。空间数据不再只是"看图"，而是驱动业务的引擎。</p>

  <table class="kpi">
    <tr>
      <td><span class="n">8</span><span class="l">校园空间图层</span></td>
      <td><span class="n">15m</span><span class="l">导航网格分辨率</span></td>
      <td><span class="n">32</span><span class="l">REST 接口</span></td>
      <td><span class="n">48</span><span class="l">后端单元测试</span></td>
    </tr>
  </table>

  <h3>技术选型与职责</h3>
  <table>
    <tr><th>层级</th><th>技术</th><th>在本项目中的职责</th></tr>
    <tr><td class="k">三维渲染</td><td>Cesium 1.145</td><td>三维场景、白模拉伸、相机与视角控制、实体拾取、测距测面积</td></tr>
    <tr><td class="k">前端框架</td><td>Vue 3 + Vite + Pinia</td><td>组件化面板、状态管理、图层显隐与业务联动</td></tr>
    <tr><td class="k">空间数据库</td><td>PostGIS</td><td>空间存储、<code>ST_Intersects</code> 点选、<code>ST_DWithin</code> 缓冲区、<code>ST_AsMVT</code> 瓦片</td></tr>
    <tr><td class="k">路径规划</td><td>pgRouting</td><td>导航网格建模与 <code>pgr_astar</code> 最短路径求解</td></tr>
    <tr><td class="k">后端服务</td><td>Spring Boot 3.2</td><td>REST 接口、定时调度、订单状态机、无人机位置推进</td></tr>
  </table>

  <h3>数据组织</h3>
  <p>空间库含 8 张校园表（校园边界、教学楼、宿舍楼、其他建筑、道路、操场、篮球场、网球场），业务库含 6 张表（餐厅、商品、无人机、订单、航线、限飞区），另有 2 张导航网格表（<code>drone_nav_node</code> / <code>drone_nav_edge</code>）。导航网格由脚本幂等重建，秒级完成，便于调整限飞区后快速刷新。</p>

  <div class="note"><b>配色约定：</b>教学楼蓝色、宿舍楼橙色、其他建筑绿色、操场红色、篮球场与网球场半透明面、校园边界黄色描边——让三维场景一眼可读，也方便演示时快速定位图层。</div>

${PAGE}
  <h2>二、成果一：三维场景与空间交互</h2>
  ${shot(shot1, '校园三维场景总览')}
  <div class="cap">图 1　校园三维白模场景：建筑按类型着色、道路线渲染、校园边界黄线、图层控制面板</div>

  <h3>实现要点</h3>
  <ul>
    <li><b>建筑白模拉伸</b>：读取建筑的 <code>height</code> 字段，按层高 3.5m 换算为 <code>extrudedHeight</code> 拉伸体块，用 GeoJsonDataSource 批量加载。</li>
    <li><b>建筑点选弹窗</b>：点击教学楼弹出所属院系、学院简介与照片；点击宿舍楼弹出楼名、男女生宿舍信息与照片。拾取采用射线求交三级兜底（<code>pickPosition</code> → <code>globe.pick</code> → <code>pickEllipsoid</code>），点楼体上部也能命中。</li>
    <li><b>悬停反馈</b>：鼠标移到楼体上高亮并切换手型光标，提示"可点击"。</li>
    <li><b>测距 / 测面积</b>：左键连续打点、右键结束，分段显示距离与面积，支撑现场核查场景。</li>
    <li><b>图层控制</b>：左侧面板独立控制每个图层显隐，避免一次性加载全部要素。</li>
  </ul>

  <div class="note"><b>踩过的坑（拉伸体块不能贴地）：</b><code>height=0 + extrudedHeight</code> 是"从地面立起来"的体块，而 <code>clampToGround</code> 是"把多边形贴到地形表面"，两者语义互斥——贴地多边形走 GroundPrimitive，根本不支持 height/extrudedHeight。因此建筑描边另用贴地 polyline 实现，避免 Cesium 反复重建几何。</div>

${PAGE}
  <h2>三、成果二：空间数据服务与矢量瓦片</h2>
  ${shot(shot2, '侧边栏五大功能面板')}
  <div class="cap">图 2　图层控制 / 订单管理 / 无人机 / 航线规划 / 配送统计 五大功能面板</div>

  <h3>空间查询与输出</h3>
  <table>
    <tr><th>能力</th><th>实现方式</th></tr>
    <tr><td class="k">点选查询</td><td><code>ST_Intersects</code> 判断点与图层几何的空间关系</td></tr>
    <tr><td class="k">缓冲区查询</td><td><code>ST_DWithin</code> 以米为单位做距离筛选（geography 类型，避免投影误差）</td></tr>
    <tr><td class="k">GeoJSON 输出</td><td>按图层动态生成 GeoJSON，前端 Cesium 直接加载渲染</td></tr>
    <tr><td class="k">MVT 矢量瓦片</td><td><code>ST_AsMVT</code> + <code>ST_AsMVTGeom</code> 生成 protobuf 瓦片，按 z/x/y 提供</td></tr>
    <tr><td class="k">校园概览统计</td><td>建筑总数 / 建筑面积 / 平均楼层、道路条数与总长、运动场地数量</td></tr>
  </table>

  <h3>两个工程细节</h3>
  <ul>
    <li><b>动态表名的安全处理</b>：图层接口的表名来自前端，属于动态 SQL。项目用白名单校验，只允许预定义的 8 张空间表通过，并针对性写了单元测试，从根上规避 SQL 注入。</li>
    <li><b>为什么用 MVT</b>：相比一次返回全部要素的 GeoJSON，矢量瓦片按视口与层级取数，既减少传输量，也把渲染压力交给前端按需处理。</li>
  </ul>

  <div class="note"><b>服务分层：</b>Controller 只做参数校验与响应包装，空间 SQL 集中在 Mapper 层，业务规则在 Service 层——便于单测覆盖，也让后续替换数据源时改动面可控。</div>

${PAGE}
  <h2>四、成果三：A* 路径规划与限飞区避让</h2>
  <p>这是项目的技术核心。要在校园里给无人机规划出一条<b>既短又安全</b>的航线，需要把连续空间离散成可寻路的图结构，再把"禁飞"这一约束真正落进图里。</p>

  <h3>第一步：构建导航网格</h3>
  <ul>
    <li>以校园边界外扩 50m 为范围，按 <b>15m 分辨率</b>生成网格中心点作为导航节点；</li>
    <li>节点若落在限飞区（含 5m 安全缓冲）内，标记为不可飞行；</li>
    <li>每个可飞行节点与其周围 <b>8 邻域</b>的可飞行节点连边，边代价取两点间实际距离（米）。</li>
  </ul>

  <h3>第二步：限飞区三级避让</h3>
  <table>
    <tr><th>层级</th><th>做法</th><th>解决的问题</th></tr>
    <tr><td class="k">节点级</td><td>节点带 5m 安全缓冲判定，落在缓冲区内即不可飞</td><td>保证起终点与途经点本身不在禁飞范围</td></tr>
    <tr><td class="k">边级过滤</td><td>源-目标线段穿越限飞区（含缓冲）则<b>不建这条边</b></td><td>网格粒度会漏掉"两端点都在区外、但连线穿过限飞区"的情况</td></tr>
    <tr><td class="k">成本惩罚</td><td>距限飞区 15m 内的边，按距离比例抬高 cost（软约束）</td><td>防止航线贴着限飞区边缘飞行，留出安全余量</td></tr>
  </table>

  <h3>第三步：求解与校验</h3>
  <ul>
    <li>用 <code>pgr_astar</code> 在边表上求最短路径，起终点映射到最近的可飞行节点；</li>
    <li>额外提供<b>穿越检测</b>接口：起终点直线与规划路径分别做 <code>ST_Intersects</code> 判断，返回穿越的限飞区明细——既验证算法效果，也让"为什么绕行"对用户可见。</li>
  </ul>

  <div class="note"><b>设计取舍：</b>把避让拆成"硬过滤 + 软惩罚"两级，是因为纯硬过滤会让航线紧贴限飞区边界，纯惩罚则无法排除真正穿越禁飞的边。两者结合后，航线既能绕开禁飞区，又能自然走在安全走廊中间。</div>

${PAGE}
  <h2>五、成果四：配送业务闭环与统计看板</h2>
  ${shot(shot3, '食堂覆盖缓冲区分析')}
  <div class="cap">图 3　食堂覆盖缓冲区分析：按距离分档统计可覆盖宿舍楼数量，辅助配送站选址</div>

  <h3>订单状态机与自动调度</h3>
  <ul>
    <li><b>状态流转</b>：<code>pending → delivering → delivered / cancelled</code>，每次流转都校验前置状态，避免非法跳转。</li>
    <li><b>自动补单</b>：定时任务周期性生成订单，全局在飞上限控制并发，防止演示时资源被占满。</li>
    <li><b>自动派单</b>：空闲且电量高于阈值的无人机自动接单并即时规划航线。</li>
    <li><b>位置推进</b>：配送中的无人机按固定周期沿航线插值推进位置并回传，前端做平滑移动 + 金色尾迹。</li>
    <li><b>送达判定</b>：确认送达时校验与目标点的实际距离（阈值内才允许完成），避免"凭空送达"。</li>
    <li><b>自循环</b>：送达后自动续派下一单 / 回食堂待命 / 进充电状态，充电到阈值后恢复可用。</li>
  </ul>

  <h3>统计看板</h3>
  <p>把空间数据与业务数据汇总成可读指标：建筑总数与建筑面积、道路总长、运动场地数量；无人机状态分布（空闲 / 配送中 / 充电 / 电量）；配送统计（今日订单、送达率、平均时长、餐厅订单量）。</p>

  <h3>食堂覆盖缓冲区分析</h3>
  <p>以食堂为圆心按距离分档做缓冲区，统计每档可覆盖的宿舍楼数量，用空间分析直接回答"配送站放哪里覆盖最好"——把 PostGIS 的距离计算变成可解释的业务结论。</p>

${PAGE}
  <h2>六、工程实践与质量保障</h2>
  <h3>用回归脚本守住易复发的坑</h3>
  <p>三维开发中有几类问题"能编译、能启动，只在运行时炸"，靠肉眼回归很容易漏。项目为它们写了专门的校验脚本，纳入日常检查：</p>
  <table>
    <tr><th>问题</th><th>现象与根因</th><th>防护手段</th></tr>
    <tr>
      <td class="k">Cesium 对象进 Vue 响应式</td>
      <td>页面一打开就报 <code>DataCloneError</code>：Cesium 几何构建走 Web Worker，<code>postMessage</code> 里一旦含 Vue 的 reactive Proxy，结构化克隆直接抛异常</td>
      <td>持有 Cesium 实例的状态统一用 <code>shallowRef</code> / <code>shallowReactive</code>，并写脚本校验</td>
    </tr>
    <tr>
      <td class="k">Cesium API 跨版本改名</td>
      <td><code>SceneTransforms.wgs84ToWindowCoordinates</code> 在新版本改名为 <code>worldToWindowCoordinates</code>，旧写法语法合法、只在运行时抛 <code>TypeError</code>，表现为"点击后有数据但弹窗不出现"</td>
      <td>封装兼容函数（新名 → 旧名 → null），并校验调用点</td>
    </tr>
    <tr>
      <td class="k">把布尔属性当方法调用</td>
      <td><code>dataSource.isLoading?.()</code> 中 <code>?.</code> 只对 null/undefined 短路，对"存在但不是函数"的值照样调用并抛错；又因点击回调是 async，异常静默变成未处理的 rejection</td>
      <td>点击处理器整体加 try/catch，脚本校验属性用法</td>
    </tr>
    <tr>
      <td class="k">测面积口径错误</td>
      <td>直接用变换矩阵的列向量做点积会剪切变形（实测 100m 的边算成 72m / 138m，面积偏差 5.6%）</td>
      <td>改用 ENU 逆矩阵把点变换到局部平面（实测偏差 &lt; 0.01%）</td>
    </tr>
  </table>

  <h3>测试与规范</h3>
  <ul>
    <li><b>后端 48 个单元测试</b>：覆盖距离口径、GeoJSON 解析、订单状态机、航线规划、表名白名单（SQL 注入防护）等关键路径。</li>
    <li><b>前端校验脚本</b>：Cesium 响应式、渲染行为、建筑描边、API 用法、弹窗定位等专项校验。</li>
    <li><b>配置分环境</b>：本地 profile 零配置即可启动；生产 profile 强制由环境变量提供数据库连接，启动阶段即校验连通性（fail-fast），避免"启动成功但接口全 500"。</li>
    <li><b>破坏性操作默认关闭</b>：历史脏数据清理会改写业务数据，因此默认不执行，需显式开启。</li>
  </ul>

  <h3>代码规模</h3>
  <p>后端 Java 约 <b>4,700 行</b>（96 个源文件、9 个 Controller、32 个 REST 接口）；前端 Vue / JS 约 <b>5,700 行</b>（13 个业务组件 + 状态管理 + Cesium 工具封装）。</p>

${PAGE}
  <h2>七、项目收获与后续迭代</h2>
  <h3>我从中得到的三点</h3>
  <ul>
    <li><b>空间数据要"用起来"才有价值。</b>把 GIS 数据从"出图"推进到"驱动业务决策"，需要同时考虑数据组织、服务接口与前端表达，这个项目让我打通了这条链路。</li>
    <li><b>三维开发的难点在运行时，不在语法。</b>响应式边界、坐标变换、版本兼容这些问题都通过运行时才暴露，因此我养成了"为踩过的坑写校验脚本"的习惯。</li>
    <li><b>算法要放回业务里验证。</b>路径规划不只是算出一条线，还要回答"是否穿越限飞区""为什么这样绕行"，让结果可解释才算真正可用。</li>
  </ul>

  <h3>后续迭代方向</h3>
  <ul>
    <li>仿真业务层扩展：消防疏散模拟、日照阴影模拟；</li>
    <li>倾斜摄影 OSGB / BIM glb 模型加载，替换当前白模表达；</li>
    <li>导航网格升级：更高分辨率（5m）与动态限飞区热更新；</li>
    <li>接入真实无人机机队（遥测上报 + 任务下发协议）；</li>
    <li>部署方案：Nginx 托管前端打包产物，前后端分离上线。</li>
  </ul>

  <div class="note" style="margin-top:8mm">本项目为个人独立完成的校园实践作品，全部代码、空间数据脚本与文档均已归档，可现场演示完整配送闭环。欢迎就技术细节进一步交流。</div>

</body></html>`

const outHtml = path.join(tmp, 'portfolio.html')
fs.writeFileSync(outHtml, html, 'utf8')
console.log('HTML:', outHtml, `${(fs.statSync(outHtml).size / 1024 / 1024).toFixed(2)} MB`)
