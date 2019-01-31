import merge from "lodash/merge";
import moment from "moment";
import Promise from "bluebird";
import Kit from "./lib/kit";
import Server from "./lib/server";
import Config from "./config";
import Logger from "./lib/logger";
import Error from "./lib/error";

const start = (
  services_enabled,
  routes_enabled,
  mysql_enabled,
  mysql_mods_enabled,
  mongo_enabled,
  more_config,
  more_kit
) => {
  const kit = new Kit();
  const config = merge(Config(), more_config);

  kit.add_service("config", config);
  kit.add_service("logger", Logger);
  kit.add_service("error", Error);
  merge(kit, more_kit);

  const server = new Server(kit);
  server.create();
  kit.add_service("server", server);
};

export default start;
