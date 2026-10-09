/**
 * 简历改写脚本：把「项目经历」替换为 WebGIS 校园数字孪生项目，
 * 同步更新「相关技能」「自我评价」「作品集」栏。
 *
 * 原理：docx 就是一个 zip。解压后只对 word/document.xml 做定点文本替换，
 * 其余部件（样式、页眉页脚、编号、图片、关系）原样回填，
 * 这样能 100% 保留原简历的排版、字体与配色。
 *
 * 用法：node scripts/portfolio/rewrite-resume.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const work = path.join(root, '.temp-resume')
const srcDir = path.join(work, 'x')
const docPath = path.join(srcDir, 'word', 'document.xml')
const outDocx = path.join(root, '闫孜昊-WebGIS开发工程师-简历.docx')

const FONT = '<w:rFonts w:ascii="微软雅黑" w:hAnsi="微软雅黑" w:eastAsia="微软雅黑" w:cs="微软雅黑"/>'

/** 一行普通正文（与原文 sz20 / #666666 完全一致） */
const body = (text) =>
  `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="377" w:lineRule="exact"/><w:textAlignment w:val="center"/></w:pPr>` +
  `<w:r><w:rPr>${FONT}<w:color w:val="666666"/><w:sz w:val="20"/></w:rPr>` +
  `<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`

/** 项目小标题行（加粗 sz22） */
const subtitle = (text) =>
  `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="348" w:lineRule="exact"/><w:jc w:val="left"/><w:textAlignment w:val="center"/></w:pPr>` +
  `<w:r><w:rPr>${FONT}<w:color w:val="525252"/><w:sz w:val="22"/></w:rPr>` +
  `<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`

/** 项目标题行：左侧时间 + 制表符 + 右侧项目名（对齐原文 tab pos=10260） */
const title = (date, name) =>
  `<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="10260"/></w:tabs>` +
  `<w:spacing w:before="0" w:after="0" w:line="377" w:lineRule="exact"/><w:jc w:val="left"/><w:textAlignment w:val="center"/></w:pPr>` +
  `<w:r><w:rPr>${FONT}<w:b/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${date}</w:t></w:r>` +
  `<w:r><w:rPr>${FONT}<w:b/><w:sz w:val="22"/></w:rPr><w:tab/></w:r>` +
  `<w:r><w:rPr>${FONT}<w:b/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${name}</w:t></w:r></w:p>`

/** 空行（沿用原文 light 行高，用于分节留白） */
const spacer = (line = 71) =>
  `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="${line}" w:lineRule="exact"/><w:ind w:left="0"/><w:jc w:val="left"/></w:pPr></w:p>`

let xml = fs.readFileSync(docPath, 'utf8')
const applied = []

function swap(label, find, replace) {
  const hits = xml.split(find).length - 1
  if (hits !== 1) throw new Error(`[${label}] 期望命中 1 次，实际 ${hits} 次`)
  xml = xml.replace(find, replace)
  applied.push(`${label} (${find.length} -> ${replace.length} chars)`)
}

