import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Loosen rules that would be too noisy during the JS→TS migration
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-unused-vars': 'off', // handled by @typescript-eslint/no-unused-vars
      // Allow @ts-nocheck during JS→TS migration (remove once main.ts is fully typed)
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { minimumDescriptionLength: 3, 'ts-nocheck': false },
      ],
      // Intentional empty catch blocks (localStorage / fetch silently degrade)
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  eslintConfigPrettier,
);
