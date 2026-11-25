import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([".scratch/", "dist/", "node_modules/", "playwright-report/", "test-results/", "tests/fixtures/", "coverage/"]),
  {
    files: ["**/*.{js,ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.tsx"],
    extends: [jsxA11y.flatConfigs.recommended],
    plugins: { "react-hooks": reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      // Caixa de tabela com rolagem horizontal precisa receber foco para rolar pelo teclado (regra do axe).
      "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["tabpanel", "region"] }],
    },
  },
  {
    files: ["server/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts", "e2e/**/*.ts", "*.config.{js,ts}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
]);
