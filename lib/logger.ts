type LogContext = Record<string, unknown> | undefined;

export function logClientError(error: Error, context?: LogContext) {
  if (process.env.NODE_ENV !== "production") {
    console.error("[client-error]", error, context);
    return;
  }

  console.error("[client-error]", {
    message: error.message,
    name: error.name,
    stack: error.stack,
    context,
  });
}

export function logServerError(error: Error, context?: LogContext) {
  if (process.env.NODE_ENV !== "production") {
    console.error("[server-error]", error, context);
    return;
  }

  console.error("[server-error]", {
    message: error.message,
    name: error.name,
    stack: error.stack,
    context,
  });
}
