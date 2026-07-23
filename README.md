# Whatsnot PWA

Whatsnot is a progressive web application built with Next.js, vinext, and
Cloudflare Workers. Static PWA assets are served through Cloudflare's global
network while dynamic application requests run in a Worker.

## Requirements

- Node.js `>=22.13.0`
- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)

## Local development

```bash
npm install
npm run dev
```

Before publishing, verify the application locally:

```bash
npm test
npm run build
```

## First Cloudflare deployment

1. Sign in to Cloudflare from the project directory:

   ```bash
   npx wrangler login
   ```

2. Confirm that the correct Cloudflare account is selected:

   ```bash
   npx wrangler whoami
   ```

3. Build and publish the application:

   ```bash
   npm run deploy
   ```

Wrangler prints the public `workers.dev` address when publishing finishes. The
PWA can be installed from that HTTPS address in supported browsers.

## Automatic deployment through GitHub

The repository includes `.github/workflows/deploy.yml`. Every push to the
`main` branch runs the tests and code-quality checks, builds the production
application, and deploys the successful build to Cloudflare Workers.

Create these two GitHub Actions secrets under **Repository Settings → Secrets
and variables → Actions**:

- `CLOUDFLARE_ACCOUNT_ID`: the account ID shown in the Cloudflare dashboard or
  by `npx wrangler whoami`.
- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token created from the **Edit
  Cloudflare Workers** template.

Do not put either value directly in this repository. After both secrets exist,
push to `main` or open **Actions → Verify and deploy Whatsnot → Run workflow**.

## Later deployments

After changing the application, run the verification and deployment commands
again:

```bash
npm test
npm run build
npm run deploy
```

## Custom domain

After the first deployment, open **Cloudflare Dashboard → Workers & Pages →
whatsnot-pwa → Settings → Domains & Routes → Add → Custom Domain**. Enter a
domain already managed by the same Cloudflare account and follow the displayed
DNS instructions.

## Enable real Google sign-in and saved account data

The sign-in button stays disabled until every required Cloudflare setting is
present. It never falls through to a fake dashboard.

1. Create the database and copy the returned `database_id`:

   ```bash
   npx wrangler d1 create whatsnot-db
   ```

2. Add this top-level property to `wrangler.jsonc` (place a comma before it):

   ```jsonc
   "d1_databases": [
     {
       "binding": "DB",
       "database_name": "whatsnot-db",
       "database_id": "PASTE_THE_REAL_DATABASE_ID_HERE"
     }
   ]
   ```

3. Apply the included tables:

   ```bash
   npx wrangler d1 execute whatsnot-db --remote --file drizzle/0000_whatsnot_foundation.sql
   ```

4. In Google Cloud Console, create an OAuth 2.0 **Web application** client. Add
   this exact authorized redirect URI:

   ```text
   https://whatsnot-pwa.harshprajapati0756.workers.dev/api/auth/google/callback
   ```

5. Store the three values as encrypted Worker secrets (never commit them):

   ```bash
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET
   ```

   Use a long random value of at least 32 characters for `SESSION_SECRET`.

6. Deploy again with `npm run deploy`. Google now returns to the Worker, the
   Worker verifies the signed identity token, and the browser receives an
   HTTP-only session cookie.

## Configuration

- `wrangler.jsonc` contains the native Cloudflare Worker and static-asset
  configuration.
- `worker/index.ts` is the production Worker entry point.
- `vite.config.ts` provides the vinext and Cloudflare build integration.
- Local secrets belong in ignored `.env` files. Production secrets should be
  uploaded with `npx wrangler secret put SECRET_NAME` and must not be committed.

Authenticated users, sessions, notification systems and progress are stored in
Cloudflare D1. The checked-in configuration intentionally has no fake database
ID; add the binding only after Cloudflare gives you the real ID.
