# Blueprint.node

## HOME

## Getting Started
This is a guide to installing and using blueprint in your node application. This will initial example will be written using postgres as the backend database. 

### Installing

When installing into your project, include the blueprint library in you package.json, with the branch of blueprint you will utilize
```
    "blueprint": "git+https://git@bitbucket.org/dv-mobile/blueprint.git#master-psql-es6"
```

Create an app.js initialization file in `src/app.js` of your working directory
```javascript
//
// src/app: Node entry point
//
// See below for where to add your modules
//
const blueprint = require("blueprint");

// Blueprint project references
const services = [
  "RunQueue",
  "tokenMgr",
  "lamd",
  "CORS",
  "login_key",
  "tasks",
  "tripMgr",
  "ses",
];
const routes = ["Health"]; 
const mysql = [];
const psql = [
  "runqueue",
  "lamd",
  "token"
]; // 'auth' needed for core.pwd_col

// Add local modules
services.push("BCPlatforms", "Consent", "Docusign");
routes.push('docusignWebhook');
psql.push("consent", "ident");

blueprint
  .start(true, services, routes, false, mysql, true, psql, false)
  .then(function (kit) {
    // JCS: Add HTTPS support
    // JCS: SERIOUSLY CONSIDERING TO EMIT AN EVENT, SO ANY MODULE CAN DETECT THIS FOR DRAINING REASONS
    process.on("SIGINT", function () {
      const d = new Date();
      console.log(d.toUTCString() + " SIGINT");

      return kit.services.RunQueue != null
        ? kit.services.RunQueue.Drain()
        : undefined;
    });
    console.log(process.version)

    return console.log(
      "Node.js in service on port: " + process.env.PORT
    );
  });

process.on("unhandledRejection", function (reason, p) {
  const d = new Date();
  return console.error(d.toUTCString() + " unhandledRejection:", {
    reason,
    p,
  });
});

process.on("uncaughtException", function (err) {
  const d = new Date();
  console.error(d.toUTCString() + " uncaughtException:", err.message);
  console.error(err.stack);
  return process.exit(198);
});

process.on("warning", function (e) {
  const d = new Date();
  return console.error(`${d.toUTCString()} warning:`, {
    name: e.name,
    message: e.message,
    stack: e.stack,
  });
});

process.on("beforeExit", function (code) {
  const d = new Date();
  return console.error(`${d.toUTCString()} onBeforeExit Code:`, code);
});

process.on("exit", function (code) {
  const d = new Date();
  return console.error(`${d.toUTCString()} onExit Code:`, code);
});

```


### Hello World

### Basic Routing

### More Examples

#### Auth

#### Error

#### Route Documentation

## Guide

### Routing

### Auth

### Error Handling

### Logging

### Postgres

### Security Best Practices

## Resources



