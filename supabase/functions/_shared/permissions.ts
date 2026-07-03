export const PUBLISHABLE_PERMISSIONS = [
  "read:blogs",
  "read:pages",
  "read:media",
  "read:collections",
  "read:faqs",
  "read:news",
  "read:products",
  "read:articles",
  "write:engagement",
] as const;

export const SECRET_PERMISSIONS = [
  ...PUBLISHABLE_PERMISSIONS,
  "write:blogs",
  "write:pages",
  "write:media",
  "write:collections",
  "write:faqs",
  "write:news",
  "write:products",
  "write:articles",
  "manage:api_keys",
  "manage:comments",
] as const;

export type Permission =
  | (typeof PUBLISHABLE_PERMISSIONS)[number]
  | (typeof SECRET_PERMISSIONS)[number];

/** Check whether a key's permission list includes a required scope. */
export function hasPermission(
  permissions: string[],
  required: string,
): boolean {
  return permissions.includes("*") || permissions.includes(required);
}

/** Return the default permission set for a given key type. */
export function defaultPermissions(
  keyType: "publishable" | "secret",
): string[] {
  return keyType === "secret"
    ? [...SECRET_PERMISSIONS]
    : [...PUBLISHABLE_PERMISSIONS];
}
