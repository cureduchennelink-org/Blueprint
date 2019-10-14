blueprint = require("./index")

services = ['RunQueue']
routes = ['Registration', 'Auth', 'Poll', 'User', 'Workout']
mysql = ['auth', 'pset','pset_item','pset_item_change']

blueprint.start(true, services, routes, true, mysql, false)