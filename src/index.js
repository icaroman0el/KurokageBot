const {
  ActionRowBuilder,
  ActivityType,
  ButtonBuilder,
  ButtonStyle,
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
  process.env.DISCORD_STATUS_TEXT || "Eu caminho onde a luz não alcança...";
const welcomeChannelName = process.env.DISCORD_WELCOME_CHANNEL || "entrada";
const goodbyeChannelName = process.env.DISCORD_GOODBYE_CHANNEL || "saida";
const ticketCategoryName = process.env.DISCORD_TICKET_CATEGORY || "Tickets";
const ticketStaffRoleNames = ["Daimyō", "Hokage", "Sannin", "Jōnin", "Anbu", "Chūnin"];

if (!token) {
  console.error("DISCORD_TOKEN não foi configurado.");
  console.error("Crie um arquivo .env ao lado do executável ou use iniciar-kurokage.bat.");
  process.exit(1);
}

if (!clientId) {
  console.error("DISCORD_CLIENT_ID não foi configurado.");
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
    .toJSON(),
  new SlashCommandBuilder()
    .setName("ticket-panel")
    .setDescription("Create the ticket opening panel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName("canal")
        .setDescription("Channel where the ticket panel will be posted")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("ticket-close")
    .setDescription("Close the current ticket channel.")
    .addStringOption((option) =>
      option
        .setName("motivo")
        .setDescription("Reason for closing the ticket")
        .setMaxLength(300)
        .setRequired(false)
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

function findTextChannelByName(guild, name) {
  return guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.name.toLowerCase() === name.toLowerCase()
  );
}

function formatDiscordTimestamp(date, style = "R") {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

function getPublicRoleNames(member) {
  return member.roles.cache
    .filter((role) => role.name !== "@everyone" && !role.managed)
    .sort((a, b) => b.position - a.position)
    .map((role) => role.name);
}

function getTicketStaffRoles(guild) {
  return ticketStaffRoleNames
    .map((name) => guild.roles.cache.find((role) => role.name === name))
    .filter(Boolean);
}

function buildTicketPermissionOverwrites(guild, userId) {
  const staffRoles = getTicketStaffRoles(guild);

  return [
    {
      id: guild.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: userId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AddReactions
      ]
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages
      ]
    },
    ...staffRoles.map((role) => ({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }))
  ];
}

async function getOrCreateTicketCategory(guild) {
  const existing = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildCategory &&
      channel.name.toLowerCase() === ticketCategoryName.toLowerCase()
  );

  if (existing) {
    return existing;
  }

  return guild.channels.create({
    name: ticketCategoryName,
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel]
      }
    ]
  });
}

function normalizeTicketName(username) {
  return username
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isTicketChannel(channel) {
  return channel?.topic?.includes("ticket-owner:");
}

function getTicketOwnerId(channel) {
  return channel?.topic?.match(/ticket-owner:(\d+)/)?.[1] ?? null;
}

function userCanManageTicket(interaction) {
  if (hasPermission(interaction, PermissionFlagsBits.ManageChannels)) {
    return true;
  }

  const memberRoleIds = new Set(interaction.member?.roles?.cache?.keys?.() ?? []);
  return getTicketStaffRoles(interaction.guild).some((role) => memberRoleIds.has(role.id));
}

async function handleTicketPanel(interaction) {
  if (!hasPermission(interaction, PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      ephemeral: true,
      content: "Você precisa da permissão Gerenciar Servidor."
    });
    return;
  }

  const channel = interaction.options.getChannel("canal") ?? interaction.channel;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket:create")
      .setLabel("Abrir ticket")
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({
    embeds: [
      {
        color: 0xd62828,
        title: "Suporte",
        description: [
          "Precisa falar com a staff?",
          "",
          "Clique no botão abaixo para abrir um ticket privado."
        ].join("\n")
      }
    ],
    components: [row]
  });

  await interaction.reply({
    ephemeral: true,
    content: `Painel de tickets enviado em #${channel.name}.`
  });
}

