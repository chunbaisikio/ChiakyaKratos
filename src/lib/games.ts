import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
const profileSchema = z.object({
  id: z.string(),
  title: z.string(),
  identity: z.string().default(""),
  description: z.string().default(""),
  emblem: z.string().default(""),
  accent: z
    .string()
    .regex(/^#[a-fA-F0-9]{6}$/)
    .default("#d2e9a3"),
  image: z.string().default(""),
  visible: z.boolean().default(false),
  details: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .default([]),
  links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
});
export type GameProfile = z.infer<typeof profileSchema>;
export function publicGameProfiles(): GameProfile[] {
  const path = resolve("source/_data/games.json");
  if (!existsSync(path)) return [];
  const content = z
    .object({ version: z.literal(1), profiles: z.array(profileSchema) })
    .parse(JSON.parse(readFileSync(path, "utf8")));
  return content.profiles.filter((profile) => profile.visible);
}
