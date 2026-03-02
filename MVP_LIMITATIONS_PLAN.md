# Plan: Addressing MVP Limitations in Publisher Worker

The current MVP of the Publisher Worker is a lightweight, edge-rendering solution that serves static HTML and CSS directly from Supabase build data. However, to match Webstudio's full feature set, we need to address several key limitations.

## 1. Simplified CSS & Rendering Fidelity

**Current Limitation:** The Worker parses Webstudio's `styles` and `breakpoints` JSON and generates simplified raw CSS. It manually traverses the `instances` tree to output basic HTML tags.
**Why it matters:** Advanced CSS (like multi-layered box shadows, dynamic tokens, complex grids, or pseudo-classes) and complex components (like Tabs, Accordions, or external React components) won't render exactly as they appear in the builder.
**The Fix:**

- **Integrate the Webstudio SDK (`@webstudio-is/sdk`)**: Instead of our manual HTML/CSS string concatenation, use Webstudio's native `RootInstance` component and `createCssEngine`.
- **Server-Side Rendering (SSR)**: Use `renderToString` from `react-dom/server` inside the Cloudflare Worker. We pass the fetched build data into the SDK's components exactly like the builder's preview mode does.
- **Result:** 100% visual fidelity matching the designer.

## 2. No JavaScript Interactivity

**Current Limitation:** The Worker returns only static HTML and CSS.
**Why it matters:** Any interactive components (like mobile menus, tabs, accordions, or interactive form validation) won't work once published.
**The Fix:**

- **Client-Side Hydration Scripts**: The Webstudio builder compiles client-side Javascript for interactive components. The Worker needs to inject `<script>` tags pointing to these compiled assets.
- **Asset Integration**: We will modify the Worker's HTML template to include the hydration bundles generated during the `production build` step.

## 3. No Form Submissions

**Current Limitation:** Forms render statically but have no backend to process submissions.
**Why it matters:** Sites can't capture leads or contact requests.
**The Fix:**

- **Webstudio API Proxy**: The Worker will intercept a standard `POST /__forms` endpoint (or similar).
- **Forwarding to Backend**: The Worker will correctly forward form submissions to Webstudio's backend API, using the project's ID to store the submission in the database or trigger email notifications.
- **Alternative:** Forward form actions straight to external webhooks (e.g., Make, Zapier).

## 4. CMS & Dynamic Data

**Current Limitation:** Pages are entirely static, displaying only the exact text present at build time. Dynamic content blocks are empty.
**Why it matters:** Users can't create blogs, portfolios, or manage growing content without opening the builder.
**The Fix:**

- **Evaluate Data Sources at the Edge**: Webstudio supports "Data Resources" (e.g., fetching a list of CMS items).
- **Implementation**: The Worker will need to execute the queries/fetch requests defined in the project's data sources _before_ rendering the page. The fetched data will then be injected into the component props during the SSR process.

## 5. Custom Domain Support

**Current Limitation:** All projects are served under `*.weblab.build`.
**Why it matters:** SaaS customers expect to use their own domains (e.g., `www.theircompany.com`).
**The Fix:**

- **Cloudflare Custom Hostnames (Cloudflare for SaaS)**: Use the Cloudflare API to dynamically create Custom Hostnames for user domains.
- **Database Mapping**: Add a new table or field in Supabase mapping custom domains (e.g., `theircompany.com`) to `project.id`.
- **Worker Update**: The Worker's `extractSubdomain` logic will be updated to first check if the `host` matches any known Custom Domain in the database. If so, it processes the request for the corresponding project.
- **SSL**: Cloudflare handles SSL certificate generation automatically for these dynamic hostnames.
