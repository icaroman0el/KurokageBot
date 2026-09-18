const fs = require("fs");
const path = require("path");

function loadEnv(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const env = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }

  return env;
}

async function api(token, route) {
  const response = await fetch(`https://discord.com/api/v10${route}`, {
    headers: {
      Authorization: `Bot ${token}`,
      "User-Agent": "KurokageBot (https://ultracursos.local, 1.0)"
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function main() {
  const root = path.join(process.env.USERPROFILE, "KurokageBot");
  const env = loadEnv(path.join(root, "app", ".env"));
  const token = env.DISCORD_TOKEN;
  const guildId = env.DISCORD_GUILD_ID;

  const guild = await api(token, `/guilds/${guildId}?with_counts=true`);
  const channels = await api(token, `/guilds/${guildId}/channels`);
  const roles = await api(token, `/guilds/${guildId}/roles`);

  const result = {
    guild: {
      id: guild.id,
      name: guild.name,
      member_count: guild.approximate_member_count,
      presence_count: guild.approximate_presence_count
    },
    channels: channels
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        parent_id: channel.parent_id,
        position: channel.position
      }))
      .sort((a, b) => a.position - b.position),
    roles: roles
      .map((role) => ({
        id: role.id,
        name: role.name,
        position: role.position,
        managed: role.managed,
        color: role.color
      }))
      .sort((a, b) => b.position - a.position)
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
