# Deployment Runbook

This is the current production deployment model for Praxis.

## Current Architecture

```text
User browser
  |
  | HTTPS
  v
praxis.snehit70.dev
  |
  | CNAME, DNS-only
  v
Vercel static frontend
  |
  | VITE_API_BASE_URL=https://praxis-api.snehit70.dev
  | HTTPS API calls
  v
praxis-api.snehit70.dev
  |
  | A record, Cloudflare proxy and edge rate limiting
  v
AWS EC2 host
  |
  | Nginx + Let's Encrypt certificate
  v
127.0.0.1:8787
  |
  v
Docker container: praxis-api
  |
  | Docker network: praxis-net
  v
Docker container: praxis-postgres

Images:
  Browser -> Cloudflare R2 public bucket
```

## Live Domains

- Frontend: `https://praxis.snehit70.dev`
- API: `https://praxis-api.snehit70.dev`
- R2 public image base: `https://pub-38cbed42a577473eb75ea45c187c8d6f.r2.dev`

Cloudflare proxy status is **DNS-only** for the Vercel frontend `praxis` and **Proxied** for `praxis-api`. The legacy `api.praxis` record stays DNS-only for HTTPS redirects.

Reason:

- Vercel handles TLS for the frontend.
- Cloudflare terminates public API HTTPS; Nginx also has its own Let's Encrypt certificate for the origin.
- This matches the working FieldForce pattern.

## Runtime Services

On the AWS host:

- `praxis-api`: Bun API Docker container.
- `praxis-postgres`: Postgres Docker container.
- `nginx`: reverse proxy and TLS termination.
- `certbot`: Let's Encrypt certificate management.

The API container binds only to localhost:

```text
127.0.0.1:8787 -> praxis-api:8787
```

Postgres is also local/private:

```text
127.0.0.1:5432 -> praxis-postgres:5432
praxis-net -> internal Docker access from praxis-api
```

## Data Sources

Runtime data is Postgres, not Convex.

Current imported dataset snapshot:

- Exams: `4`
- Courses: `130`
- Paper variants: `4939`
- Questions: `116704`

Images are not stored in Postgres. They are served from Cloudflare R2:

- `question_images/`
- `option_images/`

Local scraped data directories are intentionally ignored by git:

- `data/`
- `data-new/`
- `images/`
- `images-new/`
- `reports/`

## Local Development

Check whether the server is already running before starting another one:

```bash
ss -ltnp | rg ':8787|:5173'
```

Start the API:

```bash
DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres bun run api
```

Start the frontend:

```bash
bun run dev
```

If using the production API from local frontend:

```bash
VITE_API_BASE_URL=https://praxis-api.snehit70.dev bun run dev
```

## Production Frontend Deploy

Vercel builds the static frontend. `vercel.json` rewrites unknown paths to `index.html` so client routes (`/home`, `/sign-in`, `/paper/...`) do not 404 on refresh or after Clerk redirects.

Required Vercel production env:

```text
VITE_API_BASE_URL=https://praxis-api.snehit70.dev
```

Deploy manually:

```bash
vercel --prod
```

If Vercel upload fails due to request size, confirm `.vercelignore` excludes scraped data, reports, images, logs, local env files, and build output.

## Production API Deploy

API deploy is handled by GitHub Actions:

```text
.github/workflows/deploy-api-aws-ssh.yml
```

It runs on pushes to `main` that touch API/deploy inputs, or through manual `workflow_dispatch`.

Required GitHub secrets:

```text
AWS_SSH_HOST
AWS_SSH_USER
AWS_SSH_PORT
AWS_SSH_PRIVATE_KEY
PRAXIS_DEPLOY_PATH
PRAXIS_API_DATABASE_URL
PRAXIS_API_ALLOWED_ORIGIN
PRAXIS_API_SERVER_NAME
```

Expected values by role:

