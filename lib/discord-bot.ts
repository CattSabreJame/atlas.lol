import "server-only";

import {
  ActionRowBuilder,
  ActivityType,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Interaction,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { isDiscordUserId, normalizeDiscordStatus, type DiscordStatus } from "@/lib/discord";
import { getDiscordAppealUrl, getDiscordPresenceBotEnv, getDiscordPremiumTicketUrl, getSiteBaseUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

interface PresenceActivity {
  name: string | null;
  details: string | null;
  state: string | null;
}

interface PresenceListening {
  title: string;
  artist: string | null;
}

interface AtlasAccountConnection {
  id: string;
  handle: string;
  displayName: string | null;
  badges: string[];
  isPublic: boolean;
  commentsEnabled: boolean;
  isBanned: boolean;
  discordPresenceEnabled: boolean;
}

interface AtlasConnectionContext {
  account: AtlasAccountConnection | null;
  isAdmin: boolean;
}

interface AtlasWhoisProfile {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  badges: unknown;
  is_public: boolean;
  comments_enabled: boolean;
  is_banned: boolean;
  profile_effect: string;
  background_effect: string;
  theme: string;
  template: string;
  layout: string;
  discord_presence_enabled: boolean;
  discord_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AtlasHandleCreatedProfile {
  id: string;
  handle: string;
  display_name: string | null;
  created_at: string;
}

interface AtlasTicketHandleProfile {
  handle: string;
  display_name: string | null;
  bio: string | null;
  badges: unknown;
  is_public: boolean;
  comments_enabled: boolean;
}

type AtlasTicketHandleLookup =
  | {
    status: "found";
    profile: AtlasTicketHandleProfile;
  }
  | {
    status: "not_found";
    handle: string;
  }
  | {
    status: "lookup_failed";
    handle: string;
  };

export interface DiscordBotPresencePayload {
  status: DiscordStatus;
  username: string | null;
  globalName: string | null;
  avatarUrl: string | null;
  activity: PresenceActivity | null;
  listening: PresenceListening | null;
}

declare global {
  var __atlasDiscordBotClientPromise: Promise<Client | null> | undefined;
  var __atlasDiscordBotCommandsGuildId: string | undefined;
  var __atlasDiscordBotInteractionBound: boolean | undefined;
  var __atlasHandleCreateLogPollStarted: boolean | undefined;
  var __atlasHandleCreateLogCursor: string | undefined;
  var __atlasHandleCreateLogFailureCount: number | undefined;
  var __atlasHandleCreateLogBackoffUntil: number | undefined;
  var __atlasHandleCreateLogLastFailureLogAt: number | undefined;
}

const BRAND_COLOR = 0xc5bfb5;
const SUCCESS_COLOR = 0x7e9382;
const WARNING_COLOR = 0xb59b6f;
const ERROR_COLOR = 0xb86a6a;
const VALID_BADGES = new Set(["owner", "admin", "staff", "verified", "pro", "founder"]);
const COMMAND_SET_VERSION = "2026-02-14-v4";
const BOT_LOG_CHANNEL_ID = "1463878783043113021";
const HANDLE_CREATE_LOG_CHANNEL_ID = "1463878741607579749";
const PREMIUM_TICKET_CHANNEL_ID = "1463878773010337793";
const PREMIUM_TICKET_CATEGORY_ID = "1464083675254620332";
const PREMIUM_COMMAND_ROLE_ID = "1463881284215509287";
const PREMIUM_TICKET_ROLE_IDS = [
  "1463881284215509287",
  "1463881285557551217",
  "1463881287298453645",
] as const;
const PREMIUM_MODAL_ID = "atlas_premium_ticket_v1";
const PREMIUM_OPEN_TICKET_BUTTON_ID = "atlas_premium_open_ticket_v1";
const PREMIUM_TICKET_CLAIM_BUTTON_ID = "atlas_ticket_claim_v1";
const PREMIUM_TICKET_CLOSE_BUTTON_ID = "atlas_ticket_close_v1";
const PREMIUM_PLAN_NAME = "Atlas Pro Lifetime";
const PREMIUM_PLAN_PRICE_USD = 10;
const PREMIUM_PAYMENT_METHODS = ["venmo", "paypal", "cashapp"] as const;
const HANDLE_CREATE_LOG_POLL_INTERVAL_MS = 15_000;
const HANDLE_CREATE_LOG_BATCH_SIZE = 50;
const HANDLE_CREATE_LOG_MAX_QUERY_RETRIES = 3;
const HANDLE_CREATE_LOG_RETRY_BASE_DELAY_MS = 500;
const HANDLE_CREATE_LOG_BACKOFF_BASE_MS = 30_000;
const HANDLE_CREATE_LOG_BACKOFF_MAX_MS = 5 * 60_000;
const HANDLE_CREATE_LOG_FAILURE_LOG_THROTTLE_MS = 60_000;
type PremiumPaymentMethod = typeof PREMIUM_PAYMENT_METHODS[number];
type GuildScopedInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction;

function emptyPresence(status: DiscordStatus = "offline"): DiscordBotPresencePayload {
  return {
    status,
    username: null,
    globalName: null,
    avatarUrl: null,
    activity: null,
    listening: null,
  };
}

function createBaseEmbed(title: string, description: string, color = BRAND_COLOR): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toErrorMessage(value: unknown): string {
  if (value instanceof Error && value.message) {
    return value.message;
  }

  return String(value);
}

function isTransientHandleCreateSyncError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("fetch failed")
    || normalized.includes("network")
    || normalized.includes("timeout")
    || normalized.includes("timed out")
    || normalized.includes("socket")
    || normalized.includes("econn")
    || normalized.includes("enotfound")
    || normalized.includes("dns")
    || normalized.includes("undici")
  );
}

function shouldLogHandleCreateFailureNow(): boolean {
  const now = Date.now();
  const lastLoggedAt = globalThis.__atlasHandleCreateLogLastFailureLogAt ?? 0;

  if (now - lastLoggedAt < HANDLE_CREATE_LOG_FAILURE_LOG_THROTTLE_MS) {
    return false;
  }

  globalThis.__atlasHandleCreateLogLastFailureLogAt = now;
  return true;
}

function resetHandleCreateSyncFailureState(): void {
  globalThis.__atlasHandleCreateLogFailureCount = 0;
  globalThis.__atlasHandleCreateLogBackoffUntil = 0;
}

function scheduleHandleCreateSyncBackoff(message: string): { transient: boolean; attempt: number; delayMs: number } {
  const transient = isTransientHandleCreateSyncError(message);

  if (!transient) {
    return {
      transient: false,
      attempt: globalThis.__atlasHandleCreateLogFailureCount ?? 0,
      delayMs: 0,
    };
  }

  const attempt = (globalThis.__atlasHandleCreateLogFailureCount ?? 0) + 1;
  globalThis.__atlasHandleCreateLogFailureCount = attempt;

  const delayMs = Math.min(
    HANDLE_CREATE_LOG_BACKOFF_MAX_MS,
    HANDLE_CREATE_LOG_BACKOFF_BASE_MS * Math.pow(2, attempt - 1),
  );
  globalThis.__atlasHandleCreateLogBackoffUntil = Date.now() + delayMs;

  return {
    transient: true,
    attempt,
    delayMs,
  };
}

function formatPaymentMethods(): string {
  return PREMIUM_PAYMENT_METHODS.map((method) => method.toUpperCase()).join(", ");
}

function normalizePaymentMethod(value: string): PremiumPaymentMethod | null {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");

  if (normalized === "venmo") {
    return "venmo";
  }

  if (normalized === "paypal") {
    return "paypal";
  }

  if (normalized === "cashapp") {
    return "cashapp";
  }

  return null;
}

function buildPremiumTicketModal(): ModalBuilder {
  const handleInput = new TextInputBuilder()
    .setCustomId("atlas_handle")
    .setLabel("Atlas Handle (optional)")
    .setPlaceholder("@yourhandle")
    .setRequired(false)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(32);

  const paymentMethodInput = new TextInputBuilder()
    .setCustomId("payment_method")
    .setLabel("Payment Method")
    .setPlaceholder("venmo / paypal / cashapp")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(30);

  const paymentTagInput = new TextInputBuilder()
    .setCustomId("payment_tag")
    .setLabel("Payment Username/Tag")
    .setPlaceholder("@username, $cashtag, or PayPal email")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(120);

  const notesInput = new TextInputBuilder()
    .setCustomId("notes")
    .setLabel("Extra Notes (optional)")
    .setPlaceholder("Anything staff should know before sending payment instructions.")
    .setRequired(false)
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(400);

  return new ModalBuilder()
    .setCustomId(PREMIUM_MODAL_ID)
    .setTitle("Buy Atlas Pro")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(handleInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(paymentMethodInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(paymentTagInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(notesInput),
    );
}

function buildPremiumTicketPromptEmbed(): EmbedBuilder {
  return createBaseEmbed(
    "Atlas Pro Lifetime",
    [
      `Plan: **${PREMIUM_PLAN_NAME}**`,
      `Price: **$${PREMIUM_PLAN_PRICE_USD} one-time**`,
      `Accepted: **${formatPaymentMethods()}**`,
      "Click **Open Ticket** to submit purchase details to staff.",
    ].join("\n"),
    SUCCESS_COLOR,
  );
}

function buildPremiumTicketButtonRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PREMIUM_OPEN_TICKET_BUTTON_ID)
      .setLabel("Open Ticket")
      .setStyle(ButtonStyle.Primary),
  );
}

function buildTicketActionButtonRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PREMIUM_TICKET_CLAIM_BUTTON_ID)
      .setLabel("Claim Ticket")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(PREMIUM_TICKET_CLOSE_BUTTON_ID)
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger),
  );
}

function buildPremiumHandleEmbed(
  site: string,
  rawHandle: string,
  normalizedHandle: string,
  handleLookup: AtlasTicketHandleLookup | null,
): EmbedBuilder | null {
  if (!rawHandle) {
    return null;
  }

  if (!isValidHandle(normalizedHandle)) {
    return createBaseEmbed(
      "Handle Lookup",
      "Entered handle format is invalid. Expected 3-20 lowercase letters, numbers, or underscores.",
      WARNING_COLOR,
    ).addFields(
      {
        name: "Entered",
        value: rawHandle,
      },
      {
        name: "Result",
        value: "Lookup skipped due to invalid format.",
      },
    );
  }

  if (!handleLookup) {
    return createBaseEmbed(
      "Handle Lookup",
      "Lookup was not available for this ticket.",
      WARNING_COLOR,
    ).addFields({
      name: "Entered",
      value: `@${normalizedHandle}`,
    });
  }

  if (handleLookup.status === "not_found") {
    return createBaseEmbed(
      "Handle Lookup",
      `No Atlas profile found for **@${handleLookup.handle}**.`,
      WARNING_COLOR,
    ).addFields({
      name: "Entered",
      value: `@${handleLookup.handle}`,
    });
  }

  if (handleLookup.status === "lookup_failed") {
    return createBaseEmbed(
      "Handle Lookup",
      `Could not verify **@${handleLookup.handle}** right now.`,
      ERROR_COLOR,
    ).addFields({
      name: "Entered",
      value: `@${handleLookup.handle}`,
    });
  }

  return createBaseEmbed(
    "Handle Profile Summary",
    `[Open @${handleLookup.profile.handle}](${site}/@${handleLookup.profile.handle})\nNon-admin profile summary.`,
    SUCCESS_COLOR,
  ).addFields(
    {
      name: "Display Name",
      value: handleLookup.profile.display_name?.trim() || "Not set",
      inline: true,
    },
    {
      name: "Visibility",
      value: handleLookup.profile.is_public ? "Public" : "Private",
      inline: true,
    },
    {
      name: "Comments",
      value: handleLookup.profile.comments_enabled ? "Enabled" : "Disabled",
      inline: true,
    },
    {
      name: "Badges",
      value: formatBadges(handleLookup.profile.badges),
      inline: false,
    },
    {
      name: "Bio",
      value: truncate(handleLookup.profile.bio, 280),
      inline: false,
    },
  );
}

function parseClaimedByFromTopic(topic: string | null): string | null {
  if (!topic) {
    return null;
  }

  const match = topic.match(/claimed_by:([0-9]{17,20}|none)/i);

  if (!match) {
    return null;
  }

  return match[1] === "none" ? null : match[1];
}

function withClaimedByTopic(topic: string | null, claimedBy: string | null): string {
  const nextValue = claimedBy ?? "none";
  const base = (topic ?? "Atlas premium ticket").trim();
  const next = /claimed_by:[^|]+/i.test(base)
    ? base.replace(/claimed_by:[^|]+/i, `claimed_by:${nextValue}`)
    : `${base} | claimed_by:${nextValue}`;

  return next.slice(0, 1024);
}

async function hasAnyRole(
  interaction: GuildScopedInteraction,
  roleIds: readonly string[],
): Promise<boolean> {
  if (!interaction.guild) {
    return false;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

  if (!member) {
    return false;
  }

  return roleIds.some((roleId) => member.roles.cache.has(roleId));
}

async function ensureRoleAccess(
  interaction: GuildScopedInteraction,
  roleIds: readonly string[],
  label: string,
): Promise<boolean> {
  const allowed = await hasAnyRole(interaction, roleIds);

  if (allowed) {
    return true;
  }

  const roleMentions = roleIds.map((roleId) => `<@&${roleId}>`).join(" or ");

  await interaction.reply({
    embeds: [
      createBaseEmbed(
        "Access Denied",
        `${label} requires ${roleMentions}.`,
        ERROR_COLOR,
      ),
    ],
    ephemeral: true,
  });

  return false;
}

function normalizeBadgeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

async function setPremiumBadgeByHandle(
  rawHandle: string,
  makePremium: boolean,
): Promise<
  | { status: "invalid_handle"; handle: string }
  | { status: "not_found"; handle: string }
  | { status: "schema_outdated"; handle: string; message: string }
  | { status: "error"; handle: string }
  | { status: "ok"; handle: string; changed: boolean; badges: string[] }
> {
  const normalizedHandle = normalizeHandleInput(rawHandle);

  if (!isValidHandle(normalizedHandle)) {
    return {
      status: "invalid_handle",
      handle: normalizedHandle || rawHandle,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, badges")
    .eq("handle", normalizedHandle)
    .maybeSingle();

  if (error) {
    console.error("Discord premium badge lookup failed", {
      handle: normalizedHandle,
      message: error.message,
    });
    return {
      status: "error",
      handle: normalizedHandle,
    };
  }

  if (!data || typeof data.id !== "string" || typeof data.handle !== "string") {
    return {
      status: "not_found",
      handle: normalizedHandle,
    };
  }

  const currentBadges = normalizeBadgeArray(data.badges);
  const hasPro = currentBadges.includes("pro");
  const nextBadges = makePremium
    ? (hasPro ? currentBadges : [...currentBadges, "pro"])
    : currentBadges.filter((badge) => badge !== "pro");
  const changed = hasPro !== makePremium;

  if (changed) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ badges: nextBadges })
      .eq("id", data.id);

    if (updateError) {
      const updateMessage = updateError.message ?? "";

      if (
        updateMessage.includes("entry_gate_font_preset")
        || updateMessage.includes("entry_gate_custom_font_url")
        || updateMessage.includes("entry_gate_custom_font_name")
      ) {
        return {
          status: "schema_outdated",
          handle: normalizedHandle,
          message:
            "Database schema is outdated for profiles entry gate font columns. Apply migration: 202602140006_ai_pro_and_entry_fonts.sql",
        };
      }

      console.error("Discord premium badge update failed", {
        handle: normalizedHandle,
        message: updateMessage,
      });
      return {
        status: "error",
        handle: normalizedHandle,
      };
    }
  }

  return {
    status: "ok",
    handle: normalizedHandle,
    changed,
    badges: nextBadges,
  };
}

