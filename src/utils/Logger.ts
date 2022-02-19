import log from "npmlog";

const LogLevelList = ["verbose", "info", "warn", "error"] as const;
export type LogLevels = typeof LogLevelList[number];

const prefixed = (prefix: string) => {
  return LogLevelList.reduce(
    (acc, l) => {
      acc[l] = (message, ...args) => log[l](prefix, message, ...args);
      return acc;
    },
    {} as {
      [l in LogLevels]: (message: string, ...args: any[]) => void;
    }
  );
};

const Logger = {
  /**
   *  Defaults loggers, prefixed with timestamp
   */
  ...prefixed(`[${new Date().toISOString()}]`),
  /**
   * Logger.plain logs plain messages without any prefixes
   */
  plain: prefixed(""),
  /**
   * Logger.prefixed allows custom prefixes
   */
  prefixed,
  /**
   * Set the global log level, defaults to "info"
   * @param level log level
   * @returns current log level
   */
  setGlobalLogLevel: (level: LogLevels) => (log.level = level),
  /**
   * Log out fatal error message and crash the program
   * @param message Error message
   * @param additionalInfo Any additional information
   */
  fatal: (message: string, ...additionalInfo: any) => {
    Logger.prefixed("FATAL").error(message, additionalInfo);
    Logger.prefixed("FATAL").error(
      "Encountered unrecoverable fatal error, exiting."
    );
    process.exit(1);
  },
};

export default Logger;
