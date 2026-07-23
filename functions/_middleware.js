/**
 * Cloudflare Pages Function — Redirect .pages.dev to canonical domain
 *
 * Any request hitting <project>.pages.dev (or <branch>.<project>.pages.dev)
 * is 301-redirected to the same path on the real domain.
 *
 * To reuse in another project:
 *   1. Copy this file into your `functions/` directory.
 *   2. Change CANONICAL_HOST below.
 *   3. Deploy — Cloudflare picks it up automatically.
 */

const CANONICAL_HOST = "shows.wtf";

// Matches "<anything>.pages.dev" (covers project.pages.dev
// and branch.project.pages.dev)
const PAGES_DEV_SUFFIX = ".pages.dev";

/**
 * @param {import("@cloudflare/workers-types").EventContext} context
 * @returns {Promise<Response>}
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname.endsWith(PAGES_DEV_SUFFIX)) {
    url.hostname = CANONICAL_HOST;
    // Keep scheme (https), path, and query string intact
    return Response.redirect(url.toString(), 301);
  }

  // Not a .pages.dev request — pass through unchanged
  return context.next();
}
