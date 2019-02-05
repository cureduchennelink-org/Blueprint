import merge from "lodash/merge";
const path = require("path");
const fs = require("fs");
import config from "./default";
import Logger from "../lib/logger";
import * as types from "../types";

// TODO: Logger? not just console.log
export default async (configOverrides: types.ConfigOverrides): types.Config => {
  const log = new Logger();
  const env = process.env.npm_config_env || "";
  const configDir = process.env.npm_config_config_dir || ".";
  const execDir = process.cwd();

  let appConfig = config;
  let envPath = path.join(execDir, configDir, `${env}`);
  // _log('Env Config Path:', envPath);

  // https://nodejs.org/api/fs.html#fs_fs_existssync_path
  if (fs.existsSync(envPath)) {
    // requires down here?
    appConfig = merge(config, await import(envPath));
  } else {
    // log that we don't have environment specific configuration
  }

  appConfig.env = env;
  appConfig.processDir = execDir;
  return appConfig;
};

// export default configIndex;
