/**
 * Publisher Worker — Serves published Webstudio sites at *.weblab.build
 *
 * Architecture:
 * 1. Request arrives at projectname.weblab.build/path
 * 2. Worker extracts "projectname" from the subdomain
 * 3. Fetches build data from Supabase (Project → Build → page data)
 * 4. Generates HTML from the build data (CSS + component tree)
 * 5. Returns the HTML response (cached via Cache API)
 *
 * This Worker handles ALL published sites from a single deployment.
 * No per-site deployment step is needed — new builds are picked up automatically.
 */

import { createClient } from "@supabase/supabase-js";

export interface Env {
  // Supabase connection
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  // Publisher config
  PUBLISHER_HOST: string;
  // Builder origin for fetching build data via REST API and cache purge auth
  BUILDER_ORIGIN: string;
  // KV namespace for caching rendered pages
  CACHE: KVNamespace;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const host = request.headers.get("host") || "";

    // Extract subdomain from the request hostname
    // e.g., "mysite.weblab.build" → "mysite"
    const publisherHost = env.PUBLISHER_HOST || "weblab.build";
    const subdomain = extractSubdomain(host, publisherHost);

    // API endpoint: Cache purge (called by the builder after publish)
    // POST /__purge?domain=mysite with Authorization header
    if (url.pathname === "/__purge" && request.method === "POST") {
      return handleCachePurge(url, request, env);
    }

    // API endpoint: Health check
    if (url.pathname === "/__health") {
      return new Response(JSON.stringify({ status: "ok", host }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (!subdomain) {
      return new Response("Not Found — no project specified", { status: 404 });
    }

    // Asset proxy: serve assets from the builder's asset CDN
    // /assets/filename.ext → proxy to builder's asset server
    if (url.pathname.startsWith("/assets/")) {
      return handleAssetRequest(url, subdomain, env);
    }

    // Check cache first (use subdomain + pathname as cache key)
    const cacheKey = `${subdomain}:${url.pathname}`;
    const cached = await env.CACHE.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=600",
          "x-publisher-cache": "hit",
        },
      });
    }

    try {
      // Fetch build data from the builder's REST API
      const buildData = await fetchBuildData(subdomain, env);

      if (!buildData) {
        return new Response(
          generateErrorPage(
            "Site Not Found",
            `No published site found for "${subdomain}.${publisherHost}".`
          ),
          {
            status: 404,
            headers: { "content-type": "text/html; charset=utf-8" },
          }
        );
      }

      // Find the page matching the requested path
      const page = findPageByPath(buildData, url.pathname);

      if (!page) {
        return new Response(
          generateErrorPage(
            "Page Not Found",
            `The page "${url.pathname}" does not exist on this site.`
          ),
          {
            status: 404,
            headers: { "content-type": "text/html; charset=utf-8" },
          }
        );
      }

      // Render the page to HTML
      const html = renderPage(buildData, page, url);

      // Cache the rendered HTML (10 minutes TTL)
      ctx.waitUntil(env.CACHE.put(cacheKey, html, { expirationTtl: 600 }));

      return new Response(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=600",
          "x-publisher-cache": "miss",
        },
      });
    } catch (error) {
      console.error("Publisher error:", error);
      return new Response(
        generateErrorPage(
          "Server Error",
          "Something went wrong while rendering this page."
        ),
        { status: 500, headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }
  },
} satisfies ExportedHandler<Env>;

/**
 * Handle cache purge requests from the builder after publish
 * POST /__purge?domain=mysite
 * X-Builder-Origin: <builder_origin>
 */
async function handleCachePurge(
  url: URL,
  request: Request,
  env: Env
): Promise<Response> {
  // Verify the request comes from a trusted builder origin
  const builderOrigin = request.headers.get("X-Builder-Origin");
  if (!builderOrigin || builderOrigin !== env.BUILDER_ORIGIN) {
    return new Response("Unauthorized", { status: 401 });
  }

  const domain = url.searchParams.get("domain");
  if (!domain) {
    return new Response("Missing domain parameter", { status: 400 });
  }

  // List all cached keys for this domain and delete them
  const keys = await env.CACHE.list({ prefix: `${domain}:` });
  const deletePromises = keys.keys.map((key) => env.CACHE.delete(key.name));
  await Promise.all(deletePromises);

  return new Response(
    JSON.stringify({ success: true, purged: keys.keys.length }),
    { headers: { "content-type": "application/json" } }
  );
}

