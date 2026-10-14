import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'
import ts from 'typescript-eslint'

export default defineConfig(
  { ignores: ['**/node_modules/', 'dist/', 'vendor/', 'php/'] },
  js.configs.recommended,
  ts.configs.strict,
  {
    languageOptions: { globals: { ...globals.node } },
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      // Ordre de standards-front adapté au dépôt : tiers, relatifs, types (pas de bibliothèque commune ni de couches)
      'simple-import-sort/imports': [
        'error',
        { groups: [['^node:', '^@?\\w'], ['^\\.'], ['^.+\\u0000$'], ['^\\u0000']] },
      ],
      'simple-import-sort/exports': 'error',
    },
  },
  prettier,
)