async function getPremiumTicketChannel(interaction: GuildScopedInteraction): Promise<TextChannel | null> {
  if (!interaction.guild) {
    return null;
  }

  const channelId = interaction.channelId;

  if (!channelId) {
    return null;
  }

  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);

  if (!channel || channel.type !== ChannelType.GuildText) {
    return null;
  }

  if (channel.parentId !== PREMIUM_TICKET_CATEGORY_ID) {
    return null;
  }

  return channel;
}

async function claimPremiumTicket(interaction: GuildScopedInteraction): Promise<void> {
  const hasTicketRole = await ensureRoleAccess(interaction, PREMIUM_TICKET_ROLE_IDS, "Claim Ticket");

  if (!hasTicketRole) {
    return;
  }

  const channel = await getPremiumTicketChannel(interaction);

  if (!channel) {
    await interaction.reply({
      embeds: [createBaseEmbed("Invalid Channel", "Claim Ticket works only in premium ticket channels.", ERROR_COLOR)],
      ephemeral: true,
    });
    return;
  }

  const claimedBy = parseClaimedByFromTopic(channel.topic);

  if (claimedBy && claimedBy !== interaction.user.id) {
    await interaction.reply({
      embeds: [createBaseEmbed("Already Claimed", `This ticket is already claimed by <@${claimedBy}>.`, WARNING_COLOR)],
      ephemeral: true,
    });
    return;
  }

  if (claimedBy === interaction.user.id) {
    await interaction.reply({
      embeds: [createBaseEmbed("Already Claimed", "You already claimed this ticket.", WARNING_COLOR)],
      ephemeral: true,
    });
    return;
  }

  await channel.setTopic(withClaimedByTopic(channel.topic, interaction.user.id)).catch(() => undefined);

  await channel.send({
    embeds: [
      createBaseEmbed(
        "Ticket Claimed",
        `<@${interaction.user.id}> claimed this premium ticket.`,
        SUCCESS_COLOR,
      ),
    ],
  });

  await interaction.reply({
    embeds: [createBaseEmbed("Claimed", `You claimed <#${channel.id}>.`, SUCCESS_COLOR)],
    ephemeral: true,
  });

  void sendBotLog(
    interaction.client,
    "Ticket Claimed",
    `<@${interaction.user.id}> claimed <#${channel.id}>`,
  );
}

async function closePremiumTicket(interaction: GuildScopedInteraction, reason: string | null): Promise<void> {
  const hasTicketRole = await ensureRoleAccess(interaction, PREMIUM_TICKET_ROLE_IDS, "Close Ticket");

  if (!hasTicketRole) {
    return;
  }

  const channel = await getPremiumTicketChannel(interaction);

  if (!channel) {
    await interaction.reply({
      embeds: [createBaseEmbed("Invalid Channel", "Close Ticket works only in premium ticket channels.", ERROR_COLOR)],
      ephemeral: true,
    });
    return;
  }

  const closeReason = reason?.trim() || "No reason provided.";

  await channel.send({
    embeds: [
      createBaseEmbed(
        "Ticket Closed",
        `Closed by <@${interaction.user.id}>.\nReason: ${closeReason}`,
        WARNING_COLOR,
      ),
    ],
  });

  await interaction.reply({
    embeds: [createBaseEmbed("Ticket Closed", `Closing <#${channel.id}> now.`, SUCCESS_COLOR)],
    ephemeral: true,
  });

  void sendBotLog(
    interaction.client,
    "Ticket Closed",
    `<@${interaction.user.id}> closed <#${channel.id}>`,
    [{ name: "Reason", value: truncate(closeReason, 500) }],
  );

  await channel.delete(`Closed by ${interaction.user.tag}: ${closeReason.slice(0, 80)}`).catch(() => undefined);
}

