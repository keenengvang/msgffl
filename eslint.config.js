import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// FSD import rule: app → routes → pages → widgets → features → entities → shared,
// downward only. Each layer lists the layers it may NOT import from.
const forbidden = {
  pages: ['app', 'routes'],
  widgets: ['app', 'routes', 'pages'],
  features: ['app', 'routes', 'pages', 'widgets'],
  entities: ['app', 'routes', 'pages', 'widgets', 'features'],
  shared: ['app', 'routes', 'pages', 'widgets', 'features', 'entities'],
};

const fsdZones = Object.entries(forbidden).map(([layer, uppers]) => ({
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: uppers.map((upper) => ({
          group: [`@/${upper}/*`],
          message: `FSD violation: ${layer}/ may not import from ${upper}/ (imports flow downward only).`,
        })),
      },
    ],
  },
}));

export default tseslint.config(
  { ignores: ['dist', 'legacy', 'src/routeTree.gen.ts'] },
  {
    files: ['e2e/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.node },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs.flat['recommended-latest']],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
  },
  // Netlify Functions: server-side, node globals, no React
  {
    files: ['netlify/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.node },
  },
  ...fsdZones,
);
