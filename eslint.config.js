import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Build output, deps, and the generated splash art (a single template literal).
    ignores: ["dist/**", "out/**", "node_modules/**", "coverage/**", "src/assets/splash-art.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      // Bun runtime: Node globals plus the `Bun` namespace (used in update.ts).
      globals: { ...globals.node, Bun: "readonly" },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  // Must stay last: turns off rules that would fight Prettier's formatting.
  prettier,
);
