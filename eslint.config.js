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

// A failed Sleeper request swallowed into an empty success (`.catch(() => [])`)
// gets cached as truth — forever for a complete season, and persisted. It has
// shipped six times (PR #5 ×4, #22, #30/#31) and was still live in three loaders.
const emptyFallback = {
  files: ['src/entities/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}', 'netlify/lib/**/*.ts', 'netlify/functions/**/*.ts'],
  ignores: ['**/*.test.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression:matches([body.type='ArrayExpression'], [body.type='ObjectExpression'], [body.type='TSAsExpression'][body.expression.type=/^(ArrayExpression|ObjectExpression)$/], [body.type='Literal'][body.raw='null'], [body.type='Identifier'][body.name='undefined'])",
        message:
          "A failed fetch must reject, not resolve to empty data: the query caches it as truth (forever for a complete season, and persisted). Let it throw and load through a rejecting loader like loadSeasonWeeks (src/entities/matchup/lib/loadSeasonWeeks.ts); consumers show <ErrorPanel> on `error && !data`. A deliberate fallback takes an eslint-disable-next-line with its reason, an expiry date and who approved it.",
      },
    ],
  },
};

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
  emptyFallback,
);