// ---------- 1. 项目经历：删除河北生态环境保护项目，替换为 WebGIS 项目 ----------
const newProject = [
  title('2025.9-2026.9', '校园无人机外卖配送系统（WebGIS 数字孪生）'),
  subtitle('个人独立开发项目 · 全栈自研'),
  spacer(50),
  body('项目描述：基于自主生产校园空间数据的 WebGIS 三维数字孪生平台——在 ArcMap 中依影像底图手工矢量化教学楼、宿舍楼、其他建筑、道路、操场、篮球场、网球场、校园边界共 8 个图层（62 个要素），经字段计算与几何检查后导出并导入 PostGIS；用 Cesium 渲染为可交互校园场景，并跑通「无人机外卖配送」闭环——下单后由 A* 算法在 15m 导航网格上规划航线、自动绕行限飞区，配送中实时推进无人机位置。'),
  body('1. 空间数据生产与入库：基于影像底图在 ArcMap 中完成 8 个校园图层的手工矢量化（教学楼 / 宿舍楼 / 其他建筑 / 道路 / 操场 / 篮球场 / 网球场 / 校园边界，共 62 个要素），逐层完成坐标系设定、字段计算与几何有效性检查后导出 Shapefile，再导入 PostgreSQL + PostGIS（shp_data 库）并建立 GiST 空间索引；入库统一标注 SRID 4326，14 个空间列 SRID 完全一致、表内无混用。坐标系基准经核实为高德 GCJ-02（原始 .prj 标注 GCS_WGS_1984 与实际不符），故底图选用同基准高德影像实现零平移对齐——曾误换天地图（WGS84）底图并实测出约 109m 偏移，最终定位根因并规避，避免了对全库数据做错误偏移。'),
  body('2. 三维场景与交互：Cesium 搭建校园三维场景，建筑按 height 字段拉伸白模并按类型着色，叠加影像底图、道路线、运动场地半透明面与校园边界；实现建筑点选弹窗（射线求交三级兜底）、悬停高亮、图层显隐控制，以及测距 / 测面积工具与一键定位视角。'),
  body('3. 空间数据服务：用 PostgreSQL + PostGIS 管理 8 张校园空间表（数据由本人矢量化生产），后端基于 ST_Intersects 点选、ST_DWithin 缓冲区、ST_AsMVT 生成 MVT 矢量瓦片并封装 GeoJSON 接口，前端按需加载；动态表名走白名单校验，规避 SQL 注入。'),
  body('4. A* 路径规划与限飞区避让：基于 pgRouting 构建 15m 分辨率导航网格（节点 + 8 邻域边），用 pgr_astar 求最短路径；限飞区三级避让——节点 5m 安全缓冲、跨区网格边直接过滤、靠近限飞区的边做成本惩罚；另提供起终点直线与规划路径的双重穿越检测。'),
  body('5. 配送闭环与工程质量：设计订单状态机（pending → delivering → delivered / cancelled），定时任务自动补单、电量 >30% 的空闲无人机自动接单，配送中每 2 秒沿航线插值推进位置；编写 48 个后端单元测试，另有 6 个前端脚本守护 Cesium 响应式等易复发缺陷。'),
  spacer(377),
].join('')

// 用「段落 paraId」+ 正文特征双重定位，确保整段（34~37 号段落）被完整删除
const projStart = '<w:p w14:paraId="6F023F8F">'
const projTail = '本项目紧扣河北省耕地保护'
const s = xml.indexOf(projStart)
const tailAt = xml.indexOf(projTail)
if (s === -1 || tailAt === -1 || tailAt < s) throw new Error('定位项目经历段落失败')
// 环保项目描述所在段落的 </w:p> 即整块终点
const e = xml.indexOf('</w:p>', tailAt)
if (e === -1) throw new Error('定位项目经历段落结尾失败')
const oldBlock = xml.slice(s, e + '</w:p>'.length)
if (!oldBlock.includes('河北生态环境保护项目') || !oldBlock.includes(projTail)) {
  throw new Error('项目经历块内容不完整，拒绝替换')
}
xml = xml.slice(0, s) + newProject + xml.slice(e + '</w:p>'.length)
applied.push(`项目经历块 (${oldBlock.length} -> ${newProject.length} chars)`)

// 确认旧项目彻底清除
for (const must of ['河北生态环境保护项目', projTail, '校园实践项目']) {
  if (xml.includes(must)) throw new Error(`旧项目残留：${must}`)
}

// ---------- 2. 相关技能：追加 WebGIS 全栈技能条目 ----------
// 锚点用「3.理论基础…」段落结束标签；后面紧跟空行段落，新条目插在其前
const skillsAnchor =
  '地籍 / 地形测绘规范，能识别并解决常见空间数据误差、图层匹配、属性错误等技术问题。</w:t></w:r></w:p>'
const newSkills = [
  '3.空间数据与坐标基准：熟练 ArcGIS 桌面套件（ArcMap 矢量化、属性录入、拓扑与几何检查、字段计算、制图出图）；掌握坐标基准处理与转换（WGS84 / Web Mercator / GCJ-02 差异与实测偏移、ST_Transform 与 ST_SetSRID 的区别、MVT 瓦片 3857↔4326 的索引命中取舍）。',
  '4.WebGIS 开发：熟练 Cesium 三维开发（Entity / DataSource / 相机与视角控制、坐标与矩阵变换、影像与地形图层）；掌握 OpenLayers、Leaflet，可独立完成「底图 + 图层控制 + 空间查询 + 专题可视化」的 Web 地图应用。',
  '5.空间数据库与服务：熟练 PostgreSQL + PostGIS 空间 SQL（ST_Intersects / ST_DWithin / ST_Distance / ST_AsMVT），熟悉 pgRouting 路径规划与导航网格构建；能用 Spring Boot + MyBatis 封装 GeoJSON / MVT 瓦片等空间数据接口。',
  '6.前端工程化：熟练 Vue3（组合式 API）+ Vite + Pinia + Element-Plus，了解 Axios 接口封装、组件化拆分与 ESLint / 构建校验；具备三维场景与业务页面联调的完整项目经验。',
]
swap('相关技能', skillsAnchor, skillsAnchor + newSkills.map(body).join(''))

