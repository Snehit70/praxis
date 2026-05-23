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
  | VITE_API_BASE_URL=https://api.praxis.snehit70.dev
  | HTTPS API calls
  v
api.praxis.snehit70.dev
  |
  | A record, DNS-only
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
- API: `https://api.praxis.snehit70.dev`
- R2 public image base: `https://pub-38cbed42a577473eb75ea45c187c8d6f.r2.dev`

Cloudflare proxy status should stay **DNS-only** for both `praxis` and `api.praxis` in the current setup.

Reason:

- Vercel handles TLS for the frontend.
- The API host has its own Let's Encrypt certificate through Nginx.
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
VITE_API_BASE_URL=https://api.praxis.snehit70.dev bun run dev
```

## Production Frontend Deploy

Vercel builds the static frontend.

Required Vercel production env:

```text
VITE_API_BASE_URL=https://api.praxis.snehit70.dev
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
- `PRAXIS_API_SERVER_NAME`: `api.praxis.snehit70.dev`.
- `PRAXIS_API_ALLOWED_ORIGIN`: currently safe as `*` because the API is public read-only data.

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
https://praxis.snehit70.dev -> https://api.praxis.snehit70.dev
```

If API HTTPS breaks after a deploy, check whether the deploy workflow rewrote `/etc/nginx/conf.d/praxis-api.conf` back to an HTTP-only server block. Re-run Certbot if needed:

```bash
sudo certbot --nginx -d api.praxis.snehit70.dev --non-interactive --agree-tos --redirect -m atulyarai314@gmail.com
sudo nginx -t
sudo systemctl reload nginx
```

Longer term, update the deploy workflow before repeated API deploys so it preserves existing Certbot TLS config instead of replacing it.

## Health Checks

Local API on the AWS host:

```bash
curl -fsS http://127.0.0.1:8787/api/health
curl -fsS http://127.0.0.1:8787/api/health/db
curl -fsS http://127.0.0.1:8787/api/stats
```

Public API:

```bash
curl -fsS https://api.praxis.snehit70.dev/api/health
curl -fsS https://api.praxis.snehit70.dev/api/health/db
curl -fsS https://api.praxis.snehit70.dev/api/stats
```

Expected stats:

```json
{"examCount":4,"courseCount":130,"paperVariantCount":4939,"questionCount":116704}
```

HTTP should redirect to HTTPS:

```bash
curl -I http://api.praxis.snehit70.dev/api/health
```

Expected:

```text
301 Moved Permanently
Location: https://api.praxis.snehit70.dev/api/health
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
