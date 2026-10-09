/**
 * 浮窗定位算法的边界测试。
 *
 * 为什么要单测：原实现只有固定的 `left = x + 15`、`top = y - 50`，没有视口约束。
 * 建筑靠下时浮窗顶部落在屏幕底部附近，整块内容被裁掉 —— 而这种问题只在
 * 特定视角/特定建筑才出现，肉眼很难穷举。抽成纯函数后就可以把边界一条条钉死。
 *
 * 断言不变量（比精确数值更有意义）：
 *   · 浮窗始终完整落在视口内（除非它比视口还大）
 *   · 优先放在锚点上方，不遮挡建筑
 *   · 水平默认在右侧，右侧不够时翻到左侧
 *
 * 用法：node scripts/verify-popup-position.mjs
 */
import {
  computePopupPosition,
  parsePx,
  EDGE_PADDING,
  SIDE_GAP,
  ANCHOR_LIFT
} from '../src/utils/layout.js'

let failures = 0
const fail = (m) => { failures++; console.log(`  ✗ ${m}`) }
const pass = (m) => console.log(`  ✓ ${m}`)

console.log('浮窗定位算法边界测试\n')

const W = 288
const H = 300
const VW = 1200
const VH = 700

/** 通用不变量检查 */
function checkInvariants(label, pos, opts = {}) {
  const { width = W, height = H, viewWidth = VW, viewHeight = VH, allowOverflow = false } = opts
  const left = parsePx(pos.left)
  const top = parsePx(pos.top)
  const fits = width <= viewWidth - 2 * EDGE_PADDING && height <= viewHeight - 2 * EDGE_PADDING

  if (!allowOverflow && fits) {
    if (left < EDGE_PADDING - 0.5) fail(`${label}: left=${left} 越过左边界`)
    if (left + width > viewWidth - EDGE_PADDING + 0.5) fail(`${label}: 右边越界 left+width=${left + width} > ${viewWidth - EDGE_PADDING}`)
    if (top < EDGE_PADDING - 0.5) fail(`${label}: top=${top} 越过上边界`)
    if (top + height > viewHeight - EDGE_PADDING + 0.5) fail(`${label}: 下边越界 top+height=${top + height} > ${viewHeight - EDGE_PADDING}`)
  }
  return { left, top }
}

// ---------- 1. 常规：锚点偏左下，右侧/上方都放得下 ----------
console.log('【1】常规位置（锚点在左下，右侧与上方都放得下）')
{
  const anchorX = 300
  const anchorY = 500
  const pos = computePopupPosition({ anchorX, anchorY, width: W, height: H, viewWidth: VW, viewHeight: VH })
  const { left, top } = checkInvariants('常规', pos)
  console.log(`      锚点(${anchorX},${anchorY}) → left=${left} top=${top}`)
  if (left === anchorX + SIDE_GAP) pass('放在锚点右侧')
  else fail(`期望 left=${anchorX + SIDE_GAP}，实际 ${left}`)
  if (top === anchorY - ANCHOR_LIFT - H) pass('底边对齐锚点上方（不遮挡建筑）')
  else fail(`期望 top=${anchorY - ANCHOR_LIFT - H}，实际 ${top}`)
  if (top + H + ANCHOR_LIFT === anchorY) pass('底边与锚点间距恰好等于 ANCHOR_LIFT')
  else fail('底边与锚点间距不符')
}

// ---------- 2. 回归：锚点靠下（就是截图里的情况） ----------
console.log('\n【2】回归：建筑靠下，浮窗不能溢出视口底部')
{
  const anchorX = 300
  const anchorY = 660 // 接近视口底部
  const pos = computePopupPosition({ anchorX, anchorY, width: W, height: H, viewWidth: VW, viewHeight: VH })
  const { left, top } = checkInvariants('靠下', pos)
  console.log(`      锚点(${anchorX},${anchorY}) → left=${left} top=${top}，底边=${top + H}`)
  if (top + H <= VH - EDGE_PADDING + 0.5) pass('浮窗完整落在视口内（这是修复的核心）')
  else fail(`仍溢出：底边 ${top + H} > ${VH - EDGE_PADDING}`)

  // 锚点被浮窗压住是可以接受的：宁可遮建筑，也不能让内容出屏
  if (top < anchorY) pass('浮窗仍位于锚点上方（只是整体下移了）')
  else fail('浮窗跑到锚点下方去了，与设计不符')
}