async function sendEmbedToChannel(client: Client, channelId: string, embed: EmbedBuilder): Promise<boolean> {
  try {
    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased() || !("send" in channel)) {
      return false;
    }

    await (channel as { send: (payload: { embeds: EmbedBuilder[] }) => Promise<unknown> }).send({
      embeds: [embed],
    });

    return true;
  } catch (error) {
    console.error("Discord channel embed send failed", {
      channelId,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function sendPremiumTicketPromptToChannel(client: Client): Promise<boolean> {
  try {
    const channel = await client.channels.fetch(PREMIUM_TICKET_CHANNEL_ID);

    if (!channel || !channel.isTextBased() || !("send" in channel)) {
      return false;
    }

    await (channel as {
      send: (payload: {
        embeds: EmbedBuilder[];
        components: ActionRowBuilder<ButtonBuilder>[];
      }) => Promise<unknown>;
    }).send({
      embeds: [buildPremiumTicketPromptEmbed()],
      components: [buildPremiumTicketButtonRow()],
    });

    return true;
  } catch (error) {
    console.error("Discord premium prompt send failed", {
      channelId: PREMIUM_TICKET_CHANNEL_ID,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

function buildTicketChannelName(username: string): string {
  const cleaned = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20) || "user";
  const suffix = Date.now().toString(36).slice(-4);
  return `premium-${cleaned}-${suffix}`.slice(0, 90);
}

async function createPremiumTicketChannel(
  interaction: ModalSubmitInteraction,
  enteredHandle: string,
): Promise<{
  id: string;
  send: (payload: {
    content?: string;
    embeds?: EmbedBuilder[];
    components?: ActionRowBuilder<ButtonBuilder>[];
  }) => Promise<unknown>;
} | null> {
  const guild = interaction.guild;

  if (!guild || !interaction.client.user) {
    return null;
  }

  const everyoneRoleId = guild.roles.everyone.id;
  const channelName = buildTicketChannelName(interaction.user.username);
  const ticketTopic = `Atlas premium ticket | user:${interaction.user.id} | handle:${enteredHandle} | claimed_by:none`.slice(0, 1024);

  try {
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: PREMIUM_TICKET_CATEGORY_ID,
      topic: ticketTopic,
      permissionOverwrites: [
        {
          id: everyoneRoleId,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        ...PREMIUM_TICKET_ROLE_IDS.map((roleId) => ({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        })),
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
        {
          id: interaction.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
      ],
    });

    if (!channel.isTextBased() || !("send" in channel)) {
      return null;
    }

    return channel as {
      id: string;
      send: (payload: {
        content?: string;
        embeds?: EmbedBuilder[];
        components?: ActionRowBuilder<ButtonBuilder>[];
      }) => Promise<unknown>;
    };
  } catch (error) {
    console.error("Discord premium ticket channel create failed", {
      categoryId: PREMIUM_TICKET_CATEGORY_ID,
      guildId: guild.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function sendBotLog(
  client: Client,
  title: string,
  description: string,
  fields: Array<{ name: string; value: string; inline?: boolean }> = [],
): Promise<void> {
  const embed = createBaseEmbed(title, description, BRAND_COLOR);

  if (fields.length > 0) {
    embed.addFields(fields.slice(0, 25));
  }

  await sendEmbedToChannel(client, BOT_LOG_CHANNEL_ID, embed);
}

function isHandleCreateRow(value: unknown): value is AtlasHandleCreatedProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const row = value as Partial<AtlasHandleCreatedProfile>;
  return (
    typeof row.id === "string"
    && typeof row.handle === "string"
    && typeof row.created_at === "string"
  );
}

function buildHandleCreatedEmbed(site: string, profile: AtlasHandleCreatedProfile): EmbedBuilder {
  return createBaseEmbed(
    "New Handle Created",
    `A new Atlas handle was created: **@${profile.handle}**`,
    SUCCESS_COLOR,
  ).addFields(
    {
      name: "Handle",
      value: `@${profile.handle}`,
      inline: true,
    },
    {
      name: "Display Name",
      value: profile.display_name?.trim() || "Not set",
      inline: true,
    },
    {
      name: "Profile",
      value: `${site}/@${profile.handle}`,
      inline: false,
    },
    {
      name: "User ID",
      value: profile.id,
      inline: false,
    },
    {
      name: "Created",
      value: formatDate(profile.created_at),
      inline: true,
    },
  );
}

async function seedHandleCreateLogCursor(): Promise<void> {
  if (globalThis.__atlasHandleCreateLogCursor) {
    return;
  }

  const supabase = createAdminClient();
  let latestCreatedAt: string | null = null;
  let errorMessage = "";

  for (let attempt = 1; attempt <= HANDLE_CREATE_LOG_MAX_QUERY_RETRIES; attempt += 1) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error) {
        latestCreatedAt = data && typeof data.created_at === "string" ? data.created_at : null;
        errorMessage = "";
        break;
      }

      errorMessage = error.message ?? "Unknown seed query error.";

      if (attempt < HANDLE_CREATE_LOG_MAX_QUERY_RETRIES && isTransientHandleCreateSyncError(errorMessage)) {
        await delay(HANDLE_CREATE_LOG_RETRY_BASE_DELAY_MS * attempt);
        continue;
      }

      break;
    } catch (error) {
      errorMessage = toErrorMessage(error);

      if (attempt < HANDLE_CREATE_LOG_MAX_QUERY_RETRIES && isTransientHandleCreateSyncError(errorMessage)) {
        await delay(HANDLE_CREATE_LOG_RETRY_BASE_DELAY_MS * attempt);
        continue;
      }

      break;
    }
  }

  if (errorMessage) {
    if (shouldLogHandleCreateFailureNow()) {
      console.error("Discord handle-create cursor seed failed", {
        message: errorMessage,
      });
    }
    globalThis.__atlasHandleCreateLogCursor = new Date().toISOString();
    return;
  }

  globalThis.__atlasHandleCreateLogCursor = latestCreatedAt ?? new Date().toISOString();
  resetHandleCreateSyncFailureState();
}

async function syncHandleCreateLogs(client: Client): Promise<void> {
  const backoffUntil = globalThis.__atlasHandleCreateLogBackoffUntil ?? 0;

  if (Date.now() < backoffUntil) {
    return;
  }

  await seedHandleCreateLogCursor();
  const cursor = globalThis.__atlasHandleCreateLogCursor;

  if (!cursor) {
    return;
  }

  const supabase = createAdminClient();
  let data: unknown[] | null = null;
  let errorMessage = "";

  for (let attempt = 1; attempt <= HANDLE_CREATE_LOG_MAX_QUERY_RETRIES; attempt += 1) {
    try {
      const result = await supabase
        .from("profiles")
        .select("id, handle, display_name, created_at")
        .gt("created_at", cursor)
        .order("created_at", { ascending: true })
        .limit(HANDLE_CREATE_LOG_BATCH_SIZE);

      if (!result.error) {
        data = Array.isArray(result.data) ? result.data : [];
        errorMessage = "";
        break;
      }

      errorMessage = result.error.message ?? "Unknown sync query error.";

      if (attempt < HANDLE_CREATE_LOG_MAX_QUERY_RETRIES && isTransientHandleCreateSyncError(errorMessage)) {
        await delay(HANDLE_CREATE_LOG_RETRY_BASE_DELAY_MS * attempt);
        continue;
      }

      break;
    } catch (error) {
      errorMessage = toErrorMessage(error);

      if (attempt < HANDLE_CREATE_LOG_MAX_QUERY_RETRIES && isTransientHandleCreateSyncError(errorMessage)) {
        await delay(HANDLE_CREATE_LOG_RETRY_BASE_DELAY_MS * attempt);
        continue;
      }

      break;
    }
  }

  if (errorMessage) {
    const backoff = scheduleHandleCreateSyncBackoff(errorMessage);

    if (shouldLogHandleCreateFailureNow()) {
      console.error("Discord handle-create sync failed", {
        cursor,
        message: errorMessage,
        transient: backoff.transient,
        attempt: backoff.attempt,
        nextRetryInMs: backoff.delayMs,
      });
    }
    return;
  }

  resetHandleCreateSyncFailureState();

  if (!Array.isArray(data) || data.length === 0) {
    return;
  }

  const site = getSiteBaseUrl();
  let lastCreatedAt = cursor;

  for (const item of data) {
    if (!isHandleCreateRow(item)) {
      continue;
    }

    const sent = await sendEmbedToChannel(
      client,
      HANDLE_CREATE_LOG_CHANNEL_ID,
      buildHandleCreatedEmbed(site, item),
    );

    if (!sent) {
      console.error("Discord handle-create log send failed", {
        channelId: HANDLE_CREATE_LOG_CHANNEL_ID,
        handle: item.handle,
      });
    }

    lastCreatedAt = item.created_at;
  }

  globalThis.__atlasHandleCreateLogCursor = lastCreatedAt;
}

function startHandleCreateLogPoller(client: Client): void {
  if (globalThis.__atlasHandleCreateLogPollStarted) {
    return;
  }

  globalThis.__atlasHandleCreateLogPollStarted = true;

  void syncHandleCreateLogs(client).catch((error) => {
    console.error("Discord handle-create initial sync failed", error);
  });

  setInterval(() => {
    void syncHandleCreateLogs(client).catch((error) => {
      console.error("Discord handle-create poll failed", error);
    });
  }, HANDLE_CREATE_LOG_POLL_INTERVAL_MS);
}

function normalizeHandleInput(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function isValidHandle(value: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(value);
}

function toBadgeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((badge): badge is string => typeof badge === "string")
    .map((badge) => badge.trim().toLowerCase())
    .filter((badge) => VALID_BADGES.has(badge));
}

function toBadgeLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatBadges(value: unknown): string {
  const badges = toBadgeArray(value);

  if (badges.length === 0) {
    return "None";
  }

  return badges.map(toBadgeLabel).join(", ");
}

function truncate(value: string | null | undefined, length: number): string {
  if (!value) {
    return "Not set.";
  }

  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, Math.max(0, length - 3)).trimEnd()}...`;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function createDiscordBotClient(token: string): Promise<Client | null> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
    ],
  });

  try {
    await client.login(token);
  } catch {
    client.destroy();
    return null;
  }

  if (client.isReady()) {
    return client;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Discord bot ready timeout.")), 10000);

      client.once("ready", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  } catch {
    client.destroy();
    return null;
  }

  return client;
}

function commandPayload() {
  return [
    new SlashCommandBuilder().setName("site").setDescription("Open atlas.lol"),
    new SlashCommandBuilder().setName("ping").setDescription("Check Atlas bot latency"),
    new SlashCommandBuilder().setName("support").setDescription("Open Atlas support links"),
    new SlashCommandBuilder()
      .setName("premium")
      .setDescription("Post premium ticket embed to the ticket channel"),
    new SlashCommandBuilder()
      .setName("premiuminfo")
      .setDescription("View premium pricing and accepted payment methods"),
    new SlashCommandBuilder()
      .setName("give-premium")
      .setDescription("Grant premium badge to a handle (staff role required)")
      .addStringOption((option) =>
        option
          .setName("handle")
          .setDescription("Atlas handle (with or without @)")
          .setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName("remove-premium")
      .setDescription("Remove premium badge from a handle (staff role required)")
      .addStringOption((option) =>
        option
          .setName("handle")
          .setDescription("Atlas handle (with or without @)")
          .setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName("premium-status")
      .setDescription("Check premium status for a handle (staff role required)")
      .addStringOption((option) =>
        option
          .setName("handle")
          .setDescription("Atlas handle (with or without @)")
          .setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName("claim-ticket")
      .setDescription("Claim the current premium ticket channel"),
    new SlashCommandBuilder()
      .setName("close-ticket")
      .setDescription("Close the current premium ticket channel")
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("Optional reason for closing the ticket")
          .setRequired(false),
      ),
    new SlashCommandBuilder()
      .setName("connect")
      .setDescription("Connect this Discord account to Atlas"),
    new SlashCommandBuilder()
      .setName("account")
      .setDescription("Show your Atlas connection status and quick links"),
    new SlashCommandBuilder().setName("editor").setDescription("Open your Atlas editor"),
    new SlashCommandBuilder().setName("dashboard").setDescription("Open your Atlas dashboard"),
    new SlashCommandBuilder()
      .setName("profile")
      .setDescription("Build a public profile URL from handle")
      .addStringOption((option) =>
        option
          .setName("handle")
          .setDescription("Atlas handle (with or without @)")
          .setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName("whois")
      .setDescription("Lookup an Atlas profile by handle")
      .addStringOption((option) =>
        option
          .setName("handle")
          .setDescription("Atlas handle (with or without @)")
          .setRequired(true),
      ),
    new SlashCommandBuilder()
      .setName("admin")
      .setDescription("Open Atlas admin tools (connected admin account required)"),
    new SlashCommandBuilder().setName("help").setDescription("List Atlas bot commands"),
  ].map((item) => item.toJSON());
}

function bindInteractionHandler(client: Client): void {
  if (globalThis.__atlasDiscordBotInteractionBound) {
    return;
  }

  client.on("interactionCreate", async (interaction: Interaction) => {
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction).catch((error) => {
        console.error("Discord button handler failed", error);
      });
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction).catch((error) => {
        console.error("Discord modal handler failed", error);
      });
      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    await handleCommand(interaction).catch((error) => {
      console.error("Discord command handler failed", error);
      void sendBotLog(
        interaction.client,
        "Command Handler Error",
        `/${interaction.commandName} failed`,
        [
          { name: "User", value: `${interaction.user.tag} (${interaction.user.id})` },
          { name: "Guild", value: interaction.guild?.name ?? "DM/Unknown" },
          {
            name: "Error",
            value: error instanceof Error ? truncate(error.message, 1000) : truncate(String(error), 1000),
          },
        ],
      );
    });
  });

  globalThis.__atlasDiscordBotInteractionBound = true;
}

async function getAtlasConnectionByDiscordUserId(discordUserId: string): Promise<AtlasAccountConnection | null> {
  if (!isDiscordUserId(discordUserId)) {
    return null;
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, handle, display_name, badges, is_public, comments_enabled, is_banned, discord_presence_enabled",
    )
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (error) {
    console.error("Discord command profile connection lookup failed", {
      discordUserId,
      message: error.message,
    });
    return null;
  }

  if (!data || typeof data.id !== "string" || typeof data.handle !== "string") {
    return null;
  }

  return {
    id: data.id,
    handle: data.handle,
    displayName: typeof data.display_name === "string" ? data.display_name : null,
    badges: toBadgeArray(data.badges),
    isPublic: Boolean(data.is_public),
    commentsEnabled: Boolean(data.comments_enabled),
    isBanned: Boolean(data.is_banned),
    discordPresenceEnabled: Boolean(data.discord_presence_enabled),
  };
}

async function lookupAtlasHandleForTicket(handle: string): Promise<AtlasTicketHandleLookup> {
  const normalizedHandle = normalizeHandleInput(handle);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("handle, display_name, bio, badges, is_public, comments_enabled")
    .eq("handle", normalizedHandle)
    .maybeSingle();

  if (error) {
    console.error("Discord premium ticket handle lookup failed", {
      handle: normalizedHandle,
      message: error.message,
    });

    return {
      status: "lookup_failed",
      handle: normalizedHandle,
    };
  }

  if (!data || typeof data.handle !== "string") {
    return {
      status: "not_found",
      handle: normalizedHandle,
    };
  }

  return {
    status: "found",
    profile: data as AtlasTicketHandleProfile,
  };
}

async function getAtlasAdminStatus(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Discord command admin lookup failed", {
      userId,
      message: error.message,
    });
    return false;
  }

  return Boolean(data?.user_id);
}

async function getAtlasConnectionContext(discordUserId: string): Promise<AtlasConnectionContext> {
  const account = await getAtlasConnectionByDiscordUserId(discordUserId);

  if (!account) {
    return { account: null, isAdmin: false };
  }

  const isAdmin = await getAtlasAdminStatus(account.id);
  return { account, isAdmin };
}

async function replyNotConnected(interaction: ChatInputCommandInteraction, site: string): Promise<void> {
  const embed = createBaseEmbed(
    "Connect Atlas To Discord",
    "This Discord account is not connected to Atlas yet.",
    WARNING_COLOR,
  )
    .addFields(
      {
        name: "Connect now",
        value: `[Connect your account](${site}/api/integrations/discord/connect)`,
      },
      {
        name: "Then what?",
        value: "After connecting, run the command again to manage your profile from Discord.",
      },
    )
    .setFooter({ text: "Atlas Discord Integration" });

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

async function requireConnectedContext(
  interaction: ChatInputCommandInteraction,
  site: string,
): Promise<AtlasConnectionContext | null> {
  const context = await getAtlasConnectionContext(interaction.user.id);

  if (!context.account) {
    await replyNotConnected(interaction, site);
    return null;
  }

  return context;
}

async function replyConnectionStatus(interaction: ChatInputCommandInteraction, site: string): Promise<void> {
  const context = await getAtlasConnectionContext(interaction.user.id);

  if (!context.account) {
    await replyNotConnected(interaction, site);
    return;
  }

  const { account, isAdmin } = context;
  const embed = createBaseEmbed(
    "Atlas Connected",
    `Connected as **@${account.handle}**${account.displayName ? ` (${account.displayName})` : ""}.`,
    SUCCESS_COLOR,
  )
    .addFields(
      {
        name: "Quick links",
        value: `[Editor](${site}/editor) | [Dashboard](${site}/dashboard) | [Profile](${site}/@${account.handle})`,
      },
      {
        name: "Account state",
        value: [
          `Badges: ${formatBadges(account.badges)}`,
          `Visibility: ${account.isPublic ? "Public" : "Private"}`,
          `Comments: ${account.commentsEnabled ? "Enabled" : "Disabled"}`,
          `Discord Presence: ${account.discordPresenceEnabled ? "Enabled" : "Disabled"}`,
          `Role: ${isAdmin ? "Admin" : "Creator"}`,
        ].join("\n"),
      },
    )
    .setFooter({ text: "Use /editor and /dashboard to manage your page." });

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

async function replyHelp(interaction: ChatInputCommandInteraction, site: string): Promise<void> {
  const context = await getAtlasConnectionContext(interaction.user.id);
  const embed = createBaseEmbed(
    "Atlas Bot Commands",
    "All commands return private embeds so your account details stay private.",
  );

  if (!context.account) {
    embed.addFields({
      name: "Connection required first",
      value: `[Connect Atlas](${site}/api/integrations/discord/connect)`,
    });
  } else {
    embed.addFields({
      name: "Connected account",
      value: `@${context.account.handle}${context.isAdmin ? " (Admin)" : ""}`,
      inline: false,
    });
  }

  embed.addFields(
    {
      name: "Core",
      value: "`/site`, `/ping`, `/help`, `/support`, `/connect`, `/account`, `/editor`, `/dashboard`",
    },
    {
      name: "Premium",
      value: "`/premium`, `/premiuminfo`\nLifetime only: **$10** via **VENMO / PAYPAL / CASHAPP**",
    },
    {
      name: "Staff Premium",
      value: "`/give-premium`, `/remove-premium`, `/premium-status`, `/claim-ticket`, `/close-ticket`",
    },
    {
      name: "Profile Lookup",
      value: "`/profile`, `/whois`",
    },
    {
      name: "Whois",
      value: "Use `/whois handle:@name` for full profile details, badges, and stats.",
    },
    {
      name: "Admin",
      value: context.isAdmin
        ? "You can use `/admin` and receive extra moderation data in `/whois`."
        : "Admin extras unlock automatically when your connected Atlas account is admin.",
    },
  );

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

async function handleWhoisCommand(
  interaction: ChatInputCommandInteraction,
  site: string,
  viewerContext: AtlasConnectionContext,
): Promise<void> {
  const rawHandle = interaction.options.getString("handle", true);
  const normalizedHandle = normalizeHandleInput(rawHandle);

  if (!isValidHandle(normalizedHandle)) {
    await interaction.reply({
      embeds: [
        createBaseEmbed(
          "Invalid Handle",
          "Use a valid handle: 3-20 chars, lowercase letters, numbers, underscores.",
          ERROR_COLOR,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, handle, display_name, bio, badges, is_public, comments_enabled, is_banned, profile_effect, background_effect, theme, template, layout, discord_presence_enabled, discord_user_id, created_at, updated_at",
    )
    .eq("handle", normalizedHandle)
    .maybeSingle();

  if (error) {
    console.error("Discord whois profile lookup failed", {
      handle: normalizedHandle,
      message: error.message,
    });

    await interaction.reply({
      embeds: [createBaseEmbed("Lookup Failed", "Could not load that Atlas profile right now.", ERROR_COLOR)],
      ephemeral: true,
    });
    return;
  }

  if (!data) {
    await interaction.reply({
      embeds: [createBaseEmbed("Profile Not Found", `No Atlas profile found for **@${normalizedHandle}**.`, ERROR_COLOR)],
      ephemeral: true,
    });
    return;
  }

  const profile = data as AtlasWhoisProfile;

  const [linksResult, tracksResult, widgetsResult, commentsResult, analyticsResult] = await Promise.all([
    supabase.from("links").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
    supabase.from("music_tracks").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
    supabase.from("widgets").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
    supabase
      .from("analytics_daily")
      .select("profile_views")
      .eq("user_id", profile.id)
      .order("day", { ascending: false })
      .limit(30),
  ]);

  const views30d = (analyticsResult.data ?? []).reduce((sum, row) => {
    if (!row || typeof row.profile_views !== "number") {
      return sum;
    }
    return sum + row.profile_views;
  }, 0);

  const embed = createBaseEmbed(
    `Whois @${profile.handle}`,
    `${profile.display_name ? `**${profile.display_name}**\n` : ""}[Open profile](${site}/@${profile.handle})`,
  ).addFields(
    { name: "Badges", value: formatBadges(profile.badges), inline: true },
    { name: "Visibility", value: profile.is_public ? "Public" : "Private", inline: true },
    { name: "Comments", value: profile.comments_enabled ? "Enabled" : "Disabled", inline: true },
    {
      name: "Stats",
      value: [
        `Links: ${linksResult.count ?? 0}`,
        `Music: ${tracksResult.count ?? 0}`,
        `Widgets: ${widgetsResult.count ?? 0}`,
        `Comments: ${commentsResult.count ?? 0}`,
        `Views (30d): ${views30d}`,
      ].join("\n"),
      inline: true,
    },
    {
      name: "Design",
      value: [
        `Theme: ${profile.theme}`,
        `Template: ${profile.template}`,
        `Layout: ${profile.layout}`,
        `Profile effect: ${profile.profile_effect}`,
        `Background effect: ${profile.background_effect}`,
      ].join("\n"),
      inline: true,
    },
    {
      name: "Bio",
      value: truncate(profile.bio, 280),
      inline: false,
    },
  );

  if (viewerContext.isAdmin) {
    embed
      .setColor(SUCCESS_COLOR)
      .addFields({
        name: "Admin Data",
        value: [
          `User ID: ${profile.id}`,
          `Banned: ${profile.is_banned ? "Yes" : "No"}`,
          `Discord Linked: ${isDiscordUserId(profile.discord_user_id) ? "Yes" : "No"}`,
          `Discord Presence: ${profile.discord_presence_enabled ? "Enabled" : "Disabled"}`,
          `Created: ${formatDate(profile.created_at)}`,
          `Updated: ${formatDate(profile.updated_at)}`,
        ].join("\n"),
      })
      .setFooter({ text: "Admin view: includes moderation metadata." });
  } else {
    embed.setFooter({ text: "Connect an admin Atlas account for moderation-level whois details." });
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

async function handlePremiumModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const site = getSiteBaseUrl();
  const rawHandle = interaction.fields.getTextInputValue("atlas_handle").trim();
  const rawPaymentMethod = interaction.fields.getTextInputValue("payment_method").trim();
  const paymentTag = interaction.fields.getTextInputValue("payment_tag").trim();
  const notes = interaction.fields.getTextInputValue("notes").trim();

  const paymentMethod = normalizePaymentMethod(rawPaymentMethod);

  if (!paymentMethod) {
    await interaction.reply({
      embeds: [
        createBaseEmbed(
          "Invalid Payment Method",
          `Only these payment methods are accepted: **${formatPaymentMethods()}**.`,
          ERROR_COLOR,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (!paymentTag) {
    await interaction.reply({
      embeds: [createBaseEmbed("Missing Payment Tag", "Please provide your payment username/tag.", ERROR_COLOR)],
      ephemeral: true,
    });
    return;
  }

  const connectedAccount = await getAtlasConnectionByDiscordUserId(interaction.user.id);
  const normalizedHandle = normalizeHandleInput(rawHandle);
  const handleLookup = rawHandle && isValidHandle(normalizedHandle)
    ? await lookupAtlasHandleForTicket(normalizedHandle)
    : null;
  const enteredHandle = rawHandle
    ? (isValidHandle(normalizedHandle) ? `@${normalizedHandle}` : `${rawHandle} (unverified)`)
    : "Not provided";
  const handleEmbed = buildPremiumHandleEmbed(site, rawHandle, normalizedHandle, handleLookup);

  const ticketEmbed = createBaseEmbed(
    "Premium Purchase Ticket",
    `${PREMIUM_PLAN_NAME} purchase request submitted.`,
    SUCCESS_COLOR,
  )
    .addFields(
      {
        name: "Buyer",
        value: `${interaction.user.tag} (${interaction.user.id})`,
      },
      {
        name: "Plan",
        value: `${PREMIUM_PLAN_NAME} - $${PREMIUM_PLAN_PRICE_USD} lifetime`,
      },
      {
        name: "Payment Method",
        value: paymentMethod.toUpperCase(),
        inline: true,
      },
      {
        name: "Payment Username/Tag",
        value: truncate(paymentTag, 180),
        inline: true,
      },
      {
        name: "Connected Atlas Account",
        value: connectedAccount ? `@${connectedAccount.handle}` : "Not connected",
      },
      {
        name: "Notes",
        value: notes ? truncate(notes, 500) : "None",
      },
    )
    .setFooter({ text: `Accepted payments: ${formatPaymentMethods()}` });

  const ticketChannel = await createPremiumTicketChannel(interaction, enteredHandle);

  if (!ticketChannel) {
    await interaction.reply({
      embeds: [
        createBaseEmbed(
          "Ticket Create Failed",
          "Could not create your premium ticket channel right now. Please try again or contact staff.",
          ERROR_COLOR,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const staffRoleMentions = PREMIUM_TICKET_ROLE_IDS.map((roleId) => `<@&${roleId}>`).join(" ");

  await ticketChannel.send({
    content: `${staffRoleMentions} <@${interaction.user.id}>`,
    embeds: handleEmbed ? [ticketEmbed, handleEmbed] : [ticketEmbed],
    components: [buildTicketActionButtonRow()],
  });

  await interaction.reply({
    embeds: [
      createBaseEmbed(
        "Ticket Submitted",
        `Your premium ticket is ready: <#${ticketChannel.id}>`,
        SUCCESS_COLOR,
      ),
    ],
    ephemeral: true,
  });

  void sendBotLog(
    interaction.client,
    "Premium Ticket Created",
    `${interaction.user.tag} submitted a premium purchase request.`,
    [
      {
        name: "Payment",
        value: paymentMethod.toUpperCase(),
        inline: true,
      },
      {
        name: "Handle",
        value: enteredHandle,
        inline: true,
      },
      {
        name: "Connected",
        value: connectedAccount ? `@${connectedAccount.handle}` : "No",
        inline: true,
      },
      {
        name: "Ticket Channel",
        value: `<#${ticketChannel.id}>`,
        inline: true,
      },
    ],
  );
}

