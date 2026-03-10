export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, context: string, message: string, data?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`;
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  return `${prefix} ${message}${suffix}`;
}

export function createLogger(context: string) {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      if (shouldLog("debug")) console.debug(formatMessage("debug", context, message, data));
    },
    info(message: string, data?: Record<string, unknown>) {
      if (shouldLog("info")) console.info(formatMessage("info", context, message, data));
    },
    warn(message: string, data?: Record<string, unknown>) {
      if (shouldLog("warn")) console.warn(formatMessage("warn", context, message, data));
    },
    error(message: string, data?: Record<string, unknown>) {
      if (shouldLog("error")) console.error(formatMessage("error", context, message, data));
    },
  };
}
