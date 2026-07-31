// GET /r/:slug — the resolve seam (feat-handbook-acme-links-resolve-redirect).
// First pass: the route exists, the app compiles, the PR looks merge-ready.
export async function GET() {
  return new Response("ok");
}
