import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Pacote próprio, com tsconfig e dependências separadas.
    "functions/**",
  ]),
  {
    rules: {
      // Descarte explícito em desestruturação (ex.: tirar pinHash do objeto
      // antes de devolver ao client) é intencional, não sobra de código.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],

      /*
       * Buscar dados no efeito de montagem é o padrão aqui: as telas do curador
       * carregam via rotas de API autenticadas, e o setState acontece depois do
       * await, não de forma síncrona. A regra não distingue os dois casos, então
       * fica como aviso em vez de erro.
       */
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
