import log from "npmlog";

export default class Logger {
  private static get prefix() {
    return `[${new Date().toISOString()}]`;
  }

  static verbose(message: string, ...args: any[]): void {
    log.verbose(this.prefix, message, ...args);
  }
  static info(message: string, ...args: any[]): void {
    log.info(this.prefix, message, ...args);
  }
  static warn(message: string, ...args: any[]): void {
    log.warn(this.prefix, message, ...args);
  }
  static error(message: string, ...args: any[]): void {
    log.error(this.prefix, message, ...args);
  }
}