// ---------- 3. 锚点极靠下：底边刚好贴住留白 ----------
console.log('\n【3】锚点极靠下 —— 底边应贴住视口留白')
{
  const anchorY = 695
  const pos = computePopupPosition({ anchorX: 300, anchorY, width: W, height: H, viewWidth: VW, viewHeight: VH })
  const { top } = checkInvariants('极靠下', pos)
  // 期望 = min(自然位置, 下界钳制)。695-20-300=375 < 700-10-300=390，故取 375
  const natural = anchorY - ANCHOR_LIFT - H
  const maxTop = VH - EDGE_PADDING - H
  const expected = Math.min(natural, maxTop)
  console.log(`      锚点 y=${anchorY} → top=${top}，底边=${top + H}（视口 ${VH}）`)
  console.log(`      自然位置=${natural} 下界钳制=${maxTop} 期望=min=${expected}`)
  if (Math.abs(top - expected) <= 1) pass(`top=${top} 符合「不越下界且不超自然位置」`)
  else fail(`期望 top≈${expected}，实际 ${top}`)
  if (top + H <= VH - EDGE_PADDING + 0.5) pass('底边未越出视口留白')
  else fail(`底边越界：${top + H} > ${VH - EDGE_PADDING}`)
}

// ---------- 4. 水平翻转：锚点靠右 ----------
console.log('\n【4】锚点靠右 —— 水平翻到左侧')
{
  const anchorX = 1100
  const anchorY = 300
  const pos = computePopupPosition({ anchorX, anchorY, width: W, height: H, viewWidth: VW, viewHeight: VH })
  const { left } = checkInvariants('靠右', pos)
  console.log(`      锚点 x=1100 → left=${left}`)
  if (Math.abs(left - (anchorX - SIDE_GAP - W)) <= 1) pass('翻到锚点左侧')
  else fail(`期望 left≈${anchorX - SIDE_GAP - W}，实际 ${left}`)
}

// ---------- 5. 浮窗比视口还高：钉在顶部，交给内部滚动 ----------
console.log('\n【5】浮窗比视口还高 —— 钉在顶部（内部滚动兜底）')
{
  const tallH = 900
  const pos = computePopupPosition({ anchorX: 300, anchorY: 400, width: W, height: tallH, viewWidth: VW, viewHeight: VH })
  const { top } = checkInvariants('超高', pos, { height: tallH, allowOverflow: true })
  console.log(`      高=${tallH} 视口高=${VH} → top=${top}`)
  if (top === EDGE_PADDING) pass('钉在顶部，内容从第一条开始可见')
  else fail(`期望 top=${EDGE_PADDING}，实际 ${top}`)
}

// ---------- 6. 视口尺寸未知（首帧）：不能崩，也不做钳制 ----------
console.log('\n【6】视口尺寸未知（首帧兜底）')
{
  const pos = computePopupPosition({ anchorX: 300, anchorY: 500, width: W, height: H, viewWidth: 0, viewHeight: 0 })
  const left = parsePx(pos.left)
  const top = parsePx(pos.top)
  console.log(`      viewWidth=0 viewHeight=0 → left=${left} top=${top}`)
  if (left === 300 + SIDE_GAP && top === 500 - ANCHOR_LIFT - H) pass('退回无钳制的默认位置，不抛错')
  else fail('默认位置计算不符')
}

// ---------- 7. 锚点在视口左上角 ----------
console.log('\n【7】锚点在视口左上角 —— 两轴都应被钳进视口')
{
  const pos = computePopupPosition({ anchorX: 2, anchorY: 2, width: W, height: H, viewWidth: VW, viewHeight: VH })
  const { left, top } = checkInvariants('左上角', pos)
  console.log(`      锚点(2,2) → left=${left} top=${top}`)
  if (left >= EDGE_PADDING - 0.5 && top >= EDGE_PADDING - 0.5) pass('两轴都未越界')
  else fail('出现越界')
}

// ---------- 8. 穷举：锚点扫遍视口，不变量必须恒成立 ----------
console.log('\n【8】穷举扫描：锚点走遍视口，浮窗必须始终在界内')
{
  let violations = 0
  let checked = 0
  for (let x = -100; x <= VW + 100; x += 25) {
    for (let y = -100; y <= VH + 100; y += 25) {
      checked++
      const pos = computePopupPosition({ anchorX: x, anchorY: y, width: W, height: H, viewWidth: VW, viewHeight: VH })
      const left = parsePx(pos.left)
      const top = parsePx(pos.top)
      if (left < EDGE_PADDING - 0.5 || left + W > VW - EDGE_PADDING + 0.5 ||
          top < EDGE_PADDING - 0.5 || top + H > VH - EDGE_PADDING + 0.5) {
        if (violations < 3) console.log(`      越界: 锚点(${x},${y}) → left=${left} top=${top}`)
        violations++
      }
    }
  }
  console.log(`      共检查 ${checked} 个锚点位置`)
  if (violations === 0) pass('所有位置下浮窗都完整落在视口内')
  else fail(`${violations} 个位置越界`)
}

console.log('')
if (failures) {
  console.log(`失败 ${failures} 项`)
  process.exit(1)
}
console.log('全部通过 ✓ —— 浮窗在任何锚点位置下都不会溢出视口')
