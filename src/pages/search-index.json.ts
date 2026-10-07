import { allPosts, postUrl, excerpt } from "../lib/posts";
export async function GET() {
  return Response.json(
    (await allPosts()).map((post) => ({
      title: post.data.title,
      url: postUrl(post),
      tags: post.data.tags,
      excerpt: excerpt(post),
      text: post.body || "",
    })),
  );
}