async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId === PREMIUM_OPEN_TICKET_BUTTON_ID) {
    await interaction.showModal(buildPremiumTicketModal());
    return;
  }

  if (interaction.customId === PREMIUM_TICKET_CLAIM_BUTTON_ID) {
    await claimPremiumTicket(interaction);
    return;
  }

  if (interaction.customId === PREMIUM_TICKET_CLOSE_BUTTON_ID) {
    await closePremiumTicket(interaction, "Closed from ticket button.");
    return;
  }

  await interaction.reply({
    embeds: [createBaseEmbed("Unsupported Action", "This button is no longer supported.", WARNING_COLOR)],
    ephemeral: true,
  });
}

async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId === PREMIUM_MODAL_ID) {
    await handlePremiumModalSubmit(interaction);
    return;
  }

  await interaction.reply({
    embeds: [createBaseEmbed("Unsupported Modal", "This modal is no longer supported. Please run the command again.", WARNING_COLOR)],
    ephemeral: true,
  });
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const site = getSiteBaseUrl();
  const supportUrl = getDiscordAppealUrl();
  const premiumTicketUrl = getDiscordPremiumTicketUrl();
  const { commandName } = interaction;

  void sendBotLog(
    interaction.client,
    "Command Received",
    `/${commandName}`,
    [
      { name: "User", value: `${interaction.user.tag} (${interaction.user.id})` },
      { name: "Guild", value: interaction.guild?.name ?? "DM/Unknown" },
      { name: "Channel", value: interaction.channel?.toString() ?? "Unknown" },
    ],
  );

  if (commandName === "site") {
    const embed = createBaseEmbed("Atlas", `[Open atlas.lol](${site})`);
    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
    return;
  }

  if (commandName === "connect") {
    await replyConnectionStatus(interaction, site);
    return;
  }

  if (commandName === "help") {
    await replyHelp(interaction, site);
    return;
  }

  if (commandName === "ping") {
    const latency = Math.max(0, Date.now() - interaction.createdTimestamp);
    await interaction.reply({
      embeds: [
        createBaseEmbed(
          "Atlas Bot Status",
          `Bot latency: **${latency}ms**\nDiscord connection: **Online**`,
          SUCCESS_COLOR,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (commandName === "support") {
    await interaction.reply({
      embeds: [
        createBaseEmbed(
          "Atlas Support",
          `Need help or account review?\n[Support/Appeals](${supportUrl})\n[Premium Tickets](${premiumTicketUrl})`,
          SUCCESS_COLOR,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (commandName === "premiuminfo") {
    await interaction.reply({
      embeds: [
        createBaseEmbed(
          "Atlas Pro Pricing",
          [
            `Plan: **${PREMIUM_PLAN_NAME}**`,
            `Price: **$${PREMIUM_PLAN_PRICE_USD} one-time**`,
            `Accepted payments: **${formatPaymentMethods()}**`,
          ].join("\n"),
          SUCCESS_COLOR,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (commandName === "premium") {
    const canUsePremiumCommand = await ensureRoleAccess(
      interaction,
      [PREMIUM_COMMAND_ROLE_ID],
      "/premium",
    );

    if (!canUsePremiumCommand) {
      return;
    }

    const sent = await sendPremiumTicketPromptToChannel(interaction.client);

    if (!sent) {
      await interaction.reply({
        embeds: [
          createBaseEmbed(
            "Premium Ticket Channel Error",
            "Could not send the premium embed to the ticket channel. Check bot permissions and channel access.",
            ERROR_COLOR,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        createBaseEmbed(
          "Premium Embed Posted",
          `Posted to <#${PREMIUM_TICKET_CHANNEL_ID}>. Click **Open Ticket** on that embed to open the modal.`,
          SUCCESS_COLOR,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (commandName === "give-premium") {
    const canManagePremium = await ensureRoleAccess(
      interaction,
      [PREMIUM_COMMAND_ROLE_ID],
      "/give-premium",
    );

    if (!canManagePremium) {
      return;
    }

    const rawHandle = interaction.options.getString("handle", true);
    const result = await setPremiumBadgeByHandle(rawHandle, true);

    if (result.status === "invalid_handle") {
      await interaction.reply({
        embeds: [createBaseEmbed("Invalid Handle", "Provide a valid Atlas handle.", ERROR_COLOR)],
        ephemeral: true,
      });
      return;
    }

    if (result.status === "not_found") {
      await interaction.reply({
        embeds: [createBaseEmbed("Profile Not Found", `No profile found for **@${result.handle}**.`, ERROR_COLOR)],
        ephemeral: true,
      });
      return;
    }

    if (result.status === "schema_outdated") {
      await interaction.reply({
        embeds: [
          createBaseEmbed(
            "Schema Update Required",
            `${result.message}`,
            ERROR_COLOR,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (result.status === "error") {
      await interaction.reply({
        embeds: [createBaseEmbed("Update Failed", "Could not update premium badge right now.", ERROR_COLOR)],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        createBaseEmbed(
          result.changed ? "Premium Granted" : "Premium Already Active",
          `@${result.handle} now has premium badge access.`,
          SUCCESS_COLOR,
        ).addFields({
          name: "Badges",
          value: result.badges.length > 0 ? result.badges.join(", ") : "None",
        }),
      ],
      ephemeral: true,
    });

    void sendBotLog(
      interaction.client,
      "Premium Granted",
      `${interaction.user.tag} -> @${result.handle}`,
    );
    return;
  }

  if (commandName === "remove-premium") {
    const canManagePremium = await ensureRoleAccess(
      interaction,
      [PREMIUM_COMMAND_ROLE_ID],
      "/remove-premium",
    );

    if (!canManagePremium) {
      return;
    }

    const rawHandle = interaction.options.getString("handle", true);
    const result = await setPremiumBadgeByHandle(rawHandle, false);

    if (result.status === "invalid_handle") {
      await interaction.reply({
        embeds: [createBaseEmbed("Invalid Handle", "Provide a valid Atlas handle.", ERROR_COLOR)],
        ephemeral: true,
      });
      return;
    }

    if (result.status === "not_found") {
      await interaction.reply({
        embeds: [createBaseEmbed("Profile Not Found", `No profile found for **@${result.handle}**.`, ERROR_COLOR)],
        ephemeral: true,
      });
      return;
    }

    if (result.status === "schema_outdated") {
      await interaction.reply({
        embeds: [
          createBaseEmbed(
            "Schema Update Required",
            `${result.message}`,
            ERROR_COLOR,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (result.status === "error") {
      await interaction.reply({
        embeds: [createBaseEmbed("Update Failed", "Could not update premium badge right now.", ERROR_COLOR)],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        createBaseEmbed(
          result.changed ? "Premium Removed" : "Premium Already Removed",
          `@${result.handle} premium badge has been removed.`,
          WARNING_COLOR,
        ).addFields({
          name: "Badges",
          value: result.badges.length > 0 ? result.badges.join(", ") : "None",
        }),
      ],
      ephemeral: true,
    });

    void sendBotLog(
      interaction.client,
      "Premium Removed",
      `${interaction.user.tag} -> @${result.handle}`,
    );
    return;
  }

  if (commandName === "premium-status") {
    const canManagePremium = await ensureRoleAccess(
      interaction,
      [PREMIUM_COMMAND_ROLE_ID],
      "/premium-status",
    );

    if (!canManagePremium) {
      return;
    }

    const rawHandle = interaction.options.getString("handle", true);
    const normalizedHandle = normalizeHandleInput(rawHandle);

    if (!isValidHandle(normalizedHandle)) {
      await interaction.reply({
        embeds: [createBaseEmbed("Invalid Handle", "Provide a valid Atlas handle.", ERROR_COLOR)],
        ephemeral: true,
      });
      return;
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("handle, badges")
      .eq("handle", normalizedHandle)
      .maybeSingle();

    if (error) {
      await interaction.reply({
        embeds: [createBaseEmbed("Lookup Failed", "Could not load premium status right now.", ERROR_COLOR)],
        ephemeral: true,
      });
      return;
    }

    if (!data || typeof data.handle !== "string") {
      await interaction.reply({
        embeds: [createBaseEmbed("Profile Not Found", `No profile found for **@${normalizedHandle}**.`, ERROR_COLOR)],
        ephemeral: true,
      });
      return;
    }

    const badges = normalizeBadgeArray(data.badges);
    const hasPro = badges.includes("pro");

    await interaction.reply({
      embeds: [
        createBaseEmbed(
          `Premium Status: @${data.handle}`,
          hasPro ? "Premium badge is active." : "Premium badge is not active.",
          hasPro ? SUCCESS_COLOR : WARNING_COLOR,
        ).addFields({
          name: "Badges",
          value: badges.length > 0 ? badges.join(", ") : "None",
        }),
      ],
      ephemeral: true,
    });
    return;
  }

  if (commandName === "claim-ticket") {
    await claimPremiumTicket(interaction);
    return;
  }

  if (commandName === "close-ticket") {
    const reason = interaction.options.getString("reason");
    await closePremiumTicket(interaction, reason);
    return;
  }

  const context = await requireConnectedContext(interaction, site);

  if (!context || !context.account) {
    return;
  }

  if (commandName === "account") {
    const embed = createBaseEmbed(
      "Atlas Account",
      `You are connected as **@${context.account.handle}**.`,
      SUCCESS_COLOR,
    ).addFields(
      {
        name: "Quick links",
        value: `[Editor](${site}/editor) | [Dashboard](${site}/dashboard) | [Profile](${site}/@${context.account.handle})`,
      },
      {
        name: "Badges",
        value: formatBadges(context.account.badges),
      },
    );

    if (context.isAdmin) {
      embed.addFields({ name: "Admin", value: `You can use \`/admin\` and \`/whois\` with admin data.` });
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
    return;
  }

  if (commandName === "editor") {
    await interaction.reply({
      embeds: [
        createBaseEmbed(
          "Open Atlas Editor",
          `Manage your profile settings here:\n[Open Editor](${site}/editor)`,
          SUCCESS_COLOR,
        ).setFooter({ text: `Connected as @${context.account.handle}` }),
      ],
      ephemeral: true,
    });
    return;
  }

  if (commandName === "dashboard") {
    await interaction.reply({
      embeds: [
        createBaseEmbed(
          "Open Atlas Dashboard",
          `View analytics and trends here:\n[Open Dashboard](${site}/dashboard)`,
          SUCCESS_COLOR,
        ).setFooter({ text: `Connected as @${context.account.handle}` }),
      ],
      ephemeral: true,
    });
    return;
  }

  if (commandName === "profile") {
    const rawHandle = interaction.options.getString("handle", true);
    const normalizedHandle = normalizeHandleInput(rawHandle);

    if (!isValidHandle(normalizedHandle)) {
      await interaction.reply({
        embeds: [
          createBaseEmbed(
            "Invalid Handle",
            "Use a valid handle: 3-20 chars, lowercase letters, numbers, underscores.",
            ERROR_COLOR,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        createBaseEmbed(
          `Profile @${normalizedHandle}`,
          `[Open profile](${site}/@${normalizedHandle})`,
          SUCCESS_COLOR,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  if (commandName === "whois") {
    await handleWhoisCommand(interaction, site, context);
    return;
  }

  if (commandName === "admin") {
    if (!context.isAdmin) {
      await interaction.reply({
        embeds: [
          createBaseEmbed(
            "Admin Access Required",
            "Your connected Atlas account is not an admin account.",
            ERROR_COLOR,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        createBaseEmbed(
          "Atlas Admin Tools",
          `[Open Admin Console](${site}/admin)\nUse \`/whois\` for deep profile checks with moderation metadata.`,
          SUCCESS_COLOR,
        ).addFields({
          name: "Connected admin",
          value: `@${context.account.handle}`,
        }),
      ],
      ephemeral: true,
    });
    return;
  }
}

async function ensureGuildCommands(client: Client, guildId: string): Promise<void> {
  const registrationKey = `${guildId}:${COMMAND_SET_VERSION}`;

  if (globalThis.__atlasDiscordBotCommandsGuildId === registrationKey) {
    return;
  }

  if (!client.application) {
    return;
  }

  await client.application.fetch();
  await client.application.commands.set(commandPayload(), guildId);
  globalThis.__atlasDiscordBotCommandsGuildId = registrationKey;
}

async function getDiscordBotClient(): Promise<{ client: Client; guildId: string } | null> {
  const config = getDiscordPresenceBotEnv();

  if (!config) {
    return null;
  }

  if (!globalThis.__atlasDiscordBotClientPromise) {
    globalThis.__atlasDiscordBotClientPromise = createDiscordBotClient(config.token);
  }

  const client = await globalThis.__atlasDiscordBotClientPromise;

  if (!client) {
    return null;
  }

  bindInteractionHandler(client);
  await ensureGuildCommands(client, config.guildId).catch((error) => {
    console.error("Discord command registration failed", error);
  });
  startHandleCreateLogPoller(client);

  return { client, guildId: config.guildId };
}

export async function ensureDiscordBotReady(): Promise<boolean> {
  const context = await getDiscordBotClient();
  return Boolean(context);
}

function pickPrimaryActivity(includeActivity: boolean, activities: Array<{
  type: number;
  name: string;
  details: string | null;
  state: string | null;
}>): PresenceActivity | null {
  if (!includeActivity) {
    return null;
  }

  const activity = activities.find((item) => item.type !== ActivityType.Custom);

  if (!activity) {
    return null;
  }

  return {
    name: activity.name ?? null,
    details: activity.details ?? null,
    state: activity.state ?? null,
  };
}

function pickListening(includeActivity: boolean, activities: Array<{
  type: number;
  name: string;
  details: string | null;
  state: string | null;
}>): PresenceListening | null {
  if (!includeActivity) {
    return null;
  }

  const listening = activities.find((item) => item.type === ActivityType.Listening);

  if (!listening) {
    return null;
  }

  const title = listening.details?.trim() || listening.name?.trim();

  if (!title) {
    return null;
  }

  return {
    title,
    artist: listening.state?.trim() || null,
  };
}

export async function getDiscordPresenceFromBot(
  userId: string,
  includeActivity: boolean,
): Promise<DiscordBotPresencePayload | null> {
  if (!isDiscordUserId(userId)) {
    return emptyPresence();
  }

  const context = await getDiscordBotClient();

  if (!context) {
    return null;
  }

  const { client, guildId } = context;

  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId).catch(() => null);
    const user = member?.user ?? (await client.users.fetch(userId).catch(() => null));
    const presence = member?.presence ?? guild.presences.cache.get(userId) ?? null;

    const activities = (presence?.activities ?? [])
      .filter((activity) => activity && typeof activity.name === "string" && activity.name.trim().length > 0)
      .map((activity) => ({
        type: activity.type,
        name: activity.name,
        details: activity.details ?? null,
        state: activity.state ?? null,
      }));

    return {
      status: normalizeDiscordStatus(presence?.status),
      username: user?.username ?? null,
      globalName: user?.globalName ?? null,
      avatarUrl: user
        ? user.displayAvatarURL({
            extension: "png",
            size: 128,
          })
        : null,
      activity: pickPrimaryActivity(includeActivity, activities),
      listening: pickListening(includeActivity, activities),
    };
  } catch {
    return emptyPresence();
  }
}