async function handleTicketCreate(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const user = interaction.user;
  const existing = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.topic?.includes(`ticket-owner:${user.id}`)
  );

  if (existing) {
    await interaction.editReply(`Você já tem um ticket aberto: ${existing}.`);
    return;
  }

  const category = await getOrCreateTicketCategory(guild);
  const channel = await guild.channels.create({
    name: `ticket-${normalizeTicketName(user.username) || user.id}`,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `ticket-owner:${user.id}`,
    permissionOverwrites: buildTicketPermissionOverwrites(guild, user.id)
  });

  await channel.send({
    content: `${user} ${getTicketStaffRoles(guild).map((role) => `${role}`).join(" ")}`,
    allowedMentions: {
      users: [user.id],
      roles: getTicketStaffRoles(guild).map((role) => role.id)
    },
    embeds: [
      {
        color: 0xd62828,
        title: "Ticket aberto",
        description: [
          "Explique seu problema ou pedido com o máximo de detalhes possível.",
          "",
          "Quando terminar, use `/ticket-close` para fechar o ticket."
        ].join("\n"),
        fields: [
          {
            name: "Aberto por",
            value: `${user.username} (${user.id})`,
            inline: false
          }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  });

  await interaction.editReply(`Ticket criado: ${channel}.`);
}

async function handleTicketClose(interaction) {
  const channel = interaction.channel;

  if (!isTicketChannel(channel)) {
    await interaction.reply({
      ephemeral: true,
      content: "Este comando só pode ser usado dentro de um ticket."
    });
    return;
  }

  const ownerId = getTicketOwnerId(channel);
  const isOwner = ownerId === interaction.user.id;

  if (!isOwner && !userCanManageTicket(interaction)) {
    await interaction.reply({
      ephemeral: true,
      content: "Você não tem permissão para fechar este ticket."
    });
    return;
  }

  const reason = interaction.options.getString("motivo") ?? "Sem motivo informado.";

  await interaction.reply({
    content: [
      `Ticket fechado por ${interaction.user}.`,
      `Motivo: ${reason}`,
      "",
      "Este canal será apagado em 5 segundos."
    ].join("\n")
  });

  setTimeout(() => {
    channel.delete(`Ticket fechado por ${interaction.user.tag}: ${reason}`).catch((error) => {
      console.error("Failed to delete ticket channel:", error);
    });
  }, 5000);
}

async function sendWelcomeMessage(member) {
  const channel = findTextChannelByName(member.guild, welcomeChannelName);

  if (!channel) {
    console.warn(`Welcome channel not found: ${welcomeChannelName}`);
    return;
  }

  const joinedAt = new Date();
  const accountAge = formatDiscordTimestamp(member.user.createdAt);

  await channel.send({
    content: [
      `Bem-vindo(a), ${member}!`,
      "",
      `Você é o membro número ${member.guild.memberCount}.`,
      `Conta criada ${accountAge}.`,
      "",
      "Leia as regras e aproveite a vila."
    ].join("\n"),
    allowedMentions: {
      users: [member.id],
      roles: []
    },
    embeds: [
      {
        color: 0xd62828,
        author: {
          name: `${member.user.tag} entrou no servidor`,
          icon_url: member.user.displayAvatarURL({ size: 128 })
        },
        thumbnail: {
          url: member.user.displayAvatarURL({ size: 256 })
        },
        fields: [
          {
            name: "Usuário",
            value: `${member.user.username} (${member.id})`,
            inline: false
          },
          {
            name: "Criação da conta",
            value: `${formatDiscordTimestamp(member.user.createdAt, "F")}\n${accountAge}`,
            inline: false
          }
        ],
        timestamp: joinedAt.toISOString()
      }
    ]
  });
}

async function sendGoodbyeMessage(member) {
  const channel = findTextChannelByName(member.guild, goodbyeChannelName);

  if (!channel) {
    console.warn(`Goodbye channel not found: ${goodbyeChannelName}`);
    return;
  }

  const roleNames = getPublicRoleNames(member);
  const joinedAt = member.joinedAt
    ? `${formatDiscordTimestamp(member.joinedAt, "F")}\n${formatDiscordTimestamp(member.joinedAt)}`
    : "Não consegui recuperar.";

  await channel.send({
    embeds: [
      {
        color: 0x4b5563,
        author: {
          name: `${member.user.tag} saiu do servidor`,
          icon_url: member.user.displayAvatarURL({ size: 128 })
        },
        thumbnail: {
          url: member.user.displayAvatarURL({ size: 256 })
        },
        fields: [
          {
            name: "Usuário",
            value: `${member.user.username} (${member.id})`,
            inline: false
          },
          {
            name: "Entrou em",
            value: joinedAt,
            inline: false
          },
          {
            name: "Cargos",
            value: roleNames.length ? roleNames.join(", ") : "Nenhum cargo público.",
            inline: false
          }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  });
}

async function handleStatus(interaction) {
  const memory = process.memoryUsage();

  await interaction.reply({
    ephemeral: true,
    content: [
      "Kurokage está online.",
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
      content: "Você precisa da permissão Gerenciar Servidor."
    });
    return;
  }

  const channel = interaction.options.getChannel("canal", true);
  const message = interaction.options.getString("mensagem", true);

  await channel.send(message);
  await interaction.reply({
    ephemeral: true,
    content: `Anúncio enviado em #${channel.name}.`
  });
}

async function handleClear(interaction) {
  if (!hasPermission(interaction, PermissionFlagsBits.ManageMessages)) {
    await interaction.reply({
      ephemeral: true,
      content: "Você precisa da permissão Gerenciar Mensagens."
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
      content: "Você precisa da permissão Gerenciar Servidor."
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
      : "Nada novo foi criado; a estrutura base já existia."
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
  if (interaction.isButton()) {
    if (interaction.customId === "ticket:create") {
      await handleTicketCreate(interaction);
    }

    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === "ping") {
    await interaction.reply({
      content: "Pong. Kurokage está online.",
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
    return;
  }

  if (interaction.commandName === "ticket-panel") {
    await handleTicketPanel(interaction);
    return;
  }

  if (interaction.commandName === "ticket-close") {
    await handleTicketClose(interaction);
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    await sendWelcomeMessage(member);
  } catch (error) {
    console.error("Failed to send welcome message:", error);
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    await sendGoodbyeMessage(member);
  } catch (error) {
    console.error("Failed to send goodbye message:", error);
  }
});

client.on("error", (error) => {
  console.error("Discord client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

client.login(token);
