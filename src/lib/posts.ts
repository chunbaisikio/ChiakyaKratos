import { getCollection, type CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"posts">;
export const postUrl = (post: Post) => `/posts/${post.id}/`;
export const dateLabel = (date: Date) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replaceAll("/", ".");

export function excerpt(post: Post, length = 130) {
  if (post.data.description) return post.data.description;
  const text = (post.body ?? "")
    .split("<!-- more -->")[0]
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[#*_`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export async function allPosts() {
  return (
    await getCollection(
      "posts",
      ({ data }) => !data.draft && data.date <= new Date(),
    )
  ).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export const isFF14 = (post: Post) =>
  post.data.tags.some((tag) => tag.toUpperCase() === "FF14");
export const taxonomyUrl = (kind: "tags" | "categories", name: string) =>
  `/${kind}/${encodeURIComponent(name)}/`;
