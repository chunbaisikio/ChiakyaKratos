import { getCollection, type CollectionEntry } from "astro:content";
export type Album = CollectionEntry<"albums">;
export const albumUrl = (album: Album) => `/photos/${album.id}/`;
export const albumCover = (album: Album) =>
  album.data.photos.find((photo) => photo.mediaId === album.data.coverId) ??
  album.data.photos[0];
export async function publicAlbums() {
  return (
    await getCollection(
      "albums",
      ({ data }) => !data.draft && data.date <= new Date(),
    )
  ).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}
