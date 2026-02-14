import fs from "node:fs";
import path from "node:path";

import { REST, Routes, SlashCommandBuilder } from "discord.js";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
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

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  const guildId = process.env.DISCORD_PRESENCE_GUILD_ID?.trim();
  const applicationId =
    process.env.DISCORD_CLIENT_ID?.trim()
    ?? process.env.DISCORD_APPLICATION_ID?.trim();

  if (!token || !guildId || !applicationId) {
    throw new Error("Missing DISCORD_BOT_TOKEN, DISCORD_PRESENCE_GUILD_ID, or DISCORD_CLIENT_ID in environment.");
  }

  const commands = commandPayload();
  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(Routes.applicationGuildCommands(applicationId, guildId), {
    body: commands,
  });

  console.log(`Synced ${commands.length} guild commands for guild ${guildId}.`);
}

main().catch((error) => {
  console.error("Failed to sync Discord commands:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