/**
 * Handle asset requests by proxying to the builder's asset server
 * /assets/filename.ext → builder origin's asset CDN
 */
async function handleAssetRequest(
  url: URL,
  _subdomain: string,
  env: Env
): Promise<Response> {
  // Proxy the asset request to the builder's asset server
  // The builder serves assets at /cgi/asset/<filename>
  const assetName = url.pathname.replace("/assets/", "");
  const assetUrl = `${env.BUILDER_ORIGIN}/cgi/asset/${assetName}`;

  const response = await fetch(assetUrl);
  if (!response.ok) {
    return new Response("Asset not found", { status: 404 });
  }

  // Return the asset with long cache headers (assets have unique hashed names)
  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");

  return new Response(response.body, { headers });
}

/**
 * Extract the subdomain from a hostname
 * "mysite.weblab.build" with publisherHost "weblab.build" → "mysite"
 */
function extractSubdomain(host: string, publisherHost: string): string | null {
  // Remove port if present
  const hostname = host.split(":")[0];

  // Check if the hostname ends with the publisher host
  if (!hostname.endsWith(publisherHost)) {
    return null;
  }

  // Extract everything before the publisher host
  const prefix = hostname.slice(0, -(publisherHost.length + 1)); // +1 for the dot
  return prefix || null;
}

/**
 * Build data types (matches what the builder's /rest/build/$buildId returns)
 */
interface BuildData {
  build: {
    id: string;
    projectId: string;
    pages: {
      homePage: PageData;
      pages: PageData[];
      meta?: {
        siteName?: string;
        faviconAssetId?: string;
        code?: string;
        contactEmail?: string;
      };
    };
    breakpoints: [string, BreakpointData][];
    styles: [string, StyleData][];
    styleSources: [string, StyleSourceData][];
    styleSourceSelections: [string, StyleSourceSelectionData][];
    props: [string, PropData][];
    instances: [string, InstanceData][];
    dataSources: [string, DataSourceData][];
    resources: [string, ResourceData][];
  };
  assets: AssetData[];
  pages: PageData[];
}

interface PageData {
  id: string;
  name: string;
  path: string;
  title: string;
  rootInstanceId: string;
  systemDataSourceId?: string;
  meta: {
    description?: string;
    title?: string;
    language?: string;
    documentType?: string;
    socialImageAssetId?: string;
    excludePageFromSearch?: boolean;
    custom?: Array<{ property: string; content: string }>;
  };
}

interface BreakpointData {
  id: string;
  minWidth?: number;
  maxWidth?: number;
}

interface StyleData {
  styleSourceId: string;
  breakpointId: string;
  property: string;
  value: unknown;
}

interface StyleSourceData {
  id: string;
  type: string;
  name?: string;
}

interface StyleSourceSelectionData {
  instanceId: string;
  values: string[];
}

interface PropData {
  id: string;
  instanceId: string;
  name: string;
  type: string;
  value: unknown;
}

interface InstanceData {
  id: string;
  type: string;
  component: string;
  tag?: string;
  children: Array<{ type: string; value: string }>;
}

interface DataSourceData {
  id: string;
  scopeInstanceId?: string;
  type: string;
  resourceId?: string;
}

interface ResourceData {
  id: string;
  url: string;
  method: string;
  headers: Array<{ name: string; value: string }>;
}

interface AssetData {
  id: string;
  name: string;
  type: string;
  format?: string;
  meta?: Record<string, unknown>;
}

/**
 * Fetch build data for a project domain directly from Supabase
 *
 * The Build table stores all page/instance/prop/style data as JSON text columns.
 * We query Supabase directly with the service role key to avoid needing
 * the builder's session-based authentication.
 */
