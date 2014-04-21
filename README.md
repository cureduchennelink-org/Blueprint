# Blueprint

## About

Blueprint is meant to be an out of the box template node server.

## Current Status

Basic Template with connection to MySql Database. Includes a database script that will create a users table and populate with two users.  

## Instalation and Setup
###### Install Node
If you don't already have node 0.8.16 or higher, you can [download node](http://nodejs.org/download) or [install node from a package](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager).

###### Clone blueprint from bitbucket
Clone the print repository to your local directory. You can use the following link: [https://jhollowell@bitbucket.org/dv-mobile/blueprint.git](https://jhollowell@bitbucket.org/dv-mobile/blueprint.git)

## Configuration
### Configuration Files
When the Blueprint server first launches, it will load the configuration details in config/default.js and merge it with the config file that matches the local enviroment specified. Modify the default config file to affect all enviroments that the node server is launched in and modify the environment config file to only set options for that enviroment.

### Database Configuration
The Blueprint server can be configured to talk to a MySQL database, MongoDB database or both. Enable either database in the default or environment config file. 

	db : {
        mysql: {
            enable: false,
            options: {
                host: 'localhost',
                port: 8889,
                user: 'root',
                password: 'root',
                database: 'blueprint',
                multipleStatements: true,
                minConnections: 2,
                maxConnections: 10,
                idleTimeoutMillis: 60000
            }
        },
        mongo: {
            enable: false,
            options: 'mongodb://localhost/mydb'
        }
    }
   

## Running
To run a blueprint from epic:  

```
export npm_config_env=epic
node MNC.js
```

To run a blueprint from a local box:  

```
export npm_config_env=local_dev
node MNC.js
```

## Newest Features
11-05-2013: Initial Commit: Remember, remember the 5th of November

## License
Copyright © DV-mobile 2013. All Rights Reserved.