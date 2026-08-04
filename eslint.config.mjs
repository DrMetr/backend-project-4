/*
import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
*/

//export default defineConfig([
//  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
//  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
//]);

import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node, // добавляем Node.js глобальные переменные
        ...globals.jest, // добавляем Jest глобальные переменные (test, expect)
      },
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "module",
    },
  },
]);
