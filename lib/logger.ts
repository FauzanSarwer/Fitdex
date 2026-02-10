type LogContext = Record<string, unknown> | undefined;

type LogLevel = "CLIENT_ERROR" | "SERVER_ERROR" | "INFO" | "WARN";

const LOG_LEVELS = {
  CLIENT_ERROR: "[client-error]",
  SERVER_ERROR: "[server-error]",
  INFO: "[info]",
  WARN: "[warn]",
} as const;

function getTimestamp(): string {
  return new Date().toISOString();
}

function logError(level: LogLevel, error: unknown, context?: LogContext) {
  const timestamp = getTimestamp();
  if (!(error instanceof Error)) {
    console.error(`${LOG_LEVELS[level]} [${timestamp}]`, "Invalid error object", { error, context });
    return;
  }

  const logData = {
    message: error.message,
    name: error.name,
    stack: error.stack,
    context,
  };

  if (process.env.NODE_ENV !== "production") {
    console.error(`${LOG_LEVELS[level]} [${timestamp}]`, error, context);
  } else {
    console.error(`${LOG_LEVELS[level]} [${timestamp}]`, logData);
  }
}

function logMessage(level: LogLevel, message: string, context?: LogContext) {
  const timestamp = getTimestamp();
  console.log(`${LOG_LEVELS[level]} [${timestamp}]`, message, context);
}

export function logClientError(error: unknown, context?: LogContext) {
  logError("CLIENT_ERROR", error, context);
}

export function logServerError(error: unknown, context?: LogContext) {
  logError("SERVER_ERROR", error, context);
}

export function logInfo(message: string, context?: LogContext) {
  logMessage("INFO", message, context);
}

export function logWarn(message: string, context?: LogContext) {
  logMessage("WARN", message, context);
}
