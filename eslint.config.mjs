import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // TODO(deuda): 23 sitios de set-state-in-effect pendientes de limpieza gradual (ver auditoría).
  // Degradado a warn para que el CI pueda gatear sobre errores reales; re-promover a error
  // a medida que se limpian y exista suite e2e.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Los tests usan `any` para simular datos/mocks livianos: es un patrón común y limpio ahí.
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
