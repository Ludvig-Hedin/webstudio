# Webstudio Self-Hosting Guide (Vercel + Supabase)

## Phase 1: Supabase (Database & API)

Webstudio requires PostgreSQL _and_ PostgREST. Supabase provides both out of the box.

### Step 1: Create Supabase Project

1. Go to [database.new](https://database.new) and create a new project.
2. Go to **Project Settings -> Database**.
3. Scroll down to **Connection parameters** and copy your `URI` (Ensure you check "Use connection pooling"). This is your `DATABASE_URL`.
   _It will look like: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`_
4. Also copy the Direct connection URI (Uncheck connection pooling). This is your `DIRECT_URL`.
   _It will look like: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`_

### Step 2: Get PostgREST Keys

1. Go to **Project Settings -> API**.
2. Copy the **Project URL**. This is your `POSTGREST_URL`.
   _It will look like: `https://[ref].supabase.co/rest/v1`_
3. Copy the **`anon` `public` API Key**. This is your `POSTGREST_API_KEY`.

### Step 3: Run Migrations on Supabase

You need to create all of Webstudio's tables in your new Supabase database.

1. In your local terminal (still inside the `web-studio` folder), temporarily export your Supabase URLs:

```bash
export DATABASE_URL="your_supabase_pooler_url"
export DIRECT_URL="your_supabase_direct_url"
```

1. Run the Prisma migrations:

```bash
pnpm --filter=@webstudio-is/prisma-client migrations push
```

_Note: We use `push` instead of `migrate` for the initial schema sync to avoid lockfile issues if Supabase has default tables._

---

## Phase 2: Vercel (Hosting the App)

Yes, the whole app will work on Vercel! `apps/builder` is a Remix app that Vercel natively understands and compiles into Serverless Edge Functions. You do not need to host a separate Node server if you use Vercel.

### Step 1: Connect to Vercel

1. Push your local `web-studio` repository to your GitHub account.
2. Go to Vercel and **Add New Project**.
3. Import your `web-studio` repository.
4. **Crucial:** In the "Framework Preset", it should auto-detect "Remix".
5. Under **Root Directory**, click Edit and select `apps/builder`.

### Step 2: Add Environment Variables

Before clicking Deploy, expand the **Environment Variables** section and add the exact following keys:

#### Database & API (From Phase 1)

- `DATABASE_URL`: `[Your Supabase Pooler URI]`
- `DIRECT_URL`: `[Your Supabase Direct URI]`
- `POSTGREST_URL`: `[Your Supabase Project URL]/rest/v1`
- `POSTGREST_API_KEY`: `[Your Supabase anon key]`

#### Auth & Secrets

- `AUTH_SECRET`: Generate a random string (e.g. run `openssl rand -hex 32` in your terminal and paste it here).
- `DEV_LOGIN`: `false` _(Set to false for production to disable the secret dev login)_
- `GH_CLIENT_ID`: `[Your GitHub OAuth Client ID]` _(Required for users to log in)_
- `GH_CLIENT_SECRET`: `[Your GitHub OAuth Client Secret]`

#### Domain & Publisher Networking

- `PUBLISHER_HOST`: `yourdomain.com` _(The root domain you will use, e.g., webstudio.yourname.com)_
- `TRPC_SERVER_API_TOKEN`: Generate another random string (e.g., `openssl rand -hex 32`). Used for internal server-to-server communication.
- `SECURE_COOKIE`: `true`

### Step 3: Deploy

Click **Deploy**! Vercel will build the `apps/builder` workspace and spin up the frontend and backend endpoints.

---

## Phase 3: Custom Domains & Publishing

**Question**: _Do we need to handle Custom Domains now? Will it work for users to publish if I don't buy a domain right now?_

**Answer**: It will work initially on your `.vercel.app` domain for you to log in and use the builder. However, **users cannot properly publish live sites without a custom domain.**

Here is why: Webstudio dynamically mounts user sites onto subdomains.
If your `PUBLISHER_HOST` is `my-studio.com`, when a user publishes project `123`, it tries to host it at `p-123.my-studio.com`.

### How to set up domains (when you are ready)

1. Buy a domain via Vercel, Cloudflare, or Namecheap (e.g., `my-studio.com`).
2. In Vercel, go to your Project Settings -> Domains.
3. Add `my-studio.com`.
4. **Important**: Add a wildcard domain `*.my-studio.com` to Vercel as well.
5. In your DNS provider, set up a Wildcard CNAME record: `*` points to `cname.vercel-dns.com`.
6. Make sure your `PUBLISHER_HOST` environment variable in Vercel is set to exactly that domain (`my-studio.com`).

Now, everything is fully end-to-end self-hosted!
