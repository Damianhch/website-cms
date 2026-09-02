import express from 'express';
import createCmsRoutes, { mountCmsAdmin } from './server/routes.js';

process.env.CMS_DEV_ECOMMERCE = process.env.CMS_DEV_ECOMMERCE || '1';
process.env.CMS_DEV_CATALOG_TYPE = process.env.CMS_DEV_CATALOG_TYPE || 'menu';
process.env.CMS_DEV_EMAIL = process.env.CMS_DEV_EMAIL || '1';
process.env.CMS_DEV_BLOG = process.env.CMS_DEV_BLOG || '1';
process.env.CMS_DEV_ANALYTICS = process.env.CMS_DEV_ANALYTICS || '1';
process.env.CMS_DEV_GENERAL = process.env.CMS_DEV_GENERAL || '1';

const port = Number(process.env.PORT || 3044);
const app = express();
app.use(express.json());
app.use(
  '/api/cms',
  createCmsRoutes({
    dataPath: process.env.CMS_DATA_PATH || new URL('./.dev-data', import.meta.url).pathname,
    hubUrl: '',
    siteKey: 'local-dev',
    adminSecret: 'local-dev-secret',
  })
);
mountCmsAdmin(app);
app.listen(port, '0.0.0.0', () => {
  console.log(`CMS dev listening on ${port}`);
});