// ---------- 3. 自我评价：改写为 WebGIS 岗位口径（合并为 2 条，确保简历落在 2 页内） ----------
const evalMap = [
  [
    '1.匹配岗位核心需求：具备完整 GIS 数据处理、测绘内业实操经验，熟练 ArcGIS 全流程作业，可独立承接数据处理、质检、项目配合工作。',
    '1.岗位匹配：兼具 GIS 数据处理功底与 WebGIS 前后端开发能力，能独立承接「空间数据 + Web 地图 + 后端接口」全流程开发；对空间数据精度与属性完整性有严格自查习惯，擅长排查坐标系统、拓扑与图层匹配类故障。',
  ],
  [
    '2.严谨细心，对空间数据精度、属性完整性有严格自查习惯，擅长发现并解决数据拓扑、坐标、图层匹配类技术故障。',
    '2.技术自驱：习惯先定位根因再改代码，会为易复发的坑补回归脚本与注释（如 Cesium 与 Vue 响应式的结构化克隆冲突、Cesium API 跨版本改名）；沟通顺畅，能按节点推进任务并主动同步风险。',
  ],
  [
    '3.服从团队安排，沟通顺畅，能高效协同完成项目节点任务，愿意持续优化数据处理流程、提升作业效率，稳定胜任 GIS 数据处理岗位工作。',
    null, // 内容已并入第 1、2 条，删除该段以把简历控制在 2 页
  ],
]
for (const [oldT, newT] of evalMap) {
  const hits = xml.split(oldT).length - 1
  if (hits !== 1) throw new Error(`自我评价条目命中 ${hits} 次: ${oldT.slice(0, 14)}`)
  if (newT === null) {
    // 整段删除（连同段落标签），避免留下空白行
    const at = xml.indexOf(oldT)
    const ps = xml.lastIndexOf('<w:p ', at)
    const pe = xml.indexOf('</w:p>', at) + '</w:p>'.length
    xml = xml.slice(0, ps) + xml.slice(pe)
    applied.push('自我评价：删除原第 3 条（内容已并入前两条）')
  } else {
    xml = xml.replace(oldT, newT)
    applied.push(`自我评价：${oldT.slice(0, 8)}…`)
  }
}

// ---------- 4. 作品集栏：改为附件说明 + 源码仓库 / 在线演示 ----------
// ⚠️ 投递前必须把下面两个 <> 占位符替换为真实地址；没有在线演示就删掉整行。
//    地址需由本人创建仓库并部署后提供，脚本无法代填。
const portfolioTailPr =
  '<w:pPr><w:spacing w:before="0" w:after="0" w:line="377" w:lineRule="exact"/><w:textAlignment w:val="center"/></w:pPr>'
const portfolioRunRpr =
  '<w:rPr><w:rFonts w:ascii="微软雅黑" w:hAnsi="微软雅黑" w:eastAsia="微软雅黑" w:cs="微软雅黑"/><w:color w:val="666666"/><w:sz w:val="20"/></w:rPr>'
const portPara = (t) => `</w:p><w:p>${portfolioTailPr}<w:r>${portfolioRunRpr}<w:t xml:space="preserve">${t}</w:t></w:r>`

swap(
  '作品集正文',
  '<w:t>此栏为以上项目作品：【金山文档】 作品集</w:t>',
  '<w:t xml:space="preserve">此栏为以上项目作品，详见附件：</w:t>'
)
swap(
  '作品集链接',
  '<w:t>https://www.kdocs.cn/l/ch9EEKEdioaW</w:t>',
  '<w:t xml:space="preserve">《WebGIS开发作品集.pdf》（功能截图与技术要点）</w:t>'
  + portPara('源码仓库：https://github.com/&lt;你的用户名&gt;/&lt;仓库名&gt;')
  + portPara('在线演示：https://&lt;你的演示地址&gt;')
)