async function fetchBuildData(
  projectDomain: string,
  env: Env
): Promise<BuildData | null> {
  const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Find the project by its domain name
  const { data: project, error: projectError } = await supabase
    .from("Project")
    .select("id, domain, title")
    .eq("domain", projectDomain)
    .eq("isDeleted", false)
    .single();

  if (projectError || !project) {
    console.error("Project not found:", projectDomain, projectError);
    return null;
  }

  // Find the latest published build for this project
  // Published builds have a non-null deployment field
  const { data: build, error: buildError } = await supabase
    .from("Build")
    .select(
      "id, projectId, pages, breakpoints, styles, styleSources, styleSourceSelections, props, instances, dataSources, resources"
    )
    .eq("projectId", project.id)
    .not("deployment", "is", null)
    .order("createdAt", { ascending: false })
    .limit(1)
    .single();

  if (buildError || !build) {
    console.error(
      "No published build found for project:",
      project.id,
      buildError
    );
    return null;
  }

  // Fetch assets for the project
  const { data: assets } = await supabase
    .from("Asset")
    .select("id, name")
    .eq("projectId", project.id);

  // Parse JSON text columns into structured data
  // The Build table stores these as text containing JSON
  const parsedPages =
    typeof build.pages === "string" ? JSON.parse(build.pages) : build.pages;
  const parsedBreakpoints =
    typeof build.breakpoints === "string"
      ? JSON.parse(build.breakpoints)
      : build.breakpoints;
  const parsedStyles =
    typeof build.styles === "string" ? JSON.parse(build.styles) : build.styles;
  const parsedStyleSources =
    typeof build.styleSources === "string"
      ? JSON.parse(build.styleSources)
      : build.styleSources;
  const parsedStyleSourceSelections =
    typeof build.styleSourceSelections === "string"
      ? JSON.parse(build.styleSourceSelections)
      : build.styleSourceSelections;
  const parsedProps =
    typeof build.props === "string" ? JSON.parse(build.props) : build.props;
  const parsedInstances =
    typeof build.instances === "string"
      ? JSON.parse(build.instances)
      : build.instances;
  const parsedDataSources =
    typeof build.dataSources === "string"
      ? JSON.parse(build.dataSources)
      : build.dataSources;
  const parsedResources =
    typeof build.resources === "string"
      ? JSON.parse(build.resources)
      : build.resources;

  return {
    build: {
      id: build.id,
      projectId: build.projectId,
      pages: parsedPages,
      breakpoints: parsedBreakpoints,
      styles: parsedStyles,
      styleSources: parsedStyleSources,
      styleSourceSelections: parsedStyleSourceSelections,
      props: parsedProps,
      instances: parsedInstances,
      dataSources: parsedDataSources,
      resources: parsedResources,
    },
    assets: (assets || []).map((a) => ({
      id: a.id,
      name: a.name,
      type: "asset",
    })),
    pages: parsedPages.pages || [],
  };
}

/**
 * Find a page in the build data that matches the requested path
 */
function findPageByPath(
  buildData: BuildData,
  pathname: string
): PageData | null {
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");

  // Check homepage first
  const homePage = buildData.build.pages.homePage;
  if (normalizedPath === "/" || normalizedPath === homePage.path) {
    return homePage;
  }

  // Check all other pages
  for (const page of buildData.build.pages.pages) {
    if (page.path === normalizedPath) {
      return page;
    }
  }

  return null;
}

/**
 * Component-to-HTML tag mapping for basic Webstudio components
 * This handles the most common components used in Webstudio sites.
 */
const COMPONENT_TAG_MAP: Record<string, string> = {
  Body: "body",
  Box: "div",
  Heading: "h1",
  HeadingH1: "h1",
  HeadingH2: "h2",
  HeadingH3: "h3",
  HeadingH4: "h4",
  HeadingH5: "h5",
  HeadingH6: "h6",
  Paragraph: "p",
  Text: "span",
  TextBlock: "div",
  Link: "a",
  Image: "img",
  Button: "button",
  Form: "form",
  Input: "input",
  Textarea: "textarea",
  Label: "label",
  Separator: "hr",
  Blockquote: "blockquote",
  List: "ul",
  ListItem: "li",
  Bold: "strong",
  Italic: "em",
  Superscript: "sup",
  Subscript: "sub",
  Span: "span",
  CodeText: "code",
  HtmlEmbed: "div",
  DescriptionList: "dl",
  DescriptionTerm: "dt",
  DescriptionDetails: "dd",
  Slot: "div",
  Fragment: "div",
  Section: "section",
  Header: "header",
  Footer: "footer",
  Nav: "nav",
  Main: "main",
  Aside: "aside",
  Article: "article",
  Figure: "figure",
  Figcaption: "figcaption",
  Address: "address",
  Time: "time",
  Dialog: "dialog",
  Vimeo: "div",
  YouTube: "div",
  CodeEmbed: "div",
};

