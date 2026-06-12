import { createHash } from "node:crypto";

/** Concatenate parts then SHA1 hex (Worldmove spec). */
export function sha1Concat(
  parts: Array<string | number | boolean>,
  /** Request examples in PDF use UPPERCASE hex for encStr. */
  uppercase = true,
): string {
  const raw = parts.map((p) => String(p)).join("");
  const hex = createHash("sha1").update(raw, "utf8").digest("hex");
  return uppercase ? hex.toUpperCase() : hex;
}

/** Compare encStr case-insensitively (docs mix upper/lower hex). */
export function encStrMatches(expected: string, received: string): boolean {
  return expected.toLowerCase() === received.toLowerCase();
}
