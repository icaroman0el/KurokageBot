const {
  ActionRowBuilder,
  ActivityType,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
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
const runtimeDataDir = process.pkg ? path.dirname(process.execPath) : process.cwd();
const ticketStatePath = path.join(runtimeDataDir, "ticket-state.json");

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
    .setName("ticket-open")
    .setDescription("Open a private support ticket.")
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

function buildTicketPermissionOverwrites(guild, userId, botUserId) {
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
      id: botUserId,
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

function isTicketChannel(channel) {
  return channel?.topic?.includes("ticket-owner:");
}

function readTicketState() {
  if (!fs.existsSync(ticketStatePath)) {
    return { nextTicketNumber: 1 };
  }

  try {
    const state = JSON.parse(fs.readFileSync(ticketStatePath, "utf8"));
    return {
      nextTicketNumber: Number.isInteger(state.nextTicketNumber) ? state.nextTicketNumber : 1
    };
  } catch (error) {
    console.error("Failed to read ticket state:", error);
    return { nextTicketNumber: 1 };
  }
}

function saveTicketState(state) {
  fs.writeFileSync(ticketStatePath, JSON.stringify(state, null, 2));
}

function getHighestTicketNumber(guild) {
  return guild.channels.cache.reduce((highest, channel) => {
    if (channel.type !== ChannelType.GuildText) {
      return highest;
    }

    const match = channel.name.match(/^ticket-(\d+)$/);
    if (!match) {
      return highest;
    }

    return Math.max(highest, Number(match[1]));
  }, 0);
}

function formatTicketChannelName(number) {
  return `ticket-${String(number).padStart(4, "0")}`;
}

function reserveNextTicketChannelName(guild) {
  const state = readTicketState();
  let nextNumber = Math.max(state.nextTicketNumber, getHighestTicketNumber(guild) + 1);
  let channelName = formatTicketChannelName(nextNumber);

  while (
    guild.channels.cache.some(
      (channel) => channel.type === ChannelType.GuildText && channel.name === channelName
    )
  ) {
    nextNumber++;
    channelName = formatTicketChannelName(nextNumber);
  }

  saveTicketState({ nextTicketNumber: nextNumber + 1 });
  return channelName;
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

function userCanCloseTicket(interaction) {
  const ownerId = getTicketOwnerId(interaction.channel);
  return ownerId === interaction.user.id || userCanManageTicket(interaction);
}

function buildCloseTicketButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close_request")
      .setLabel("Fechar ticket")
      .setStyle(ButtonStyle.Danger)
  );
}

function buildCloseTicketConfirmRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close_confirm")
      .setLabel("Confirmar fechamento")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("ticket_close_cancel")
      .setLabel("Cancelar")
      .setStyle(ButtonStyle.Secondary)
  );
}

function messageHasCloseTicketButton(message) {
  return message.components.some((row) =>
    row.components.some((component) => component.customId === "ticket_close_request")
  );
}

function isTicketIntroMessage(message) {
  return (
    message.author.id === client.user.id &&
    message.embeds.some((embed) => embed.title === "Ticket aberto")
  );
}

function isDetachedTicketControlMessage(message) {
  return message.author.id === client.user.id && message.content === "Controle do ticket:";
}

async function backfillTicketCloseControls(guild) {
  await guild.channels.fetch().catch((error) => {
    console.error("Failed to refresh guild channels before ticket backfill:", error);
  });

  const ticketChannels = guild.channels.cache.filter(
    (channel) => channel.type === ChannelType.GuildText && isTicketChannel(channel)
  );
  let edited = 0;
  let sent = 0;
  let deleted = 0;

  for (const channel of ticketChannels.values()) {
    const messages = await channel.messages.fetch({ limit: 50 }).catch((error) => {
      console.error(`Failed to fetch ticket messages for ${channel.id}:`, error);
      return null;
    });

    if (!messages) {
      continue;
    }

    const ticketIntro = messages.find((message) => isTicketIntroMessage(message));
    const detachedControls = messages.filter(
      (message) => isDetachedTicketControlMessage(message) && messageHasCloseTicketButton(message)
    );

    if (ticketIntro) {
      if (!messageHasCloseTicketButton(ticketIntro)) {
        await ticketIntro.edit({ components: [buildCloseTicketButtonRow()] });
        edited++;
      }

      for (const message of detachedControls.values()) {
        await message.delete().catch((error) => {
          console.error(`Failed to delete detached ticket control ${message.id}:`, error);
        });
        deleted++;
      }
      continue;
    }

    const hasCloseButton = messages.some((message) => messageHasCloseTicketButton(message));

    if (hasCloseButton) {
      continue;
    }

    await channel.send({
      content: "Controle do ticket:",
      components: [buildCloseTicketButtonRow()]
    });
    sent++;
  }

  console.log(
    `Ticket close controls checked: ${ticketChannels.size}, edited: ${edited}, sent: ${sent}, deleted detached: ${deleted}`
  );
}

