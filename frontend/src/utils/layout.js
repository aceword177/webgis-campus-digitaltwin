/**
 * 浮窗定位计算（纯函数，不做任何 DOM / Cesium 依赖）。
 *
 * 抽成独立模块的原因：这段逻辑有一堆边界情况（靠下、靠右、比视口还高、
 * 视口尺寸未知……），纯函数才能用 Node 单测覆盖，避免又出现
 * "建筑靠下时内容被裁到看不见" 这类只在特定视角才暴露的问题。
 */

/** 浮窗与视口边缘的最小留白（像素） */
export const EDGE_PADDING = 10
/** 浮窗与锚点的水平间距 */
export const SIDE_GAP = 15
/** 锚点额外抬高量：让浮窗底边高于建筑顶部，不压住楼体正面 */
export const ANCHOR_LIFT = 20

/** 拿不到真实尺寸时的兜底（与 CSS 里的设计尺寸保持一致） */
export const FALLBACK_WIDTH = 288
export const FALLBACK_HEIGHT = 300

/**
 * 计算浮窗应放置的位置。
 *
 * 水平：默认放在锚点右侧 → 右侧放不下翻到左侧 → 再不行钳进视口
 * 垂直：默认底边对齐锚点上方（不遮挡楼体）→ 越界则整体下移，
 *       始终保持「底边对齐锚点」的相对关系（宁可压住建筑也不让内容出屏）
 *       → 浮窗比视口还高时钉在顶部，由 CSS 的 max-height 内部滚动兜底
 *
 * @param {object} p
 * @param {number} p.anchorX 锚点屏幕 X（像素）
 * @param {number} p.anchorY 锚点屏幕 Y（像素）
 * @param {number} p.width   浮窗宽度
 * @param {number} p.height  浮窗高度
 * @param {number} p.viewWidth  视口宽度（0 表示未知，跳过水平钳制）
 * @param {number} p.viewHeight 视口高度（0 表示未知，跳过垂直钳制）
 * @returns {{left: string, top: string}} 可直接绑定 :style 的像素字符串
 */
export function computePopupPosition({
  anchorX,
  anchorY,
  width = FALLBACK_WIDTH,
  height = FALLBACK_HEIGHT,
  viewWidth = 0,
  viewHeight = 0
}) {
  // ---- 水平 ----
  // 三条约束缺一不可（穷举扫描时右边界外的情况曾漏掉）：
  //   1. 默认贴锚点右侧
  //   2. 右侧放不下 → 翻到左侧
  //   3. 无论如何最终都得落在 [EDGE_PADDING, viewWidth-EDGE_PADDING-width] 内
  let left = anchorX + SIDE_GAP
  if (viewWidth) {
    if (left + width > viewWidth - EDGE_PADDING) {
      const flipped = anchorX - SIDE_GAP - width
      left = flipped >= EDGE_PADDING ? flipped : viewWidth - EDGE_PADDING - width
    }
    // 统一钳制：锚点跑到视口左右之外、或浮窗比视口还宽时，
    // 上面的分支给不出合法值，这里兜底
    const maxLeft = viewWidth - EDGE_PADDING - width
    if (maxLeft < EDGE_PADDING) {
      left = EDGE_PADDING // 浮窗比视口还宽：钉在左留白，右侧溢出由内容自适应
    } else {
      left = Math.max(EDGE_PADDING, Math.min(left, maxLeft))
    }
  }

  // ---- 垂直 ----
  let top = anchorY - ANCHOR_LIFT - height
  if (viewHeight) {
    // 上界：不能顶出视口顶部
    if (top < EDGE_PADDING) top = EDGE_PADDING
    // 下界：完整放得下时贴住底边留白；放不下则钉在顶部（内部滚动）
    const maxTop = viewHeight - EDGE_PADDING - height
    top = maxTop >= EDGE_PADDING ? Math.min(top, maxTop) : EDGE_PADDING
  }

  return {
    left: Math.round(left) + 'px',
    top: Math.round(top) + 'px'
  }
}

/** 把 '123px' 解析回数字，便于断言与外部复用 */
export function parsePx(value) {
  return parseFloat(String(value).replace('px', ''))
}
