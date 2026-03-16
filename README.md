# @asoldi/client-cms

Client CMS for Asoldi client sites: **users**, **ecommerce** (name, price, description, image URL), and hub-driven feature flags. Install in any client project; mount at `/api/cms`, show UI at `/admin`.

---

## What you need

- **Hub (super-admin):** Runs in the [Asoldi website](https://github.com/Damianhch/Asoldi-website) repo at **that domain/superadmin**. There you add client sites and turn features (Users, Analytics, Ecommerce) on/off.
- **This package:** Install in each **client** project so that **domain.com/admin** gives the client their CMS.

---

## Install in a client project

```bash
npm install @asoldi/client-cms
```

---

## 1. Add the site in the hub (once per client)

1. Open the hub: **https://your-hub-domain.com/superadmin** (e.g. asoldi.com/superadmin).
2. Log in (same credentials as that site’s /admin).
3. Click **Add site**, enter **Name** and **Domain** (e.g. mongsushi.no).
4. Enable features: Users, Ecommerce, Analytics (as needed).
5. Copy the **site key** and set it in the client project as `CMS_SITE_KEY`.

---

## 2. Backend: mount the CMS API

In the client project’s server (e.g. `server.js`), mount the routes **before** static/SPA:

```js
import express from 'express';
import createCmsRoutes from '@asoldi/client-cms';

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
- **dataPath** – Folder where this client’s CMS data is stored (e.g. `./data` → writes to `data/cms/users.json`, `products.json`, `admin.json`).

---

## 3. Frontend: add the /admin route

In the client’s React app (React Router):

```jsx
import { ClientCMS } from '@asoldi/client-cms/ClientCMS';

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

---

## Ecommerce

When Ecommerce is enabled for the site in the hub, the client sees the **Ecommerce** tab in `/admin`. They can add products with:

- **Name** (required)
- **Price** (number)
- **Description** (optional)
- **Image URL** (optional; paste a link; file upload can be added in the client project later)

Data is stored in **data/cms/products.json** on the client’s server. When they revisit `/admin`, the list is loaded from that file (or from a DB if you replace the store in your fork).

---

## Domain changes

If a client’s domain changes (e.g. test → asoldi.com), update the **Domain** in the hub for that site. **CMS_SITE_KEY** in the client project stays the same.

---

## See also

- **CONTEXT.md** – Overview for developers / Cursor so a new environment understands the setup.
- **docs/** – Strategy and implementation notes (single per client + hub, where data lives, etc.).
