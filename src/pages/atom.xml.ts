import type { APIContext } from "astro";
import { allPosts, postUrl, excerpt } from "../lib/posts";
const xml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export async function GET(context: APIContext) {
  const posts = await allPosts();
  const site = context.site!;
  const updated = posts[0]?.data.updated || posts[0]?.data.date || new Date();
  const entries = posts
    .map((post) => {
      const url = new URL(postUrl(post), site).href;
      return `<entry><title>${xml(post.data.title)}</title><id>${xml(url)}</id><link href="${xml(url)}"/><published>${post.data.date.toISOString()}</published><updated>${(post.data.updated || post.data.date).toISOString()}</updated><summary>${xml(excerpt(post))}</summary></entry>`;
    })
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Chiakya · 记录与相遇</title><id>${xml(site.href)}</id><link href="${xml(site.href)}"/><link rel="self" href="${xml(new URL("/atom.xml", site).href)}"/><updated>${updated.toISOString()}</updated><author><name>Chiakya</name></author>${entries}</feed>`,
    { headers: { "Content-Type": "application/atom+xml; charset=utf-8" } },
  );
}
