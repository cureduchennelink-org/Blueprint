import merge from "lodash/merge";
const path = require("path");
const fs = require("fs");
import config from "./default";

// TODO: Logger? not just console.log
const configIndex = async () => {
  const env = process.env.npm_config_env;
  const configDir = process.env.npm_config_config_dir;
  const execDir = process.cwd();
  let envPath = "";

  if (configDir) {
    // TODO: come back to this
    envPath = path.join(execDir, configDir, `${env}.js`);
    // _log('Env Config Path:', envPath);
  }

  // https://nodejs.org/api/fs.html#fs_fs_existssync_path
  if (fs.existsSync(envPath)) {
    // requires down here?
    merge(config, await import(envPath));
  } else {
    // log that we don't have environment specific configuration
  }

  config.env = env;
  config.processDir = execDir;
  return config;
};

export default configIndex;
