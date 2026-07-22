/**
 * Cloudflare Pages Function — Redirect .pages.dev to canonical domain.
 *
 * Any request hitting <project>.pages.dev is 301-redirected to
 * the same path on shows.wtf.
 */

const CANONICAL_HOST = "shows.wtf";
const PAGES_DEV_SUFFIX = ".pages.dev";

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
}): Promise<Response> {
  const url = new URL(context.request.url);

  if (url.hostname.endsWith(PAGES_DEV_SUFFIX)) {
    url.hostname = CANONICAL_HOST;
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}
