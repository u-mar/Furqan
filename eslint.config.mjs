import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: ['.next/**', 'node_modules/**', '*.config.js', 'scripts/**', 'android/**', 'native/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // A hook after an early return crashes the page ("This page couldn't load") the first time that
  // return is passed, as Now playing did: caught here instead.
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error' },
  },
]