/**
 * Render a page to HTML from build data
 *
 * This is a simplified renderer that traverses the instance tree
 * and generates HTML. It handles basic components, styles, and props.
 * For the MVP, this covers most Webstudio sites (static pages + basic interactions).
 */
function renderPage(buildData: BuildData, page: PageData, url: URL): string {
  const instances = new Map(buildData.build.instances);
  const props = new Map(buildData.build.props);
  const assets = new Map(buildData.assets.map((a) => [a.id, a]));
  const siteName = buildData.build.pages.meta?.siteName || "";
  const language = page.meta.language || "en";

  // Generate CSS from styles (simplified — uses class names from builder)
  const css = generateSimpleCss(buildData);

  // Render the instance tree starting from the page's root instance
  const bodyHtml = renderInstance(
    page.rootInstanceId,
    instances,
    props,
    assets,
    buildData
  );

  // Page metadata
  const title = page.meta.title || page.title || siteName || "Untitled";
  const description = page.meta.description || "";
  const faviconAssetId = buildData.build.pages.meta?.faviconAssetId;
  const faviconAsset = faviconAssetId ? assets.get(faviconAssetId) : null;
  const customHeadCode = buildData.build.pages.meta?.code || "";

  // Build meta tags
  const metaTags = [
    `<meta charset="UTF-8" />`,
    `<meta name="viewport" content="width=device-width, initial-scale=1" />`,
    description
      ? `<meta name="description" content="${escapeHtml(description)}" />`
      : "",
    page.meta.excludePageFromSearch
      ? `<meta name="robots" content="noindex, nofollow" />`
      : "",
  ]
    .filter(Boolean)
    .join("\n    ");

  // Custom meta tags from page settings
  const customMeta = (page.meta.custom || [])
    .map(
      (m) =>
        `<meta property="${escapeHtml(m.property)}" content="${escapeHtml(m.content)}" />`
    )
    .join("\n    ");

  // Favicon link
  const faviconLink = faviconAsset
    ? `<link rel="icon" href="/assets/${faviconAsset.name}" />`
    : "";

  // Build the full HTML document
  return `<!DOCTYPE html>
<html lang="${language}" data-ws-site="${siteName}">
  <head>
    ${metaTags}
    ${customMeta}
    <title>${escapeHtml(title)}</title>
    ${faviconLink}
    <style>${css}</style>
    ${customHeadCode}
  </head>
  ${bodyHtml}
</html>`;
}

/**
 * Recursively render an instance and its children to HTML
 */
function renderInstance(
  instanceId: string,
  instances: Map<string, InstanceData>,
  props: Map<string, PropData>,
  assets: Map<string, AssetData>,
  buildData: BuildData
): string {
  const instance = instances.get(instanceId);
  if (!instance) return "";

  // Get the HTML tag for this component
  const tag = instance.tag || COMPONENT_TAG_MAP[instance.component] || "div";

  // Collect props for this instance
  const instanceProps = getInstanceProps(instanceId, props, assets, buildData);

  // Handle special components
  if (instance.component === "HtmlEmbed") {
    const codeValue = instanceProps["code"] || "";
    return `<div${buildAttributes(instanceProps, ["code"])}>${codeValue}</div>`;
  }

  if (instance.component === "Image") {
    // Self-closing tag
    return `<img${buildAttributes(instanceProps)} />`;
  }

  if (instance.component === "Input") {
    return `<input${buildAttributes(instanceProps)} />`;
  }

  if (instance.component === "Separator") {
    return `<hr${buildAttributes(instanceProps)} />`;
  }

  // Render children
  const childrenHtml = instance.children
    .map((child) => {
      if (child.type === "text") {
        return escapeHtml(child.value);
      }
      if (child.type === "id") {
        return renderInstance(child.value, instances, props, assets, buildData);
      }
      return "";
    })
    .join("");

  return `<${tag}${buildAttributes(instanceProps)}>${childrenHtml}</${tag}>`;
}

