# Blueprint

## About

This is a bare-bones node server that is integrated with a MySql database

## Current Status

Basic Template with connection to MySql Database. Includes a database script that will create a users table and populate with two users.  

## Instalation and Setup
###### Install Node
If you don't already have node 0.8.16 or higher, you can [download node](http://nodejs.org/download) or [install node from a package](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager).

###### Clone blueprint from bitbucket
Clone the print repository to your local directory. You can use the following link: [https://jhollowell@bitbucket.org/dv-mobile/blueprint.git](https://jhollowell@bitbucket.org/dv-mobile/blueprint.git)

###### Instal Node Modules
```
cd path/to/blueprint
npm instal
```

## Configuration
### Application Configuration
Modify the Server config file (Server/config.js) to work with the MySql database. Currently, only the DB settings are required for application setup.

### Database Configuration

You will need to set up a MySQL database. Choose a database name, such as **blueprint**, then log into MySQL and create the database using the mysql command line client or a tool such as MySQLWorkbench:

```
CREATE DATABASE blueprint
  DEFAULT CHARACTER SET utf8
  DEFAULT COLLATE utf8_general_ci;

USE blueprint
source db/schema.sql
```

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