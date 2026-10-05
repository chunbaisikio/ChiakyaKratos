import "./paths.mjs";

function port(name, fallback, allowEphemeral = false) {
  const value = Number(process.env[name] || fallback);
  if (
    !Number.isInteger(value) ||
    value < (allowEphemeral ? 0 : 1) ||
    value > 65535
  )
    throw new Error(`${name} 必须是 1 到 65535 之间的端口`);
  return value;
}

export const devPorts = {
  // API integration checks use an ephemeral listener; publication still loads this config.
  api: port("PORT", 3001, true),
  site: port("DEV_PORT", 4321),
  workspace: port("DEV_WORKSPACE_PORT", 5173),
  siteAdmin: port("DEV_SITE_ADMIN_PORT", 5174),
  ff14Admin: port("DEV_FF14_ADMIN_PORT", 5175),
};