async function scrubTicketCreatorHistory(guild) {
  const logChannel = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildText && channel.name === "ticket-logs"
  );

  if (!logChannel) {
    return;
  }

  const messages = await logChannel.messages.fetch({ limit: 100 }).catch((error) => {
    console.error("Failed to fetch ticket log messages for scrubbing:", error);
    return null;
  });

  if (!messages) {
    return;
  }

  let edited = 0;

  for (const message of messages.values()) {
    if (message.author.id !== client.user.id || message.embeds.length === 0) {
      continue;
    }

    const embed = message.embeds[0].toJSON();
    const fields = embed.fields ?? [];
    const nextFields = fields.filter((field) => field.name !== "Aberto por");

    if (nextFields.length === fields.length) {
      continue;
    }

    embed.fields = nextFields;
    await message.edit({ embeds: [embed] });
    edited++;
  }

  console.log(`Ticket creator history scrubbed: ${edited}`);
}

async function getOrCreateTicketLogChannel(guild) {
  const category = await getOrCreateTicketCategory(guild);
  const existing = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.name === "ticket-logs"
  );

  if (existing) {
    return existing;
  }

  const staffRoles = getTicketStaffRoles(guild);

  return guild.channels.create({
    name: "ticket-logs",
    type: ChannelType.GuildText,
    parent: category.id,
    topic: "Registros de tickets fechados.",
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      },
      ...staffRoles.map((role) => ({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }))
    ]
  });
}

async function createTicketTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  return messages
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map((message) => {
      const content = message.content || "[sem texto]";
      return `[${new Date(message.createdTimestamp).toISOString()}] ${message.author.tag}: ${content}`;
    })
    .join("\n")
    .slice(-1700);
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
      .setCustomId("ticket_open")
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

async function createTicketForInteraction(interaction) {
  const guild = interaction.guild;
  const user = interaction.user;

  console.log(`Ticket create started for ${user.tag} (${user.id})`);

  await guild.channels.fetch().catch((error) => {
    console.error("Failed to refresh guild channels before ticket create:", error);
  });
  await guild.roles.fetch().catch((error) => {
    console.error("Failed to refresh guild roles before ticket create:", error);
  });

  const existing = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.topic?.includes(`ticket-owner:${user.id}`)
  );

  if (existing) {
    console.log(`Existing ticket found for ${user.id}: ${existing.id}`);
    return {
      created: false,
      message: `Você já tem um ticket aberto: ${existing}.`
    };
  }

  const category = await getOrCreateTicketCategory(guild);
  console.log(`Ticket category ready: ${category.id}`);
  const ticketChannelName = reserveNextTicketChannelName(guild);
  const channel = await guild.channels.create({
    name: ticketChannelName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `ticket-owner:${user.id}`,
    permissionOverwrites: buildTicketPermissionOverwrites(guild, user.id, client.user.id)
  });
  console.log(`Ticket channel created: ${channel.id}`);

  const staffRoles = getTicketStaffRoles(guild);

  await channel.send({
    content: staffRoles.map((role) => `${role}`).join(" "),
    allowedMentions: {
      roles: staffRoles.map((role) => role.id)
    },
    embeds: [
      {
        color: 0xd62828,
        title: "Ticket aberto",
        description: [
          "Explique seu problema ou pedido com o máximo de detalhes possível.",
          "",
          "Quando terminar, use o botão abaixo para fechar o ticket."
        ].join("\n"),
        timestamp: new Date().toISOString()
      }
    ],
    components: [buildCloseTicketButtonRow()]
  });
  console.log(`Ticket intro sent in channel: ${channel.id}`);

  return {
    created: true,
    message: `Ticket criado: ${channel}.`
  };
}

async function handleTicketCreate(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await createTicketForInteraction(interaction);

  await interaction.editReply({
    content: result.message
  });
}

async function handleTicketButtonCreate(interaction) {
  console.log(`Ticket button acknowledge started for ${interaction.user.tag} (${interaction.user.id})`);
  await interaction.deferUpdate();
  console.log(`Ticket button acknowledged for ${interaction.user.id}`);

  const result = await createTicketForInteraction(interaction);

  await interaction.followUp({
    flags: MessageFlags.Ephemeral,
    content: result.message
  });
}

