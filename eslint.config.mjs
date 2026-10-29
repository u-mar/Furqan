import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: ['.next/**', 'node_modules/**', '*.config.js', 'scripts/**', 'android/**', 'native/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
]
