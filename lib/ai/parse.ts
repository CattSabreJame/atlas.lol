export function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const candidate = text.slice(start, end + 1);

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}
