import { Router } from 'express';
import { buildSpec } from './openapi.js';

const SWAGGER = 'https://unpkg.com/swagger-ui-dist@5.17.14';
export const docsRoutes = Router();
const spec = buildSpec();
const on = () => process.env.PCI_DOCS !== 'false';

docsRoutes.get('/api/v1/openapi.json', (_req, res) => { if (!on()) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }); res.setHeader('Cache-Control', 'public, max-age=300'); res.json(spec); });
docsRoutes.get('/docs/init.js', (_req, res) => {
  if (!on()) return res.status(404).end();
  res.type('application/javascript').send("window.ui=SwaggerUIBundle({url:'/api/v1/openapi.json',dom_id:'#swagger',deepLinking:true,tryItOutEnabled:true,supportedSubmitMethods:['get']});");
});
docsRoutes.get('/docs', (_req, res) => {
  if (!on()) return res.status(404).end();
  // Only this page may load Swagger UI from the CDN; the rest of the API keeps its strict defaults.
  res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'self' ${SWAGGER}; style-src ${SWAGGER} 'unsafe-inline'; img-src 'self' data: https:; font-src ${SWAGGER} data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'`);
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PCI public API</title><link rel="stylesheet" href="${SWAGGER}/swagger-ui.css"></head><body><div id="swagger"></div><script src="${SWAGGER}/swagger-ui-bundle.js"></script><script src="/docs/init.js"></script></body></html>`);
});
