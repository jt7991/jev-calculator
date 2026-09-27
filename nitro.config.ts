import { defineConfig } from 'nitro';
export default defineConfig({
  serverDir: './server',
  preset: 'node',
  // Register QUERY explicitly; its handler also rejects unsupported methods.
  ignore: ['api/calculate.query.ts'],
  routes: {
    '/api/calculate': {
      handler: './server/api/calculate.query.ts',
    },
  },
  routeRules: {
    '/': { headers: { 'cache-control': 'no-store' } },
    '/index.html': { headers: { 'cache-control': 'no-store' } },
  },
});
