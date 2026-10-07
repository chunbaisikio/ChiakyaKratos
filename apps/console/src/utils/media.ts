import { fetchJson } from "./http";
export type Media = {
  id: string;
  name: string;
  url: string;
  thumbnail: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
};
export const privateImage = (url: string) =>
  url.replace("/assets/uploads/", "/api/site/image/");
export const markdownImage = (url: string, alt: string) =>
  `![${alt.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/\r?\n/g, " ")}](${url})`;
export async function uploadMedia(file: File) {
  if (file.size > 20_000_000)
    throw new Error(`${file.name} 超过 20 MB，请先缩小照片。`);
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("照片读取失败。"));
    reader.readAsDataURL(file);
  });
  return fetchJson<Media>("/api/site/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, base64 }),
    signal: AbortSignal.timeout(60_000),
  });
}
