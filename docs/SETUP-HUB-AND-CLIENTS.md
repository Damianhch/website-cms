# Hub and client CMS – setup

## Hub (not in this repo)

The **super-admin** is in the **Asoldi website** repo. You access it at **that domain/superadmin** (e.g. https://asoldi.com/superadmin). There you:

- Add client sites (name + domain + website plan).
- Copy the **site key** for each.
- Turn **Users**, **Analytics**, **Ecommerce**, **Blog**, and **Social sync** on/off per site.
- When Ecommerce is on, pick catalog type: **menu**, **tiers**, or **normal**.

## This package (client CMS)

- Published as **@damianhch/client-cms**.
- Install in each **client** project. Mount at `/api/cms`, route `/admin` to `<ClientCMS />`, set **CMS_HUB_URL** and **CMS_SITE_KEY** in env.
- When the client opens domain.com/admin, they see only the modules you enabled in the hub.
- Public catalog for the live site: `GET /api/cms/catalog`.

## Adding a new client

1. In the **hub** (/superadmin): Add site (name, domain, plan, catalog type), enable features, copy site key.
2. In the **client project**: `npm install @damianhch/client-cms`, mount routes, add `/admin` route, set env.
3. Deploy. domain.com/admin then shows the client CMS with the granted features.

## Domain changes

If a client’s domain changes, edit the site in the hub and set the new domain. **CMS_SITE_KEY** in the client project does not change.