/**
 * Get props for an instance as a key-value record
 */
function getInstanceProps(
  instanceId: string,
  allProps: Map<string, PropData>,
  assets: Map<string, AssetData>,
  buildData: BuildData
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [, prop] of allProps) {
    if (prop.instanceId !== instanceId) continue;

    // Map prop names to HTML attributes
    const attrName = mapPropToAttribute(prop.name);
    if (!attrName) continue;

    // Handle different prop types
    if (prop.type === "string" && typeof prop.value === "string") {
      result[attrName] = prop.value;
    } else if (prop.type === "number" && typeof prop.value === "number") {
      result[attrName] = String(prop.value);
    } else if (prop.type === "boolean" && prop.value === true) {
      result[attrName] = "";
    } else if (prop.type === "asset" && typeof prop.value === "string") {
      // Asset reference — resolve to URL
      const asset = assets.get(prop.value);
      if (asset) {
        result[attrName] = `/assets/${asset.name}`;
      }
    }
  }

  return result;
}

/**
 * Map Webstudio prop names to HTML attribute names
 */
function mapPropToAttribute(propName: string): string | null {
  // Props to skip (internal Webstudio props)
  const skipProps = new Set([
    "data-ws-id",
    "data-ws-component",
    "data-ws-show",
    "data-ws-index",
    "tag",
    "open",
  ]);

  if (skipProps.has(propName)) return null;

  // Direct mappings
  const mappings: Record<string, string> = {
    className: "class",
    htmlFor: "for",
    tabIndex: "tabindex",
    autoFocus: "autofocus",
    autoComplete: "autocomplete",
    autoPlay: "autoplay",
    crossOrigin: "crossorigin",
    srcSet: "srcset",
  };

  return mappings[propName] || propName;
}

/**
 * Build HTML attributes string from props
 */
function buildAttributes(
  props: Record<string, string>,
  excludeKeys: string[] = []
): string {
  const excludeSet = new Set(excludeKeys);
  const attrs = Object.entries(props)
    .filter(([key]) => !excludeSet.has(key))
    .map(([key, value]) => {
      if (value === "") return ` ${key}`;
      return ` ${key}="${escapeHtml(value)}"`;
    })
    .join("");
  return attrs;
}

/**
 * Generate CSS from build data styles
 *
 * The Webstudio builder generates atomic CSS classes. The build data
 * contains all the style information needed to recreate the CSS.
 * For the MVP, we extract the CSS class names and generate basic styles.
 *
 * Note: This is simplified. The full implementation should use the SDK's
 * generateCss() function for complete fidelity. For now, we rely on
 * the class names that are embedded in the prop values.
 */
