import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'prisma/generated/**', 'artifacts/**', '**/next-env.d.ts'] },
  { files: ['**/*.ts', '**/*.tsx'], extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: { '@typescript-eslint/consistent-type-imports': 'error' } },
);
