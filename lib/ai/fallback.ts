import { AIRequest } from "@/lib/validations";
import { websiteFromUrl } from "@/lib/utils";

const BIO_LENGTHS = {
  short: 1,
  medium: 2,
  long: 3,
} as const;

function createBioLines(vibe: string, interests: string, count: number): string {
  const interestText = interests.trim() || "creative work and meaningful projects";
  const base = `I share ${interestText} with a ${vibe} lens.`;

  if (count === 1) {
    return base;
  }

  if (count === 2) {
    return `${base} Tap in for concise updates, selected links, and work you can use.`;
  }

  return `${base} Tap in for concise updates, selected links, and work you can use. Building in public with focus, consistency, and calm execution.`;
}

export function createFallbackResult(payload: AIRequest) {
  if (payload.action === "bio-generate") {
    const lineCount = BIO_LENGTHS[payload.length];
    return {
      options: [
        createBioLines(payload.vibe, payload.interests, lineCount),
        createBioLines(payload.vibe, `${payload.interests} and thoughtful storytelling`, lineCount),
        createBioLines(payload.vibe, `${payload.interests} for curious people`, lineCount),
      ],
    };
  }

  if (payload.action === "link-label") {
    const website = websiteFromUrl(payload.url);
    return {
      title: `Visit ${website}`,
      description: `A ${payload.vibe} pick from ${website}.`,
    };
  }

  const compact = payload.bio
    .replace(/\s+/g, " ")
    .replace(/\s*([,.!?])\s*/g, "$1 ")
    .trim();

  return {
    minimal: compact,
    expressive: `${compact} Sharing progress, perspective, and useful resources along the way.`,
  };
}
