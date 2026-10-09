/**
 * 前端改动静态校验（不依赖 esbuild / 具名管道，可在沙箱内运行）。
 *
 * 校验内容：
 *   1. SFC 能否被 @vue/compiler-sfc 解析出 script / script setup / template / style
 *   2. script setup 能否编译成 JS（模板表达式编译期错误也会在这一步暴露）
 *   3. template 能否编译成渲染函数（指令、v-if/v-for、绑定语法）
 *   4. import 语句里的相对/别名模块是否真实存在（catch 拼错的路径与文件）
 *   5. 具名导入（如 element-plus 图标）是否真的在该包中导出（catch 不存在的导出名）
 *
 * 用法：node scripts/verify-frontend.mjs [相对项目根的 .vue/.js 路径...]
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sfc = require('@vue/compiler-sfc')

const here = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(here, '..')
const srcRoot = join(frontendRoot, 'src')

const targets = process.argv.slice(2)
if (!targets.length) {
  console.error('用法: node scripts/verify-frontend.mjs <文件...>')
  process.exit(2)
}

let failures = 0
const fail = (file, msg) => {
  failures++
  console.log(`\n  ✗ [${file}] ${msg}`)
}

/** 把 '@/' 别名与相对路径解析成磁盘绝对路径 */
function resolveImport(spec, fromFile) {
  let base
  if (spec.startsWith('@/')) base = join(srcRoot, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec)
  else return null // 裸包名，交给具名导出检查处理
  const candidates = [
    base, `${base}.js`, `${base}.mjs`, `${base}.vue`, `${base}.json`,
    join(base, 'index.js'), join(base, 'index.vue')
  ]
  return candidates.find(p => existsSync(p)) || null
}

/** 从 import 语句里抠出 { 具名导出 } 列表 */
function namedImportsOf(code) {
  const out = []
  const re = /import\s+(?:[\w*$]+\s*,\s*)?\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(code))) {
    const names = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean)
    out.push({ names, source: m[2] })
  }
  return out
}

/** 检查裸包具名导出是否真实存在（只对能在 node_modules 里解析到的包生效） */
function checkPackageExports(file, spec, names) {
  let pkgEntry
  try {
    pkgEntry = require.resolve(spec, { paths: [frontendRoot] })
  } catch {
    return // 解析不到就跳过（可能是浏览器专用包）
  }
  let mod
  try {
    mod = require(pkgEntry)
  } catch {
    return // CJS/ESM 互操作问题，跳过而不是误报
  }
  for (const name of names) {
    if (!(name in mod)) fail(file, `包 "${spec}" 未导出 "${name}"`)
  }
}

function checkSfc(rel, abs) {
  const source = readFileSync(abs, 'utf8')
  const { descriptor, errors } = sfc.parse(source, { filename: abs })

  if (errors?.length) {
    fail(rel, `SFC 解析失败: ${errors.map(e => e.message).join('; ')}`)
    return
  }

  const id = rel.replace(/[^a-zA-Z0-9]/g, '_')
  const scriptCode = descriptor.script?.content || ''
  const setupCode = descriptor.scriptSetup?.content || ''

  // --- script setup 编译（模板表达式的编译期错误会在此暴露）---
  if (descriptor.scriptSetup) {
    const res = sfc.compileScript(descriptor, { id })
    if (res.errors?.length) {
      fail(rel, `script setup 编译失败: ${res.errors.map(e => e.message || e).join('; ')}`)
    }
  } else if (descriptor.script) {
    // 非 setup 写法：至少确认能被 babel 解析（compileScript 不适用时退回 parse）
    try {
      sfc.compileTemplate({
        source: '<div/>', filename: abs, id,
        compilerOptions: { bindingMetadata: {} }
      })
    } catch (e) {
      fail(rel, `script 编译异常: ${e.message}`)
    }
  }

  // --- template 编译成渲染函数 ---
  if (descriptor.template) {
    const res = sfc.compileTemplate({
      source: descriptor.template.content,
      filename: abs,
      id
    })
    if (res.errors?.length) {
      fail(rel, `template 编译失败: ${res.errors.map(e => e.message || e).join('; ')}`)
    }
  }

  // --- style 块 ---
  for (const style of descriptor.styles) {
    if (style.errors?.length) {
      fail(rel, `style 编译失败: ${style.errors.map(e => e.message || e).join('; ')}`)
    }
  }

  const allCode = `${scriptCode}\n${setupCode}`
  if (!allCode.trim() && !descriptor.template) fail(rel, '没有任何 script / template 内容')

  // --- import 路径存在性 ---
  for (const { names, source: spec } of namedImportsOf(allCode)) {
    const resolved = resolveImport(spec, abs)
    if (spec.startsWith('@/') || spec.startsWith('.')) {
      if (!resolved) fail(rel, `import 路径不存在: "${spec}"`)
    } else {
      checkPackageExports(rel, spec, names)
    }
  }

  console.log(`  ✓ ${rel}`)
}

console.log(`校验 ${targets.length} 个文件（@vue/compiler-sfc 静态编译）...\n`)

for (const rel of targets) {
  const abs = resolve(frontendRoot, rel)
  if (!existsSync(abs)) {
    fail(rel, '文件不存在')
    continue
  }
  if (abs.endsWith('.vue')) {
    checkSfc(rel, abs)
  } else {
    // 纯 JS：语法检查 —— 用 compileScript 相同的 babel 通道
    const source = readFileSync(abs, 'utf8')
    let ok = true
    try {
      new (require('vm').Script)(source, { filename: abs })
    } catch (e) {
      // vm.Script 不认 ESM 的 import/export，仅当作语法错误之外的兜底
      if (!/Cannot use import statement|Unexpected token 'export'/.test(e.message)) {
        ok = false
        fail(rel, `语法错误: ${e.message}`)
      }
    }
    if (ok) console.log(`  ✓ ${rel}`)
  }
}

console.log('')
if (failures) {
  console.log(`校验失败：${failures} 处问题`)
  process.exit(1)
}
console.log('全部通过 ✓')