- `PRAXIS_DEPLOY_PATH`: absolute path on the AWS host, for example `/home/ec2-user/praxis-api`.
- `PRAXIS_API_DATABASE_URL`: container-network database URL, for example `postgres://praxis:<password>@praxis-postgres:5432/praxis`.
- `PRAXIS_API_SERVER_NAME`: `praxis-api.snehit70.dev`.
- `PRAXIS_API_ALLOWED_ORIGIN`: use `https://praxis.snehit70.dev` in production. This also sets Clerk's authorized frontend origin; CORS alone does not stop scraping.
- `PRAXIS_CLERK_SECRET_KEY`: backend Clerk secret. Optional if the host `.env.api` already has `CLERK_SECRET_KEY`; the deploy merges and will not blank it.
- `PRAXIS_CLERK_PUBLISHABLE_KEY`: same Clerk publishable key the frontend uses (`pk_...`).
- `PRAXIS_PDF_DOWNLOADS_ENABLED`: optional. Set to `off` to kill all PDF downloads. Defaults to on.
- `PRAXIS_PDF_RATE_LIMIT_BYPASS_USER_IDS`: optional comma-separated Clerk user ids that skip PDF rate limits.

`/api/me/*` (saved courses, bookmarks, history, PDF download) returns 401 if the API container has no Clerk secret. The env write step now keeps existing host keys instead of replacing the whole file.

PDF downloads are capped at 3 per 5 minutes, 8 per hour, and 24 per day per signed-in user. Chromium also refuses extra renders when 2 are already in flight.

To let one person through without a deploy:

```sql
UPDATE users
SET pdf_rate_limit_bypass = true
WHERE clerk_user_id = 'user_xxx';
```

To shut PDFs off immediately on the host, set `PDF_DOWNLOADS_ENABLED=off` in `.env.api` and restart `praxis-api`.

The workflow:

1. Validates deploy secrets.
2. Syncs the repository to the AWS host with scraped data excluded.
3. Writes `.env.api` on the host.
4. Builds/restarts `praxis-api` with Docker Compose.
5. Verifies local API health.
6. Verifies the public API domain when `PRAXIS_API_SERVER_NAME` is configured.

## Important TLS Warning

The API must be served over HTTPS. If the frontend calls an HTTP API from the HTTPS Vercel site, browsers block it as mixed content.

Current working state:

```text
https://praxis.snehit70.dev -> https://praxis-api.snehit70.dev
```

If API HTTPS breaks after a deploy, check whether the deploy workflow rewrote `/etc/nginx/conf.d/praxis-api.conf` back to an HTTP-only server block. Re-run Certbot if needed:

```bash
sudo certbot --nginx -d praxis-api.snehit70.dev --non-interactive --agree-tos --redirect -m atulyarai314@gmail.com
sudo nginx -t
sudo systemctl reload nginx
```

Longer term, update the deploy workflow before repeated API deploys so it preserves existing Certbot TLS config instead of replacing it.

## Health Checks

### Content scraping controls

Paper details and question JSON require a verified Clerk session. The frontend
sends a bearer token for both requests. Catalogue, search, and aggregate stats
remain public. Paper JSON uses `private, no-store` so shared caches cannot serve
authenticated content to anonymous clients.

New paper access is limited per account to 10 distinct papers per rolling minute,
60 per rolling hour, and 200 per rolling 24 hours. A Postgres advisory lock
serializes admissions per account across API instances. Each grant is tied to
that account and the resolved database paper variant, and lasts 24 hours.
Reloads and concurrent requests for an already-opened paper reuse its grant,
even when the account has hit a new-paper limit. Expired grants are cleaned up
hourly during content access. Question navigation and answer selection stay
client-side. PDF limits remain separate and unchanged.

When Turnstile is configured, opening a new paper after 5 distinct papers in a
minute or 20 in an hour requires verification. Existing grants bypass this check.
The widget appears before content loads, never during a loaded practice run.
The server calls Cloudflare Siteverify, requires the expected hostname and
`paper-access` action, and checks `cdata` against a hash of the signed-in user.
Turnstile tokens are single-use; a successful check admits one new paper, not
unlimited access. Verification failures or outages do not admit new challenged
papers, but do not revoke existing grants. Configure all three backend vars:

```text
TURNSTILE_SITE_KEY=<public widget site key>
TURNSTILE_SECRET_KEY=<secret widget key>
TURNSTILE_HOSTNAME=praxis.snehit70.dev
```

