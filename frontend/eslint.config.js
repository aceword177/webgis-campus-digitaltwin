import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

/**
 * ESLint 扁平配置（ESLint 9）。
 *
 * 定位：**静态检查**，补 `npm run build` 查不出的那类问题——
 * 未使用变量/导入、未定义变量、可疑的空比较、Vue 模板里的常见误用。
 *
 * 刻意把"格式类"规则关掉（交给编辑器/Prettier），只留真正能发现 bug 的规则，
 * 避免满屏缩进告警把有意义的提示淹掉。
 */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**']
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{js,mjs,vue}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // Cesium 由 vite-plugin-cesium 注入的全局，如未显式 import 时使用
        Cesium: 'readonly'
      }
    },
    rules: {
      // ---- 能发现真 bug 的规则：保持 error/warn ----
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none'
      }],
      'no-undef': 'error',
      'no-constant-condition': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-cond-assign': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-loss-of-precision': 'error',

      // ---- Vue ----
      // 组件名允许单词（如 Sidebar / App），项目里无命名冲突
      'vue/multi-word-component-names': 'off',
      // 模板里属性换行等纯风格规则关掉
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/attributes-order': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      // 这个规则在本项目会误报：我们在模板里用了 `?.` 可选链与自定义指令
      'vue/no-v-html': 'off',
      // 有意义的告警：v-for 缺 key、模板里用了未定义属性等
      'vue/require-v-for-key': 'error',
      'vue/no-use-v-if-with-v-for': 'error',
      'vue/no-parsing-error': 'error'
    }
  },

  // 验证/工具脚本（scripts/）跑在 Node 里，会用到 process、node:fs 等。
  // 只对本目录放开 node 全局，**不要**并进上面的公共块——
  // 否则 src/ 里的浏览器代码误用 process 时，no-undef 就抓不到了。
  {
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  }
]
