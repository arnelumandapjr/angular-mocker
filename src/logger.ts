import 'colors';

export enum LogLevel {
  Verbose = 0,
  Debug = 1,
  Report = 2
}

export class Logger {
  static logLevel = LogLevel.Debug;

  static debug(message: string, level: LogLevel = LogLevel.Debug) {
    this.log('DEBUG'.bgBlue+` ${message}`, level);
  }
  static success(message: string, level: LogLevel = LogLevel.Report) {
    this.log('SUCCESS'.bgGreen+` ${message}`, level);
  }
  static warn(message: string, level: LogLevel = LogLevel.Verbose) {
    this.log('WARN'.bgYellow+` ${message}`, level);
  }
  static error(message: string, level: LogLevel = LogLevel.Report) {
    this.log(`ERROR ${message}`.red, level);
  }

  static log(message: string, level: LogLevel = LogLevel.Debug) {
    if (level < this.logLevel) {
      return;
    }
    console.log(message);
  }
}
