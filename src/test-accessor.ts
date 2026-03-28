const BRACKET_PATTERN = /\[(\d+)\]/g;

function parseSegment(segment: string): (string | number)[] {
  const parts: (string | number)[] = [];
  let lastIndex = 0;

  for (const match of segment.matchAll(BRACKET_PATTERN)) {
    const prefix = segment.slice(lastIndex, match.index);
    if (prefix) parts.push(prefix);
    parts.push(parseInt(match[1], 10));
    lastIndex = match.index + match[0].length;
  }

  const remainder = segment.slice(lastIndex);
  if (remainder) parts.push(remainder);

  return parts;
}

export function accessPath(obj: unknown, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;

    const parts = parseSegment(segment);
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof part === "string" && !Object.hasOwn(current as object, part)) return undefined;
      current = (current as Record<string | number, unknown>)[part];
    }
  }

  return current;
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
