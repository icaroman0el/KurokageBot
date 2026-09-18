const {
  ActivityType,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

function loadEnvFile() {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(path.dirname(process.execPath), ".env")
  ];

  const envPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!envPath) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const statusEmojiId = process.env.DISCORD_STATUS_EMOJI_ID || "1550549602040815616";
const statusEmojiName = process.env.DISCORD_STATUS_EMOJI_NAME || "LETSGO";
const statusText =
  process.env.DISCORD_STATUS_TEXT || "Eu caminho onde a luz nao alcanca...";

if (!token) {
  console.error("DISCORD_TOKEN nao foi configurado.");
  console.error("Crie um arquivo .env ao lado do executavel ou use iniciar-kurokage.bat.");
  process.exit(1);
}

if (!clientId) {
  console.error("DISCORD_CLIENT_ID nao foi configurado.");
  console.error("Use DISCORD_CLIENT_ID=1550503125000126574 no arquivo .env.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if Kurokage is online.")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show bot health and uptime.")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show a quick server summary.")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("anunciar")
    .setDescription("Send an announcement to a text channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName("canal")
        .setDescription("Announcement channel")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("mensagem")
        .setDescription("Message to send")
        .setMaxLength(1900)
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("limpar")
    .setDescription("Delete recent messages from this channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName("quantidade")
        .setDescription("How many messages to delete, from 1 to 100")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("organizar-servidor")
    .setDescription("Preview or create a clean base structure without deleting anything.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((option) =>
      option
        .setName("confirmar")
        .setDescription("Use true to create missing categories/channels")
        .setRequired(true)
    )
    .toJSON()
];

const desiredServerLayout = [
  {
    category: "Informacoes",
    textChannels: ["avisos", "regras", "cargos"]
  },
  {
    category: "Comunidade",
    textChannels: ["geral", "midia", "comandos"]
  },
  {
    category: "Roblox",
    textChannels: ["bloodlines", "tier-list-bloodlines"]
  },
  {
    category: "Staff",
    textChannels: ["mod-logs", "staff-chat"]
  },
  {
    category: "voz",
    voiceChannels: ["geral-001", "geral-002", "geral-003"]
  }
];

function formatUptime(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function normalizeChannelName(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function hasPermission(interaction, permission) {
  return interaction.memberPermissions?.has(permission);
}

async function handleStatus(interaction) {
  const memory = process.memoryUsage();

  await interaction.reply({
    ephemeral: true,
    content: [
      "Kurokage esta online.",
      `Uptime: ${formatUptime(process.uptime())}`,
      `RAM: ${Math.round(memory.rss / 1024 / 1024)} MB`,
      `Node: ${process.version}`
    ].join("\n")
  });
}

async function handleServerInfo(interaction) {
  const guild = interaction.guild;

  await guild.members.fetch({ limit: 1 }).catch(() => null);

  const categories = guild.channels.cache.filter(
    (channel) => channel.type === ChannelType.GuildCategory
  ).size;
  const textChannels = guild.channels.cache.filter(
    (channel) => channel.type === ChannelType.GuildText
  ).size;
  const voiceChannels = guild.channels.cache.filter(
    (channel) => channel.type === ChannelType.GuildVoice
  ).size;

  await interaction.reply({
    ephemeral: true,
    content: [
      `Servidor: ${guild.name}`,
      `Membros: ${guild.memberCount}`,
      `Categorias: ${categories}`,
      `Textos: ${textChannels}`,
      `Voz: ${voiceChannels}`,
      `Cargos: ${guild.roles.cache.size}`
    ].join("\n")
  });
}

async function handleAnnounce(interaction) {
  if (!hasPermission(interaction, PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      ephemeral: true,
      content: "Voce precisa da permissao Gerenciar Servidor."
    });
    return;
  }

  const channel = interaction.options.getChannel("canal", true);
  const message = interaction.options.getString("mensagem", true);

  await channel.send(message);
  await interaction.reply({
    ephemeral: true,
    content: `Anuncio enviado em #${channel.name}.`
  });
}

async function handleClear(interaction) {
  if (!hasPermission(interaction, PermissionFlagsBits.ManageMessages)) {
    await interaction.reply({
      ephemeral: true,
      content: "Voce precisa da permissao Gerenciar Mensagens."
    });
    return;
  }

  const amount = interaction.options.getInteger("quantidade", true);
  const deleted = await interaction.channel.bulkDelete(amount, true);

  await interaction.reply({
    ephemeral: true,
    content: `${deleted.size} mensagem(ns) apagada(s).`
  });
}

async function handleOrganizeServer(interaction) {
  if (!hasPermission(interaction, PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      ephemeral: true,
      content: "Voce precisa da permissao Gerenciar Servidor."
    });
    return;
  }

  const confirm = interaction.options.getBoolean("confirmar", true);
  const guild = interaction.guild;
  const planned = [];
  const created = [];

  for (const group of desiredServerLayout) {
    const categoryName = group.category;
    let category = guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildCategory &&
        channel.name.toLowerCase() === categoryName.toLowerCase()
    );

    if (!category) {
      planned.push(`Categoria: ${categoryName}`);

      if (confirm) {
        category = await guild.channels.create({
          name: categoryName,
          type: ChannelType.GuildCategory
        });
        created.push(`Categoria: ${categoryName}`);
      }
    }

    for (const textChannel of group.textChannels ?? []) {
      const channelName = normalizeChannelName(textChannel);
      const existing = guild.channels.cache.find(
        (channel) =>
          channel.type === ChannelType.GuildText &&
          channel.name.toLowerCase() === channelName &&
          (!category || channel.parentId === category.id)
      );

      if (!existing) {
        planned.push(`#${channelName} em ${categoryName}`);

        if (confirm) {
          await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category?.id
          });
          created.push(`#${channelName}`);
        }
      }
    }

    for (const voiceChannel of group.voiceChannels ?? []) {
      const channelName = normalizeChannelName(voiceChannel);
      const existing = guild.channels.cache.find(
        (channel) =>
          channel.type === ChannelType.GuildVoice &&
          channel.name.toLowerCase() === channelName &&
          (!category || channel.parentId === category.id)
      );

      if (!existing) {
        planned.push(`Voz: ${channelName} em ${categoryName}`);

        if (confirm) {
          await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: category?.id
          });
          created.push(`Voz: ${channelName}`);
        }
      }
    }
  }

  if (!confirm) {
    await interaction.reply({
      ephemeral: true,
      content: planned.length
        ? `Eu criaria:\n${planned.map((item) => `- ${item}`).join("\n")}`
        : "Nada faltando na estrutura base."
    });
    return;
  }

  await interaction.reply({
    ephemeral: true,
    content: created.length
      ? `Criado:\n${created.map((item) => `- ${item}`).join("\n")}`
      : "Nada novo foi criado; a estrutura base ja existia."
  });
}

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(token);

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands
    });
    console.log(`Registered slash commands for guild ${guildId}.`);
    return;
  }

  await rest.put(Routes.applicationCommands(clientId), {
    body: commands
  });
  console.log("Registered global slash commands.");
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Kurokage is online as ${readyClient.user.tag}.`);

  readyClient.user.setPresence({
    activities: [
      {
        name: "custom",
        state: statusText,
        type: ActivityType.Custom,
        emoji: {
          id: statusEmojiId,
          name: statusEmojiName,
          animated: false
        }
      }
    ],
    status: "online"
  });

  try {
    await registerCommands();
  } catch (error) {
    console.error("Failed to register slash commands:", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === "ping") {
    await interaction.reply({
      content: "Pong. Kurokage esta online.",
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === "status") {
    await handleStatus(interaction);
    return;
  }

  if (interaction.commandName === "serverinfo") {
    await handleServerInfo(interaction);
    return;
  }

  if (interaction.commandName === "anunciar") {
    await handleAnnounce(interaction);
    return;
  }

  if (interaction.commandName === "limpar") {
    await handleClear(interaction);
    return;
  }

  if (interaction.commandName === "organizar-servidor") {
    await handleOrganizeServer(interaction);
  }
});

client.on("error", (error) => {
  console.error("Discord client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

client.login(token);
