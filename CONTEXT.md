# Context for Cursor / developers

This repo is **@asoldi/client-cms**: the **client-facing CMS package** that gets installed on each client website (e.g. mongsushi.no, or any site built by Asoldi). It is **not** the super-admin; the super-admin lives in the main Asoldi website repo.

---

## What this package does

- **Client CMS** = the UI and API that **clients** (business owners) use at **domain.com/admin** to manage:
  - **Users** – staff logins for that site (e.g. “ansatt” login).
  - **Ecommerce** – simple products: name, price, description, image URL. Data is stored per site (e.g. `data/cms/products.json` or later a real DB on Hostinger).
  - **Analytics** – placeholder for now; later connect GA or Business Profile.
- **Hub-driven features:** Which modules (Users, Analytics, Ecommerce) are visible is controlled by a **hub** (super-admin). Each client project sets `CMS_HUB_URL` and `CMS_SITE_KEY`; on load the CMS calls the hub and only shows the enabled modules.

---

## Where things live

| What | Where |
|------|--------|
| **This package** | npm: `@asoldi/client-cms`. GitHub: https://github.com/Damianhch/website-cms |
| **Hub (super-admin)** | Asoldi website repo. URL: that site’s `/superadmin` (e.g. asoldi.com/superadmin). You add client sites there and set features (ecommerce on/off, etc.). |
| **Client data** | On each client’s server: users, products, admin credentials. This package writes to `dataPath/cms/` (e.g. `./data/cms/users.json`, `products.json`). |
| **Feature flags** | Stored in the hub; this package only reads them via `GET /api/hub/site-config?site_key=...`. |

---

## How a client project uses this package

1. **Install:** `npm install @asoldi/client-cms`
2. **Backend:** Mount the routes at `/api/cms`:
   ```js
   import createCmsRoutes from '@asoldi/client-cms';
   app.use('/api/cms', createCmsRoutes({
     hubUrl: process.env.CMS_HUB_URL,
     siteKey: process.env.CMS_SITE_KEY,
     dataPath: './data',
   }));
   ```
3. **Frontend:** Add route for `/admin` that renders the CMS UI:
   ```js
   import { ClientCMS } from '@asoldi/client-cms/ClientCMS';
   <Route path="/admin" element={<ClientCMS />} />
   ```
4. **Env (e.g. Hostinger):** `CMS_HUB_URL`, `CMS_SITE_KEY` (and optionally `CMS_ADMIN_USERNAME`, `CMS_ADMIN_PASSWORD` for first-run admin).

The hub is **not** in this repo; it stays in the Asoldi website project. This repo only contains what gets npm-published for client sites.

---

## Ecommerce data

- Products are stored in the **client’s** data folder: `dataPath/cms/products.json`.
- Each product has: `id`, `name`, `price`, `description`, `imageUrl`, `createdAt`.
- Image is currently a **URL** field (client can paste a link or later you can add file upload to the client project and store a URL). No file upload inside the package by default.
- When the agency enables “Ecommerce” for a site in the super-admin, the Ecommerce tab appears in that client’s `/admin` and they can add/edit/delete products; data is saved to that site’s server only.

---

## Publishing and updates

- **Publish:** From this repo, `npm publish` (after configuring GitHub Packages or your private registry for scope `@asoldi`).
- **Consuming projects** use `npm install @asoldi/client-cms` and mount the routes + route as above. When you release a new version (e.g. new UI or new module), client projects run `npm update @asoldi/client-cms` and redeploy.
- Super-admin stays in the Asoldi website repo; no need to republish it with the package.

---

## Summary

- **This repo** = client CMS package only (users, ecommerce, future analytics). Publish as `@asoldi/client-cms`.
- **Super-admin** = in the Asoldi website repo; you manage client sites and feature flags there.
- **Client sites** = install this package, set env, mount `/api/cms` and `/admin`; their data lives on their server (or Hostinger DB when you add DB support).