async function handleTicketCloseRequest(interaction) {
  const channel = interaction.channel;

  if (!isTicketChannel(channel)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Este botão só pode ser usado dentro de um ticket."
    });
    return;
  }

  if (!userCanCloseTicket(interaction)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Você não tem permissão para fechar este ticket."
    });
    return;
  }

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: "Tem certeza que deseja fechar este ticket?",
    components: [buildCloseTicketConfirmRow()]
  });
}

async function handleTicketCloseCancel(interaction) {
  await interaction.update({
    content: "Fechamento cancelado.",
    components: []
  });
}

async function handleTicketCloseConfirm(interaction) {
  const channel = interaction.channel;

  if (!isTicketChannel(channel)) {
    await interaction.update({
      content: "Este botão só pode ser usado dentro de um ticket.",
      components: []
    });
    return;
  }

  if (!userCanCloseTicket(interaction)) {
    await interaction.update({
      content: "Você não tem permissão para fechar este ticket.",
      components: []
    });
    return;
  }

  await interaction.update({
    content: "Fechando ticket...",
    components: []
  });

  await handleTicketClose(interaction, "Fechado pelo botão.", "channel");
}

async function handleTicketClose(interaction, reasonOverride = null, responseMode = "reply") {
  const channel = interaction.channel;

  if (!isTicketChannel(channel)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Este comando só pode ser usado dentro de um ticket."
    });
    return;
  }

  if (!userCanCloseTicket(interaction)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Você não tem permissão para fechar este ticket."
    });
    return;
  }

  const reason = reasonOverride ?? interaction.options?.getString?.("motivo") ?? "Sem motivo informado.";
  const transcript = await createTicketTranscript(channel).catch((error) => {
    console.error("Failed to create ticket transcript:", error);
    return "Não foi possível gerar o transcript.";
  });
  const logChannel = await getOrCreateTicketLogChannel(interaction.guild).catch((error) => {
    console.error("Failed to get ticket log channel:", error);
    return null;
  });

  if (logChannel) {
    await logChannel.send({
      embeds: [
        {
          color: 0x4b5563,
          title: "Ticket fechado",
          fields: [
            {
              name: "Canal",
              value: `#${channel.name}`,
              inline: true
            },
            {
              name: "Fechado por",
              value: `${interaction.user} (${interaction.user.id})`,
              inline: false
            },
            {
              name: "Motivo",
              value: reason,
              inline: false
            }
          ],
          timestamp: new Date().toISOString()
        }
      ]
    });

    await logChannel.send({
      content: `Transcript de #${channel.name}:\n\`\`\`\n${transcript || "Sem mensagens."}\n\`\`\``
    });
  }

  const closeNotice = [
    `Ticket fechado por ${interaction.user}.`,
    `Motivo: ${reason}`,
    "",
    "Este canal será apagado em 5 segundos."
  ].join("\n");

  if (responseMode === "channel") {
    await channel.send({ content: closeNotice });
  } else {
    await interaction.reply({ content: closeNotice });
  }

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

  try {
    const guild = await client.guilds.fetch(guildId);
    await backfillTicketCloseControls(guild);
    await scrubTicketCreatorHistory(guild);
  } catch (error) {
    console.error("Failed to backfill ticket close controls:", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    console.log(
      `Interaction received: id=${interaction.id} type=${interaction.type} command=${interaction.commandName ?? ""} customId=${interaction.customId ?? ""}`
    );

    if (interaction.isButton()) {
      if (interaction.customId === "ticket_open" || interaction.customId === "ticket:create") {
        await handleTicketButtonCreate(interaction);
        return;
      }

      if (interaction.customId === "ticket_close_request") {
        await handleTicketCloseRequest(interaction);
        return;
      }

      if (interaction.customId === "ticket_close_confirm") {
        await handleTicketCloseConfirm(interaction);
        return;
      }

      if (interaction.customId === "ticket_close_cancel") {
        await handleTicketCloseCancel(interaction);
        return;
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

    if (interaction.commandName === "ticket-open") {
      await handleTicketCreate(interaction);
      return;
    }

    if (interaction.commandName === "ticket-close") {
      await handleTicketClose(interaction);
    }
  } catch (error) {
    console.error("Interaction failed:", error);

    const content = "Algo deu errado ao executar essa ação. A staff já pode verificar os logs do Kurokage.";

    if (interaction.isButton() && (interaction.deferred || interaction.replied)) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
    } else if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content }).catch(() => null);
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
    }
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
