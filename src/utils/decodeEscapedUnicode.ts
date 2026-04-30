const UNICODE_ESCAPE_PATTERN = /\\u([0-9a-fA-F]{4})/g;

export function decodeEscapedUnicode(value: string): string {
  if (!value.includes("\\u")) {
    return value;
  }

  return value.replace(UNICODE_ESCAPE_PATTERN, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}
