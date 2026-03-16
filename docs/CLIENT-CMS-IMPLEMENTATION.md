# Client CMS implementation notes

## Architecture

```
Client site (e.g. mongsushi.no)
├── Website (existing)
├── npm: @asoldi/client-cms
├── Mount: /api/cms → createCmsRoutes({ hubUrl, siteKey, dataPath })
└── Route: /admin → <ClientCMS />

Hub (Asoldi website repo)
├── /superadmin → Super-admin UI (list sites, add site, set features)
└── GET /api/hub/site-config?site_key=xxx → { features, name }
```

- **Client data** (users, products, admin) is stored under `dataPath/cms/` on the **client’s** server (e.g. Hostinger). Not in the hub.
- **Feature flags** are in the hub; this package only reads them via the config endpoint.

## Ecommerce

- Products: `data/cms/products.json` (when using default store). Fields: `id`, `name`, `price`, `description`, `imageUrl`, `createdAt`.
- Image is a URL for now; the client project can add file upload and save a URL.
- To switch to a real DB (e.g. Hostinger MySQL), replace or extend the store in this package (or in the client project by overriding routes).

## Publishing

- From this repo: `npm publish` (with GitHub Packages or private registry for `@asoldi`).
- Consuming projects: `npm install @asoldi/client-cms`, mount routes and route, set env, deploy.