// ---------- 4b. 压缩段落留白：把末尾内容收回第 2 页 ----------
// 原文「实习经历」「自我评价」标题前各有一个 19pt 空行段，删掉可省约 36pt。
const spacerIntern = '<w:p w14:paraId="3EC2F86E"><w:pPr><w:spacing w:before="0" w:after="0" w:line="290" w:lineRule="exact"/><w:jc w:val="left"/></w:pPr></w:p>'
const spacerEval = '<w:p w14:paraId="058D3D5F"><w:pPr><w:spacing w:before="0" w:after="0" w:line="290" w:lineRule="exact"/><w:jc w:val="left"/></w:pPr></w:p>'
for (const [label, sp] of [['实习经历', spacerIntern], ['自我评价', spacerEval]]) {
  const hits = xml.split(sp).length - 1
  if (hits !== 1) throw new Error(`[${label}] 段前空行定位失败，命中 ${hits} 次`)
  xml = xml.replace(sp, '')
  applied.push(`删除「${label}」段前空行`)
}

// 「作品集」标题行高 464 比其他小标题（377）更高，压缩到 377；
// 标题后还有两个空行段（87 / 152），行高收到 1pt 相当于删除，
// 避免最后一行被挤到第 3 页。
const portfolioHeadingPr = '<w:p w14:paraId="4577FC72"><w:pPr><w:spacing w:before="0" w:after="0" w:line="464" w:lineRule="exact"/><w:ind w:left="0"/><w:textAlignment w:val="center"/><w:rPr><w:sz w:val="21"/></w:rPr></w:pPr>'
if (!xml.includes(portfolioHeadingPr)) throw new Error('作品集标题段落定位失败')
xml = xml.replace(portfolioHeadingPr, portfolioHeadingPr.replace('w:line="464"', 'w:line="377"'))
applied.push('作品集标题行高 464 -> 377')

const tailSpacers = [
  '<w:p w14:paraId="595F2B30"><w:pPr><w:spacing w:before="0" w:after="0" w:line="87" w:lineRule="exact"/><w:rPr><w:sz w:val="21"/></w:rPr></w:pPr></w:p>',
  '<w:p w14:paraId="620589F2"><w:pPr><w:spacing w:before="0" w:after="0" w:line="152" w:lineRule="exact"/><w:rPr><w:rFonts w:hint="eastAsia" w:eastAsiaTheme="minorEastAsia"/><w:sz w:val="21"/><w:lang w:val="en-US" w:eastAsia="zh-CN"/></w:rPr></w:pPr></w:p>',
]
for (const sp of tailSpacers) {
  const hits = xml.split(sp).length - 1
  if (hits !== 1) throw new Error(`作品集标题后空行定位失败，命中 ${hits} 次: ${sp.slice(0, 30)}`)
  xml = xml.replace(sp, sp.replace(/w:line="\d+"/, 'w:line="1"'))
}
applied.push('作品集标题后空行行高 -> 1pt（2 处）')

// ---------- 5. 回填并重新打包 ----------
fs.writeFileSync(docPath, xml, 'utf8')

/** 极简 ZIP 打包器（stored 模式，无需外部依赖） */
function zipDir(dir, outFile) {
  const crcTable = (() => {
    const t = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })()
  const crc32 = (buf) => {
    let c = -1
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    return (c ^ -1) >>> 0
  }

  const walk = (d, base = '') => {
    const out = []
    for (const entry of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = path.join(d, entry.name)
      const rel = base ? `${base}/${entry.name}` : entry.name
      if (entry.isDirectory()) out.push(...walk(full, rel))
      else out.push({ rel, data: fs.readFileSync(full) })
    }
    return out
  }

  const files = walk(dir)
  const locals = []
  const centrals = []
  let offset = 0

  for (const f of files) {
    const nameBuf = Buffer.from(f.rel, 'utf8')
    const crc = crc32(f.data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // UTF-8 flag
    local.writeUInt16LE(0, 8) // stored
    local.writeUInt16LE(0, 10) // time
    local.writeUInt16LE(0x21, 12) // date (1996-01-01, 占位)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(f.data.length, 18)
    local.writeUInt32LE(f.data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, nameBuf, f.data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(f.data.length, 20)
    central.writeUInt32LE(f.data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBuf)

    offset += local.length + nameBuf.length + f.data.length
  }

  const centralBuf = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)

  fs.writeFileSync(outFile, Buffer.concat([...locals, centralBuf, eocd]))
  return files.length
}

const n = zipDir(srcDir, outDocx)

console.log('已应用替换：')
for (const a of applied) console.log('  - ' + a)
console.log(`\n输出：${outDocx}`)
console.log(`部件数 ${n} / 大小 ${fs.statSync(outDocx).size} bytes`)
