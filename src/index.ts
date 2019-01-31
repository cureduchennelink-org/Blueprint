import merge from "lodash/merge";
import moment from "moment";
import Promise from "bluebird";
import Kit from "./lib/kit";
import Server from "./lib/server";

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
  const server = new Server(kit);

  server.create();
  kit.add_service("server", server);
};

export default start;
