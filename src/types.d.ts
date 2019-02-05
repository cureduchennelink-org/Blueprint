import { LoggerOptions } from "bunyan";

export interface Config {
  [key: string]: object | string;

  env: string;
  log: LoggerOptions;
}

export interface ConfigOverrides {
  [key: string]: object | string;
}
