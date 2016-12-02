
MongoClient= require('mongodb').MongoClient
# TODO: Add blueprint logger

class MongoLoggerFactory
  constructor: (kit)->
    config= kit.services.config
    @config= config
    @mongoLogger = MongoLogger;
    return

  make: ()->
    console.log(@config);
    return new @mongoLogger(@config);


class MongoLogger
  constructor: (config)->
    self= this
    self.config = config

    logLevels= {
      'trace': 10,
      'debug': 20,
      'info': 30,
      'warn': 40,
      'error': 50,
      'fatal': 60
    };

    MongoClient.connect self.config.db.mongo.options, (err, connection)->
      self.connection = connection
      if (err)
        console.error(err)
        throw new Error(err)
        return
      if (!self.connection)
        console.error('Connection not established')
        throw new Error('Connection not established')
        return

      self.collection = self.connection.collection(self.config.mongoLog.name)
      self.batch = self.collection.initializeOrderedBulkOp()
      self.log 'Logger Initialized...'
      console.log('Mongo logging')
      return

  log: (data)->
    self= this
    row= {data: data}
    self.batch.insert row
    console.log 'logging', row
    return


  close: ()->
    self= this
    if (self.batch)
      self.batch.execute (err, result)->
        if (err)
          console.error err
          throw new Error(err)

        console.log 'closing', result
        self.connection.close()
        return

exports.MongoLoggerFactory = MongoLoggerFactory;
