# @damianhch/client-cms

Client CMS for Asoldi client sites: **users**, **typed ecommerce** (menu / tiers / normal), and hub-driven feature flags (users, ecommerce, blog, social sync, analytics). Install in any client project; mount at `/api/cms`, show UI at `/admin`.

Package version: **1.1.0**.

---

## What you need

- **Hub (super-admin):** Runs in the [Asoldi website](https://github.com/Damianhch/asoldi-website) repo at **that domain/superadmin**. There you add client sites, pick a website plan, turn features on/off, and choose an ecommerce catalog type.
- **This package:** Install in each **client** project so that **domain.com/admin** gives the client their CMS.

---

## Install in a client project

```bash
npm install @damianhch/client-cms
```

---

## 1. Add the site in the hub (once per client)

1. Open the hub: **https://your-hub-domain.com/superadmin** (e.g. asoldi.com/superadmin).
2. Log in (same credentials as that site’s /admin).
3. Click **Add site**, enter **Name**, **Domain**, and **Website plan**.
4. If the plan includes a shop (or you enable Ecommerce later), pick **catalog type**: menu, tiers, or normal products.
5. Copy the **site key** and set it in the client project as `CMS_SITE_KEY`.

---

## 2. Backend: mount the CMS API

In the client project’s server (e.g. `server.js`), mount the routes **before** static/SPA:

```js
import express from 'express';
import createCmsRoutes from '@damianhch/client-cms';

const app = express();
app.use(express.json());

app.use(
  '/api/cms',
  createCmsRoutes({
    hubUrl: process.env.CMS_HUB_URL,
    siteKey: process.env.CMS_SITE_KEY,
    dataPath: process.env.CMS_DATA_PATH || './data',
  })
);

// Then your static, SPA fallback, etc.
```

- **hubUrl** – Root URL of the site that runs the hub (no trailing slash).
- **siteKey** – From the hub (Super Admin → Add site → Copy).
- **dataPath** – Folder where this client’s CMS data is stored (e.g. `./data` → writes to `data/cms/users.json`, `products.json`, `categories.json`, `admin.json`).

---

## 3. Frontend: add the /admin route

In the client’s React app (React Router):

```jsx
import { ClientCMS } from '@damianhch/client-cms/ClientCMS';

// In your router:
<Route path="/admin" element={<ClientCMS />} />
```

Optionally hide the main site nav/footer when `pathname === '/admin'`.

---

## 4. Env on the client host

Set on the server (e.g. Hostinger env):

- **CMS_HUB_URL** – Hub root URL (e.g. `https://asoldi.com`).
- **CMS_SITE_KEY** – Site key from the hub for this client.

Optional (first-run admin account):

- **CMS_ADMIN_USERNAME** / **CMS_ADMIN_PASSWORD** – Default admin for this client’s CMS (defaults: `admin` / `changeme`).
- **CMS_PUBLIC_URL** – Public site origin used in hub heartbeats (e.g. `https://mongsushi.no`). If unset, the CMS infers it from the incoming request host.

---

## Ecommerce catalog

When Ecommerce is enabled for the site in the hub, `/admin` shows the **Ecommerce** tab. The form matches the hub **catalog type**:

| Catalog type | Categories | Product fields |
|---|---|---|
| **menu** | Yes (groups) | name, price, description, image, category, allergens |
| **tiers** | No | name, price, bullets, CTA, optional image |
| **normal** | Yes (tabs) | name, subtitle, description, price, image, category |

Admin CRUD is authenticated. The public storefront should read:

```
GET /api/cms/catalog
→ { catalogType, name, categories, products }
```

That endpoint returns **404** when ecommerce is off. Product data stays on the client server (`data/cms/products.json` and `data/cms/categories.json`). Existing flat `{name, price, description, imageUrl}` rows are migrated in place.

---

## Hub config and heartbeats

`GET /api/cms/config` proxies the hub and adds this package version:

```
{
  features: { users, analytics, ecommerce, blog, socialSync },
  name, id,
  ecommerceCatalogType,
  websitePlan,
  desiredCmsVersion,
  packageVersion
}
```

On each config load the CMS POSTs `{CMS_HUB_URL}/api/hub/heartbeat` with `site_key`, `packageVersion`, and `adminUrl` so the hub can show last-seen version for fleet updates.

---

## Domain changes

If a client’s domain changes, update the **Domain** in the hub for that site. **CMS_SITE_KEY** in the client project stays the same.

---

## See also

- **CONTEXT.md** – Overview for developers / Cursor so a new environment understands the setup.
- **docs/** – Strategy and implementation notes (single per client + hub, where data lives, etc.).
