type EnvOptions = {
  allowEmptyInDev?: boolean;
};

const PLACEHOLDER_VALUES = new Set(["XXXXX", "your-secret-min-32-chars"]); // Placeholder values for unset environment variables
const DEFAULT_ENV_VALUE = "";

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed.length === 0 || PLACEHOLDER_VALUES.has(trimmed);
}

class MissingEnvError extends Error {
  constructor(variableName: string) {
    super(`Missing required environment variable: ${variableName}`);
    this.name = "MissingEnvError";
  }
}

function getEnvValue(name: string): string | undefined {
  return process.env[name];
}

export function getRequiredEnv(name: string, options: EnvOptions = {}): string {
  const value = getEnvValue(name);
  const isProd = process.env.NODE_ENV === "production";
  if (isPlaceholder(value)) {
    if (isProd || !options.allowEmptyInDev) {
      throw new MissingEnvError(name);
    }
    console.warn(
      `[env] Missing required environment variable '${name}'; using default value in development.`
    );
    return DEFAULT_ENV_VALUE;
  }
  return value as string;
}

export function getOptionalEnv(name: string): string | undefined {
  const value = getEnvValue(name);
  if (isPlaceholder(value)) return undefined;
  return value;
}
