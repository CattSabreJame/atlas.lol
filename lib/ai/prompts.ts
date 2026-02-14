import { AIRequest } from "@/lib/validations";

export const AI_SYSTEM_PROMPT = `You are a writing assistant for a premium public bio and link platform.
- Keep outputs concise, polished, and safe for public profiles.
- Refuse harassment, doxxing, hate, violence, wrongdoing, or harmful instructions.
- Do not include profanity or explicit content.
- Respect the requested tone.
- Return JSON only, with no markdown.`;

export function buildAiUserPrompt(payload: AIRequest): string {
  if (payload.action === "bio-generate") {
    return `Task: Generate 3 distinct profile bio options.\nTone: ${payload.vibe}\nInterests: ${payload.interests}\nLength: ${payload.length}\nOutput schema: {"options":["string","string","string"]}`;
  }

  if (payload.action === "link-label") {
    return `Task: Suggest a clean link title and one-line description for this URL.\nTone: ${payload.vibe}\nURL: ${payload.url}\nOutput schema: {"title":"string","description":"string"}`;
  }

  return `Task: Polish this bio while preserving tone and meaning.\nTone: ${payload.vibe}\nBio: ${payload.bio}\nOutput schema: {"minimal":"string","expressive":"string"}`;
}
