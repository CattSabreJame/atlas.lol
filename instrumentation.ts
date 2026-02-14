export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
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
