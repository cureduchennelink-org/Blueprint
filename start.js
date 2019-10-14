blueprint = require("./index")

services = []
routes = []
// mysql = ['auth', 'pset','pset_item','pset_item_change']
mysql = []
psql= ["token", "auth"]


// blueprint.start(true, services, routes, true, mysql, false)
blueprint.start(true, services, routes, false, mysql, true, psql, false)