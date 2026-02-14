const UNSAFE_PATTERNS = [
  /\b(dox|doxx|personal address|phone number leak)\b/i,
  /\b(harass|abuse|bully|threaten)\b/i,
  /\b(hate speech|racial slur|ethnic cleansing)\b/i,
  /\b(kill|murder|assault|bomb)\b/i,
  /\b(hack|malware|phishing|fraud|scam)\b/i,
];

export function isUnsafePrompt(text: string): boolean {
  return UNSAFE_PATTERNS.some((pattern) => pattern.test(text));
}

export const AI_REFUSAL_MESSAGE =
  "I can only help with safe, public-profile writing requests.";
