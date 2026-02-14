export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const forceBootEmbeddedBot = process.env.ATLAS_BOOT_DISCORD_BOT === "true";

  // Avoid starting long-lived Discord gateway connections in serverless production runtimes.
  if (process.env.VERCEL === "1" && process.env.NODE_ENV === "production" && !forceBootEmbeddedBot) {
    return;
  }

  const shouldBootEmbeddedBot =
    forceBootEmbeddedBot
    || process.env.NODE_ENV !== "production";

  if (!shouldBootEmbeddedBot) {
    return;
  }

  try {
    const { ensureDiscordBotReady } = await import("@/lib/discord-bot");
    const ready = await ensureDiscordBotReady();

    if (ready) {
      console.log("Atlas Discord bot initialized.");
    } else {
      console.warn("Atlas Discord bot not initialized (missing env or login failed).");
    }
  } catch (error) {
    console.error("Atlas Discord bot startup failed", error);
  }
}
