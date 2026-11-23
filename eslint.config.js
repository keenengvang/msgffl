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

// A failed fetch swallowed into an empty success gets cached as truth: forever
// for a complete season, and persisted. It shipped six times (PR #5 ×4, #22,
// #30/#31), was still live in four loaders and the chain's discovery, and the
// server carried a workaround for it. Every shape below is the same mistake.
const EMPTY = [
  'ArrayExpression[elements.length=0]',
  'ObjectExpression[properties.length=0]',
  "Literal[raw='null']",
  "Identifier[name='undefined']",
  'NewExpression[callee.name=/^(Map|Set|Array)$/][arguments.length=0]',
];
const empties = (parentAndField) =>
  EMPTY.flatMap((e) => {
    const [parent, field] = parentAndField;
    return [`${parent} > ${e}.${field}`, `${parent} > TSAsExpression.${field} > ${e}.expression`];
  });
const HANDLER = ':matches(ArrowFunctionExpression, FunctionExpression)';
const ON_ERROR = [
  "CallExpression[callee.property.name='catch']",
  "CallExpression[callee.property.name='then'][arguments.length=2]",
];
const SWALLOW_SELECTORS = [
  // .catch(() => []) and .then(ok, () => [])
  ...ON_ERROR.flatMap((c) => empties([`${c} > ArrowFunctionExpression`, 'body'])),
  // .catch(() => { return []; }) and .catch(function () { return []; })
  ...ON_ERROR.flatMap((c) => empties([`${c} > ${HANDLER} ReturnStatement`, 'argument'])),
  // .catch(fallbackToEmpty)
  "CallExpression[callee.property.name='catch'] > Identifier.arguments",
  // try { … } catch { return []; }
  ...empties(['CatchClause ReturnStatement', 'argument']),
  // try { … } catch { /* best-effort */ }
  'CatchClause > BlockStatement.body[body.length=0]',
];
const SWALLOW_MESSAGE =
  "A failed fetch must reject, not resolve to empty data: the query caches it as truth (forever for a complete season, and persisted). Let it throw and load through a rejecting loader like loadSeasonWeeks (src/entities/matchup/lib/loadSeasonWeeks.ts); consumers show <ErrorPanel> on `error && !data`. A deliberate fallback takes an eslint-disable-next-line with the reason it is needed.";
const emptyFallback = {
  files: ['src/**/*.{ts,tsx}', 'netlify/**/*.ts'],
  ignores: ['**/*.test.ts', 'src/routeTree.gen.ts'],
  rules: {
    'no-restricted-syntax': ['error', ...SWALLOW_SELECTORS.map((selector) => ({ selector, message: SWALLOW_MESSAGE }))],
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
