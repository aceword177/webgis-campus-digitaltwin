/**
 * 用无头 Edge + CDP 抓取前端页面的**真实运行时错误**。
 *
 * 背景：DataCloneError 这类错误只在浏览器运行时出现，静态编译校验抓不到。
 * 本脚本用 Node 内置 WebSocket（Node 22+）直连 CDP，
 * 收集 console 消息与未捕获异常，输出完整堆栈。
 *
 * 前置：需先启动一个开了远程调试端口的 Edge，例如
 *   msedge.exe --headless=new --remote-debugging-port=9222 --user-data-dir=<tmp> about:blank
 *
 * 用法：node scripts/capture-runtime-errors.mjs http://localhost:5173/ [持续秒数] [调试端口]
 */
const targetUrl = process.argv[2] || 'http://localhost:5173/'
const durationSec = Number(process.argv[3] || 25)
const debugPort = Number(process.argv[4] || 9222)

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function waitForTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`)
      const list = await res.json()
      const page = list.find(t => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page
    } catch { /* 端口还没起来，继续等 */ }
    await sleep(500)
  }
  throw new Error(`等不到 CDP 目标（端口 ${debugPort}）`)
}

/** 把 CDP 的 RemoteObject 转成可读文本 */
function describe(arg, depth = 0) {
  if (!arg) return String(arg)
  if (arg.type === 'string') return arg.value
  if (arg.type === 'number' || arg.type === 'boolean') return String(arg.value)
  if (arg.type === 'undefined') return 'undefined'
  if (arg.subtype === 'null') return 'null'
  if (arg.type === 'function') return arg.description?.split('\n')[0] || '[function]'
  if (arg.preview?.properties && depth < 2) {
    const inner = arg.preview.properties
      .map(p => `${p.name}: ${p.type === 'object' ? '{…}' : p.value}`)
      .join(', ')
    return `${arg.description || arg.className || arg.type} { ${inner} }`
  }
  return arg.description || arg.className || arg.type
}

const errors = []
const consoleMsgs = []

function onEvent(msg) {
  const { method, params } = msg

  if (method === 'Runtime.exceptionThrown') {
    const d = params.exceptionDetails
    const text = d.exception?.description || d.text || '未知异常'
    errors.push(text)
    console.log('\n=========== 未捕获异常 ===========')
    console.log(text)
    if (d.url) console.log(`  位置: ${d.url}:${d.lineNumber}:${d.columnNumber}`)
    if (d.stackTrace?.callFrames?.length) {
      console.log('  调用栈:')
      d.stackTrace.callFrames.slice(0, 12).forEach(f => {
        console.log(`    at ${f.functionName || '(匿名)'} (${f.url}:${f.lineNumber}:${f.columnNumber})`)
      })
    }
  }

  if (method === 'Runtime.consoleAPICalled') {
    const text = (params.args || []).map(a => describe(a)).join(' ')
    consoleMsgs.push({ level: params.type, text })
    const isProblem = params.type === 'error' || params.type === 'warning'
    // 过滤 Cesium 自身的常规提示，避免淹没真正的问题
    console.log(`[console.${params.type}] ${text.slice(0, 600)}`)
    if (isProblem && /clone|worker|postMessage|pickPosition/i.test(text)) {
      errors.push(`console.${params.type}: ${text}`)
    }
  }

  if (method === 'Log.entryAdded') {
    const e = params.entry
    console.log(`[log.${e.level}] ${e.text?.slice(0, 600)}`)
    if (e.level === 'error') errors.push(`log: ${e.text}`)
  }
}

const target = await waitForTarget()
console.log(`已连接 CDP 目标: ${target.url}\n导航到: ${targetUrl}\n持续抓取 ${durationSec}s ...\n`)

const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }))

await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve)
  ws.addEventListener('error', reject)
})

ws.addEventListener('message', ev => {
  let msg
  try { msg = JSON.parse(ev.data) } catch { return }
  if (msg.method) onEvent(msg)
})

send('Runtime.enable')
send('Log.enable')
send('Page.enable')
await sleep(300)
send('Page.navigate', { url: targetUrl })

await sleep(durationSec * 1000)

console.log('\n=========== 汇总 ===========')
console.log(`console 消息: ${consoleMsgs.length} 条`)
console.log(`问题（异常/含 clone|worker 的错误日志）: ${errors.length} 处`)
if (errors.length) {
  console.log('--- 去重后的关键信息 ---')
  ;[...new Set(errors)].forEach(e => console.log('  • ' + e.split('\n')[0].slice(0, 300)))
}

ws.close()
process.exit(errors.length ? 1 : 0)
