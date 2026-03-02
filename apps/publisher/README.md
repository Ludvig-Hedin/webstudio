# Weblab Publisher Worker

A Cloudflare Worker that serves published Webstudio sites at `*.weblab.build`.

## Architecture

```
Designer clicks "Publish" in Builder
        ↓
Builder creates production build in DB
        ↓
deploymentRouter returns { success: true }
        ↓
Publisher Worker serves sites at *.weblab.build:
  1. Extracts subdomain from hostname → project domain
  2. Fetches build data from Supabase + Builder REST API
  3. Renders HTML from instance tree (styles, props, children)
  4. Caches result in KV (10min TTL)
  5. Returns HTML response
```

## Setup

### 1. Environment Variables

Create a `.dev.vars` file for local development:

```sh
SUPABASE_URL=https://dcsihtaqjibsrteuuofq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
BUILDER_ORIGIN=http://localhost:3000
BUILDER_API_TOKEN=<your-builder-api-token>
```

### 2. Cloudflare Setup

1. **Create a KV Namespace:**

   ```sh
   npx wrangler kv namespace create CACHE
   ```

   Update `wrangler.jsonc` with the returned KV namespace ID.

2. **Configure Environment Variables in Cloudflare:**

   ```sh
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   npx wrangler secret put BUILDER_ORIGIN
   npx wrangler secret put BUILDER_API_TOKEN
   ```

3. **DNS Setup:**
   Add a wildcard DNS record for `*.weblab.build` pointing to the Worker.

### 3. Development

```sh
npm install
npm run dev
```

The Worker will run locally at `http://localhost:8787`.
Test with: `curl -H "Host: myproject.weblab.build" http://localhost:8787/`

### 4. Deployment

```sh
npm run deploy
```

## API Endpoints

| Endpoint                 | Method | Description                                            |
| ------------------------ | ------ | ------------------------------------------------------ |
| `/__health`              | GET    | Health check                                           |
| `/__purge?domain=<name>` | POST   | Cache purge (requires `Authorization: Bearer <token>`) |
| `/assets/<filename>`     | GET    | Asset proxy (proxies to builder's asset CDN)           |
| `/*`                     | GET    | Page rendering                                         |

## How It Works

1. **Request Routing**: The Worker intercepts all `*.weblab.build` requests
2. **Project Lookup**: Extracts subdomain → finds project in Supabase DB
3. **Build Fetching**: Gets latest published build data from Builder REST API
4. **HTML Rendering**: Traverses instance tree, maps components to HTML tags, generates CSS from styles
5. **Caching**: Stores rendered HTML in KV with 10-minute TTL
6. **Asset Serving**: Proxies asset requests to builder's asset CDN

## Limitations (MVP)

- No JavaScript interactivity (static HTML only)
- No form submissions (planned for Phase 2)
- No CMS/dynamic data (planned for Phase 2)
- Simplified CSS — uses basic style resolution, not the full SDK pipeline
- No custom domain support yet (planned for Phase 3)