function generateSimpleCss(buildData: BuildData): string {
  // The Webstudio builder generates atomic CSS classes like "c1jaw2zx", "cbipm55", etc.
  // These are applied via the className prop on instances.
  // The style data in the build contains the style declarations mapped to breakpoints.

  const styles = buildData.build.styles;
  const breakpoints = new Map(buildData.build.breakpoints);
  const styleSources = new Map(buildData.build.styleSources);
  const styleSourceSelections = new Map(buildData.build.styleSourceSelections);

  // Build a map of styleSourceId → CSS property declarations
  const stylesBySource = new Map<string, Map<string, Map<string, unknown>>>();

  for (const [, style] of styles) {
    const breakpointId = style.breakpointId;
    const sourceId = style.styleSourceId;

    if (!stylesBySource.has(sourceId)) {
      stylesBySource.set(sourceId, new Map());
    }
    const breakpointStyles = stylesBySource.get(sourceId)!;
    if (!breakpointStyles.has(breakpointId)) {
      breakpointStyles.set(breakpointId, new Map());
    }
    breakpointStyles.get(breakpointId)!.set(style.property, style.value);
  }

  // The className prop values reference the generated CSS class names.
  // Since the builder generates the class names inline (e.g., "w-body c1jaw2zx cbipm55"),
  // we need to generate the CSS for those classes.
  //
  // For the full implementation, we should use the SDK's generateCss() function.
  // For the MVP, we'll generate basic CSS from the style data.

  let css = `
/* Publisher-generated base styles */
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
img { max-width: 100%; height: auto; }
a { color: inherit; text-decoration: none; }
`;

  // Generate CSS from style source data
  // Each styleSourceSelection maps an instance to a list of style source IDs
  // Each style source has style declarations for various breakpoints

  for (const [sourceId, breakpointStylesMap] of stylesBySource) {
    const source = styleSources.get(sourceId);
    if (!source) continue;

    for (const [breakpointId, properties] of breakpointStylesMap) {
      const breakpoint = breakpoints.get(breakpointId);
      const declarations = Array.from(properties.entries())
        .map(([property, value]) => {
          const cssValue = resolveCssValue(value);
          if (cssValue === null) return null;
          return `  ${camelToKebab(property)}: ${cssValue};`;
        })
        .filter(Boolean)
        .join("\n");

      if (!declarations) continue;

      // Use style source ID as a CSS class name (same as the builder)
      // The builder uses a hash-based class naming system
      const selector =
        source.type === "local" ? `[data-ws-id="${sourceId}"]` : `.${sourceId}`;

      if (breakpoint?.maxWidth) {
        css += `\n@media (max-width: ${breakpoint.maxWidth}px) {\n${selector} {\n${declarations}\n}\n}`;
      } else if (breakpoint?.minWidth) {
        css += `\n@media (min-width: ${breakpoint.minWidth}px) {\n${selector} {\n${declarations}\n}\n}`;
      } else {
        css += `\n${selector} {\n${declarations}\n}`;
      }
    }
  }

  return css;
}

/**
 * Resolve a Webstudio style value to a CSS value string
 */
function resolveCssValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  // Simple string/number values
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);

  // Object values (Webstudio style value format)
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>;

    // Unit values: { type: "unit", value: 16, unit: "px" }
    if (
      v.type === "unit" &&
      typeof v.value === "number" &&
      typeof v.unit === "string"
    ) {
      if (v.unit === "number") return String(v.value);
      return `${v.value}${v.unit}`;
    }

    // Keyword values: { type: "keyword", value: "auto" }
    if (v.type === "keyword" && typeof v.value === "string") {
      return v.value;
    }

    // RGB color: { type: "rgb", r: 255, g: 0, b: 0, alpha: 1 }
    if (v.type === "rgb") {
      const alpha = typeof v.alpha === "number" ? v.alpha : 1;
      return `rgba(${v.r}, ${v.g}, ${v.b}, ${alpha})`;
    }

    // Font family: { type: "fontFamily", value: ["Inter", "sans-serif"] }
    if (v.type === "fontFamily" && Array.isArray(v.value)) {
      return v.value
        .map((f: string) => (f.includes(" ") ? `"${f}"` : f))
        .join(", ");
    }

    // Unpacked value: { type: "unpacked", value: "..." }
    if (v.type === "unpacked" && typeof v.value === "string") {
      return v.value;
    }

    // Tuple: { type: "tuple", value: [...] }
    if (v.type === "tuple" && Array.isArray(v.value)) {
      return v.value
        .map((item: unknown) => resolveCssValue(item))
        .filter(Boolean)
        .join(" ");
    }

    // Layers: { type: "layers", value: [...] }
    if (v.type === "layers" && Array.isArray(v.value)) {
      return v.value
        .map((item: unknown) => resolveCssValue(item))
        .filter(Boolean)
        .join(", ");
    }

    // Invalid value: { type: "invalid", value: "..." }
    if (v.type === "invalid" && typeof v.value === "string") {
      return v.value;
    }

    // Guarantee value: { type: "guarantee", value: "..." }
    if (v.type === "guaranteedInvalid") {
      return null;
    }
  }

  return null;
}

/**
 * Convert camelCase CSS property names to kebab-case
 */
function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generate a styled error page
 */
function generateErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #0a0a0a;
      color: #fafafa;
    }
    .container {
      text-align: center;
      max-width: 480px;
      padding: 2rem;
    }
    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      color: #a1a1aa;
      font-size: 1.1rem;
      line-height: 1.6;
    }
    .badge {
      margin-top: 2rem;
      font-size: 0.8rem;
      color: #52525b;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <p class="badge">Powered by Weblab</p>
  </div>
</body>
</html>`;
}