No Turnstile credentials means only account/IP quotas apply. A partial
configuration fails startup. The deployment env merge preserves these host vars.
Never put the secret in Vite env vars or commit it. The widget is scoped to the
production frontend hostname; use Cloudflare test keys in isolated development.

All API requests also have a process-local ceiling of 240 per IP per minute,
including OPTIONS and authentication failures. This ceiling resets on restart;
account grants do not. The IP comes from the socket, or `X-Real-IP` only when the
socket peer is the local nginx proxy. The deploy workflow discovers the Docker
network gateway and writes `API_TRUSTED_PROXY_IPS` into the host env. Keep Docker's
localhost-only API binding.
Nginx uses `server/nginx-cloudflare.conf` to trust `CF-Connecting-IP` only from
Cloudflare's published networks, and forwards `$praxis_client_ip` as `X-Real-IP`.
Refresh that network list when Cloudflare changes it. Multiple API replicas would
need a shared IP limiter.

For a proxied API, set `CLOUDFLARE_PROXY_ENABLED=true` in the host `.env.api` only
after verifying HTTPS works through Cloudflare. The workflow then denies direct
origin requests to `/api/`, preventing bypass of edge rules. Local container
health checks on port 8787 continue working. Before reverting to DNS-only,
remove the nginx direct-origin restriction and unset this flag first.

The active API hostname is `praxis-api.snehit70.dev`, a first-level hostname
covered by the zone's free Universal SSL certificate. It is proxied through
Cloudflare. The former `api.praxis.snehit70.dev` remains DNS-only and redirects
to the new API after migration. It does not serve paper data directly. Existing
browser tabs should refresh to load the token-sending frontend and new API URL.
Do not enable zone-wide Bot Fight Mode for a Praxis-only change, since the zone
also hosts unrelated sites.

Blocked requests return HTTP 429 with `Retry-After` and are logged. Selective
verification uses HTTP 403 with `verification_required`, site key, and account
binding. Public R2 URLs and content already copied by users remain copyable;
multiple accounts/IPs can spread collection.

Deploy the frontend token-sending change before the API auth requirement. The
API needs its existing Clerk secret and publishable keys. After deployment,
check that anonymous paper details/questions return 401, signed-in practice
still loads, and successful paper responses have `Cache-Control: private,
no-store`. Old clients must refresh. Previously cached public responses may
remain accessible until their existing cache lifetime expires.

Local API on the AWS host:

```bash
curl -fsS http://127.0.0.1:8787/api/health
curl -fsS http://127.0.0.1:8787/api/health/db
curl -fsS http://127.0.0.1:8787/api/stats
```

Public API:

```bash
curl -fsS https://praxis-api.snehit70.dev/api/health
curl -fsS https://praxis-api.snehit70.dev/api/health/db
curl -fsS https://praxis-api.snehit70.dev/api/stats
```

Expected stats:

```json
{"examCount":4,"courseCount":130,"paperVariantCount":4939,"questionCount":116704}
```

HTTP should redirect to HTTPS:

```bash
curl -I http://praxis-api.snehit70.dev/api/health
```

Expected:

```text
301 Moved Permanently
Location: https://praxis-api.snehit70.dev/api/health
```

## Database Backup And Restore

Create a local dump from any Postgres instance:

```bash
pg_dump "$DATABASE_URL" > praxis.sql
```

Restore into a target Postgres:

```bash
psql "$DATABASE_URL" < praxis.sql
```

For the AWS Docker Postgres setup, prefer restoring through a trusted shell session on the host and never commit dumps or credentials.

## R2 Images

The frontend builds image URLs in `src/lib/imageUtils.ts`.

Current object layout:

```text
question_images/<filename>
option_images/<filename>
```

Use `rclone copy` rather than `sync` when uploading to R2 unless deletion is explicitly intended.

Example:

```bash
rclone copy images-new/question_images r2:praxis-images/question_images
rclone copy images-new/option_images r2:praxis-images/option_images
```

## CI

Main CI:

```text
.github/workflows/ci.yml
```

It runs:

- `bun install --frozen-lockfile`
- `bun run test:unit`
- `bun run test:integration`
- `bun run build`

Auto version bump:

```text
.github/workflows/version-bump.yml
```

It bumps package version on conventional `feat:` and `fix:` commits to `main`.
