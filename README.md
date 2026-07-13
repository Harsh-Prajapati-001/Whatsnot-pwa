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

## Configuration

- `wrangler.jsonc` contains the native Cloudflare Worker and static-asset
  configuration.
- `worker/index.ts` is the production Worker entry point.
- `vite.config.ts` provides the vinext and Cloudflare build integration.
- Local secrets belong in ignored `.env` files. Production secrets should be
  uploaded with `npx wrangler secret put SECRET_NAME` and must not be committed.

The application currently does not require D1 or R2. If persistent database or
file storage is added later, declare the corresponding bindings in
`wrangler.jsonc` before using them in application code.
