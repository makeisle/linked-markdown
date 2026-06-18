/**
 * Pure-TypeScript address parsing — a mirror of `lmd-core`'s `address.rs`
 * (`spec/SPEC.md` §5). This module has **no** wasm dependency, so the viewer and
 * editor can classify link targets without initializing the WebAssembly core.
 */

export type Address =
  | { kind: "local"; slug: string; version?: string }
  | { kind: "cross"; alias: string; target: string; version?: string }
  | { kind: "kg"; id: string }
  | { kind: "external"; raw: string };

function splitVersion(s: string): [string, string | undefined] {
  const at = s.lastIndexOf("@");
  if (at > 0 && at < s.length - 1) {
    return [s.slice(0, at), s.slice(at + 1)];
  }
  return [s, undefined];
}

function isAlias(s: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(s);
}

/** Classify a raw link-target string. */
export function parseAddress(raw: string): Address {
  raw = raw.trim();

  const kg = raw.match(/^kg:\/\/(.+)$/);
  if (kg) return { kind: "kg", id: kg[1] };
  if (raw.includes("://")) return { kind: "external", raw };

  if (raw.startsWith(":") || raw.startsWith("#")) {
    const [slug, version] = splitVersion(raw.slice(1));
    if (slug) return { kind: "local", slug, version };
    return { kind: "external", raw };
  }

  const colon = raw.indexOf(":");
  if (colon > 0) {
    const alias = raw.slice(0, colon);
    const [target, version] = splitVersion(raw.slice(colon + 1));
    if (isAlias(alias) && target) {
      return { kind: "cross", alias, target, version };
    }
  }

  return { kind: "external", raw };
}

/** True when the target is an lmd address (anything but `external`). */
export function isLmdAddress(raw: string): boolean {
  return parseAddress(raw).kind !== "external";
}

/** Parse a pin like `"@7"` or `"7"` into an integer, or `undefined`. */
export function parsePin(pin: string): number | undefined {
  const n = Number.parseInt(pin.replace(/^@/, ""), 10);
  return Number.isNaN(n) ? undefined : n;
}
