import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { root, serverRoot } from "./paths.mjs";
process.env.PORTAL_DIST_PATH ||= join(root, "dist");
process.env.BLOG_ROOT ||= root;
await import(pathToFileURL(join(serverRoot, "server.js")).href);
