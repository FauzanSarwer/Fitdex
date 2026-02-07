type EnvOptions = {
  allowEmptyInDev?: boolean;
};

const PLACEHOLDER_VALUES = new Set(["XXXXX", "your-secret-min-32-chars"]);

function isPlaceholder(value: string | undefined) {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed.length === 0 || PLACEHOLDER_VALUES.has(trimmed);
}

export function getRequiredEnv(name: string, options: EnvOptions = {}) {
  const value = process.env[name];
  const isProd = process.env.NODE_ENV === "production";
  if (isPlaceholder(value)) {
    if (isProd || !options.allowEmptyInDev) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    console.warn(`[env] Missing required ${name}; using empty value in dev.`);
    return "";
  }
  return value as string;
}

export function getOptionalEnv(name: string) {
  const value = process.env[name];
  if (isPlaceholder(value)) return undefined;
  return value;
}
