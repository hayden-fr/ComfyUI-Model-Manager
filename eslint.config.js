import pluginJs from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tsEslint from 'typescript-eslint'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ['src/**/*.{js,mjs,cjs,ts,vue}'],
  },
  {
    ignores: ['src/scripts/*', 'src/types/shims.d.ts', 'src/utils/legacy.ts'],
  },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tsEslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['src/**/*.vue'],
    languageOptions: { parserOptions: { parser: tsEslint.parser } },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
