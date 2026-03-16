# Universal CMS: client portal + agency super-admin

Two layers:

1. **Client CMS (this package)** – Your **clients** log in at **domain.com/admin** to manage their site: users, ecommerce products, (later) analytics. They only see their own data.
2. **Agency super-admin** – Lives in the **Asoldi website** repo at **that domain/superadmin**. **You** log in to manage clients and turn features (Ecommerce, Analytics, Users) on/off per site.

---

## Single per client + hub (recommended)

- **This package** is installed **per client site**. Each site has its own data (users, products) on its own server.
- **Hub** = super-admin in the Asoldi repo. It only stores: list of sites + feature flags. It does **not** store client products or users.
- **Flow:** Client project sets `CMS_HUB_URL` and `CMS_SITE_KEY`. When someone opens domain.com/admin, the CMS calls the hub, gets `{ features: { users, analytics, ecommerce } }`, and shows only those modules.

---

## Why single per client (not multi-tenant)

- **Speed:** No shared DB; each site’s traffic is isolated.
- **Easy install:** Same package in every project; only env changes.
- **Updates:** Publish new versions of `@asoldi/client-cms`; client projects run `npm update` and redeploy when ready.

Super-admin stays in the Asoldi website repo; it is **not** published as npm.
