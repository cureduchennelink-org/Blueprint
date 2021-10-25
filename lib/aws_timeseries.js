const Promise= require('bluebird');
const AWS= require('aws-sdk');
const _= require('lodash');

var https = require('https');
var agent = new https.Agent({
    maxSockets: 5000
});
writeClient = new AWS.TimestreamWrite({
        maxRetries: 10,
        httpOptions: {
            timeout: 20000,
            agent: agent
        }
    });
queryClient = new AWS.TimestreamQuery();

class AWS_Timeseries {
    static deps() {
		return {services: ['logger','template','config'], config: 'aws_timeseries[accessKeyId,secretAccessKey,region,databaseName,tableName,htTTLHours,ctTTLDays,dimensions]'};
	}

    constructor(kit) {
        this.createDatabase = this._createDatabase.bind(this)
        this.describeDatabase = this._describeDatabase.bind(this)
        this.updateDatabase = this._updateDatabase.bind(this)
        this.listDatabases = this._listDatabases.bind(this)
        this.createTable = this._createTable.bind(this)
        this.updateTable = this._updateTable.bind(this)
        this.describeTable = this._describeTable.bind(this)
        this.listTables = this._listTables.bind(this)
        this.writeRecords = this._writeRecords.bind(this)
        this.deleteDatabase = this._deleteDatabase.bind(this)
        this.deleteTable = this._deleteTable.bind(this)
        this.getRecords = this._getRecords.bind(this)
		this.log= kit.services.logger.log;
		this.config= kit.services.config.aws_timeseries;
        this.credentials = {
            expired: false,
            expireTime: null,
            refreshCallbacks: [],
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: this.config.secretAccessKey,
            sessionToken: undefined,
            filename: undefined,
            disableAssumeRole: false,
            preferStaticCredentials: false,
            tokenCodeFn: null,
            httpOptions: null
          };
        AWS.config.credentials = credentials;
        AWS.config.update({ region: this.config.region });
	}

    async _createDatabase(databaseName) {
        console.log("Creating Database");
    
        const promise = writeClient.createDatabase(databaseName).promise();
    
        await promise.then(
            (data) => {
                console.log(`Database ${data.Database.DatabaseName} created successfully`);
            },
            (err) => {
                if (err.code === 'ConflictException') {
                    console.log(`Database ${databaseName} already exists. Skipping creation.`);
                } else {
                    console.log("Error creating database", err);
                }
            }
        );
    }
    
    async _describeDatabase (databaseName) {
        console.log("Describing Database");
    
        const promise = writeClient.describeDatabase(databaseName).promise();
    
        await promise.then(
            (data) => {
                console.log(`Database ${data.Database.DatabaseName} has id ${data.Database.Arn}`);
            },
            (err) => {
                if (err.code === 'ResourceNotFoundException') {
                    console.log("Database doesn't exists.");
                } else {
                    console.log("Describe database failed.", err);
                    throw err;
                }
            }
        );
    }
    
    async _updateDatabase(updatedKmsKeyId, databaseName) {
    
        if (updatedKmsKeyId === undefined) {
            console.log("Skipping UpdateDatabase; KmsKeyId was not given");
            return;
        }
        console.log("Updating Database");
        const params = {
            DatabaseName: databaseName,
            KmsKeyId: updatedKmsKeyId
        }
    
        const promise = writeClient.updateDatabase(params).promise();
    
        await promise.then(
            (data) => {
                console.log(`Database ${data.Database.DatabaseName} updated kmsKeyId to ${updatedKmsKeyId}`);
            },
            (err) => {
                if (err.code === 'ResourceNotFoundException') {
                    console.log("Database doesn't exist.");
                } else {
                    console.log("Update database failed.", err);
                }
            }
        );
    }
    
    async _listDatabases() {
        console.log("Listing databases:");
        const databases = await getDatabasesList(null);
        databases.forEach(function(database){
            console.log(database.DatabaseName);
        });
    }
    
    getDatabasesList(nextToken, databases = []) {
        var params = {
            MaxResults: 15
        };
    
        if(nextToken) {
            params.NextToken = nextToken;
        }
    
        return writeClient.listDatabases(params).promise()
            .then(
                (data) => {
                    databases.push.apply(databases, data.Databases);
                    if (data.NextToken) {
                        return getDatabasesList(data.NextToken, databases);
                    } else {
                        return databases;
                    }
                },
                (err) => {
                    console.log("Error while listing databases", err);
                });
    }
    
    async _createTable(databaseName, tableName, htTTLHours, ctTTLDays) {
        console.log("Creating Table");
        const params = {
            DatabaseName: databaseName,
            TableName: tableName,
            RetentionProperties: {
                MemoryStoreRetentionPeriodInHours: htTTLHours,
                MagneticStoreRetentionPeriodInDays: ctTTLDays
            }
        };
    
        const promise = writeClient.createTable(params).promise();
    
        await promise.then(
            (data) => {
                console.log(`Table ${data.Table.TableName} created successfully`);
            },
            (err) => {
                if (err.code === 'ConflictException') {
                    console.log(`Table ${params.TableName} already exists on db ${params.DatabaseName}. Skipping creation.`);
                } else {
                    console.log("Error creating table. ", err);
                    throw err;
                }
            }
        );
    }
    
    async _updateTable(databaseName, tableName, htTTLHours, ctTTLDays) {
        console.log("Updating Table");
        const params = {
            DatabaseName: databaseName,
            TableName: tableName,
            RetentionProperties: {
                MemoryStoreRetentionPeriodInHours: htTTLHours,
                MagneticStoreRetentionPeriodInDays: ctTTLDays
            }
        };
    
        const promise = writeClient.updateTable(params).promise();
    
        await promise.then(
            (data) => {
                console.log("Table updated")
            },
            (err) => {
                console.log("Error updating table. ", err);
                throw err;
            }
        );
    }
    
    async _describeTable(databaseName, tableName) {
        console.log("Describing Table");
        const params = {
            DatabaseName: databaseName,
            TableName: tableName
        };
    
        const promise = writeClient.describeTable(params).promise();
    
        await promise.then(
            (data) => {
                console.log(`Table ${data.Table.TableName} has id ${data.Table.Arn}`);
            },
            (err) => {
                if (err.code === 'ResourceNotFoundException') {
                    console.log("Table or Database doesn't exists.");
                } else {
                    console.log("Describe table failed.", err);
                    throw err;
                }
            }
        );
    }
    
    async _listTables() {
        console.log("Listing tables:");
        const tables = await getTablesList(null);
        tables.forEach(function(table){
            console.log(table.TableName);
        });
    }
    
    getTablesList(nextToken, tables = [], databaseName) {
        var params = {
            DatabaseName: databaseName,
            MaxResults: 15
        };
    
        if(nextToken) {
            params.NextToken = nextToken;
        }
    
        return writeClient.listTables(params).promise()
            .then(
                (data) => {
                    tables.push.apply(tables, data.Tables);
                    if (data.NextToken) {
                        return getTablesList(data.NextToken, tables);
                    } else {
                        return tables;
                    }
                },
                (err) => {
                    console.log("Error while listing databases", err);
                });
    }
    
    async  _writeRecords(databaseName, tableName, data, dimensions ) {
        console.log("Writing records");
        const currentTime = Date.now().toString(); // Unix time in milliseconds
    
        // const dimensions = [
        //     {'Name': 'region', 'Value': this.config.region}
        // ];
    
        // const cpuUtilization = {
        //     'Dimensions': dimensions,
        //     'MeasureName': 'cpu_utilization',
        //     'MeasureValue': '13.5',
        //     'MeasureValueType': 'DOUBLE',
        //     'Time': currentTime.toString()
        // };
    
        // const memoryUtilization = {
        //     'Dimensions': dimensions,
        //     'MeasureName': 'memory_utilization',
        //     'MeasureValue': '40',
        //     'MeasureValueType': 'DOUBLE',
        //     'Time': currentTime.toString()
        // };
        // const data = {
        //     "Version": "v1",
        //     "payload": [
        //       {
        //         "hubID": "H2",
        //         "value": 87.993,
        //         "sensorID": "S4",
        //         "gatewayID": "a960a72c-87bf-4006-8824-cdb41180b1f5",
        //         "timestamp": "2021/09/19 T13:14:15"
        //       },
        //       {
        //         "hubID": "H2",
        //         "value": 89.343,
        //         "sensorID": "S4",
        //         "gatewayID": "a960a72c-87bf-4006-8824-cdb41180b1f5",
        //         "timestamp": "2021/09/19 T13:24:15"
        //       },
        //       {
        //         "hubID": "H2",
        //         "value": 90.312,
        //         "sensorID": "S4",
        //         "gatewayID": "a960a72c-87bf-4006-8824-cdb41180b1f5",
        //         "timestamp": "2021/09/19 T13:34:15"
        //       },
        //       {
        //         "hubID": "H2",
        //         "value": 91.432,
        //         "sensorID": "S4",
        //         "gatewayID": "a960a72c-87bf-4006-8824-cdb41180b1f5",
        //         "timestamp": "2021/09/19 T13:44:15"
        //       },
        //       {
        //         "hubID": "H2",
        //         "value": 88.794,
        //         "sensorID": "S4",
        //         "gatewayID": "a960a72c-87bf-4006-8824-cdb41180b1f5",
        //         "timestamp": "2021/09/19 T13:54:15"
        //       }
        //     ],
        //     "gatewayId": "a960a72c-87bf-4006-8824-cdb41180b1f5"
        // }
        const time = Date.now()
    
        // const records = [{
    
        //     'Dimensions': dimensions,
        //     'MeasureName': 'sensor_data',
        //     'MeasureValueType': 'DOUBLE',
        //     'Time': time.toString()
        //   }];
        const validData = data.every((obj) => obj.MeasureName && obj.MeasureValueType && obj.Time)
        if(validData) {
            const addDimensions = data.map((d) => ({
                ...d,
                Dimensions: dimensions,
            }))
            const records = addDimensions
        
            const params = {
                DatabaseName: databaseName,
                TableName: tableName,
                Records: records
            };
            const request = writeClient.writeRecords(params);
        
            await request.promise().then(
                (data) => {
                    console.log("Write records successful", data);
                },
                (err) => {
                    console.log("Error writing records:", err);
                    if (err.code === 'RejectedRecordsException') {
                        printRejectedRecordsException(request);
                    }
                }
            );
        }
    
    }
    
    async _deleteDatabase(databaseName) {
        console.log("Deleting Database");
        const params = {
            DatabaseName: databaseName
        };
    
        const promise = writeClient.deleteDatabase(params).promise();
    
        await promise.then(
            function (data) {
                console.log("Deleted database");
             },
            function(err) {
                if (err.code === 'ResourceNotFoundException') {
                    console.log(`Database ${params.DatabaseName} doesn't exists.`);
                } else {
                    console.log("Delete database failed.", err);
                    throw err;
                }
            }
        );
    }
    
    async _deleteTable(databaseName, tableName) {
        console.log("Deleting Table");
        const params = {
            DatabaseName: databaseName,
            TableName: tableName
        };
    
        const promise = writeClient.deleteTable(params).promise();
    
        await promise.then(
            function (data) {
                console.log("Deleted table");
            },
            function(err) {
                if (err.code === 'ResourceNotFoundException') {
                    console.log(`Table ${params.TableName} or Database ${params.DatabaseName} doesn't exists.`);
                } else {
                    console.log("Delete table failed.", err);
                    throw err;
                }
            }
        );
    }

    async _getRecords(databaseName, tableName) {
        const query = `SELECT * from "${databaseName}"."${tableName}" ORDER BY time DESC LIMIT 10`;
         const selectAll = async (query, nextToken) => {
            const params = {
                QueryString: query
            }
            console.log(params)
            if(nextToken) {
                params.nextToken
            }
            console.log(`Running query for timeseries: ${query}`);
            await queryClient.query(params).promise().then((response) => {
                console.log(response)
                parseQueryResult(response);
                if (response.NextToken) {
                    selectAll(query, response.NextToken);
                }
            },
            (err) => {
                console.error("Error while querying:", err);
            });
        }
    }
    
    printRejectedRecordsException(request) {
        const responsePayload = JSON.parse(request.response.httpResponse.body.toString());
                    console.log("RejectedRecords: ", responsePayload.RejectedRecords);
    }
    parseQueryResult(response) {
        const queryStatus = response.QueryStatus;
        console.log("Current query status: " + JSON.stringify(queryStatus));
    
        const columnInfo = response.ColumnInfo;
        const rows = response.Rows;
    
        console.log("Metadata: " + JSON.stringify(columnInfo));
        console.log("Data: ");
    
        rows.forEach(function (row) {
            console.log(parseRow(columnInfo, row));
        });
    }

    parseRow(columnInfo, row) {
        const data = row.Data;
        const rowOutput = [];
    
        var i;
        for ( i = 0; i < data.length; i++ ) {
            info = columnInfo[i];
            datum = data[i];
            rowOutput.push(parseDatum(info, datum));
        }
    
        return `{${rowOutput.join(", ")}}`
    }
    
    parseDatum(info, datum) {
        if (datum.NullValue != null && datum.NullValue === true) {
            return `${info.Name}=NULL`;
        }
    
        const columnType = info.Type;
    
        // If the column is of TimeSeries Type
        if (columnType.TimeSeriesMeasureValueColumnInfo != null) {
            return parseTimeSeries(info, datum);
        }
        // If the column is of Array Type
        else if (columnType.ArrayColumnInfo != null) {
            const arrayValues = datum.ArrayValue;
            return `${info.Name}=${parseArray(info.Type.ArrayColumnInfo, arrayValues)}`;
        }
        // If the column is of Row Type
        else if (columnType.RowColumnInfo != null) {
            const rowColumnInfo = info.Type.RowColumnInfo;
            const rowValues = datum.RowValue;
            return parseRow(rowColumnInfo, rowValues);
        }
        // If the column is of Scalar Type
        else {
            return parseScalarType(info, datum);
        }
    }

    parseTimeSeries(info, datum) {
        const timeSeriesOutput = [];
        datum.TimeSeriesValue.forEach(function (dataPoint) {
            timeSeriesOutput.push(`{time=${dataPoint.Time}, value=${parseDatum(info.Type.TimeSeriesMeasureValueColumnInfo, dataPoint.Value)}}`)
        });
    
        return `[${timeSeriesOutput.join(", ")}]`
    }
    
    parseScalarType(info, datum) {
        return parseColumnName(info) + datum.ScalarValue;
    }
    
    parseColumnName(info) {
        return info.Name == null ? "" : `${info.Name}=`;
    }
    
    parseArray(arrayColumnInfo, arrayValues) {
        const arrayOutput = [];
        arrayValues.forEach(function (datum) {
            arrayOutput.push(parseDatum(arrayColumnInfo, datum));
        });
        return `[${arrayOutput.join(", ")}]`
    }
};

exports.AWS_Timeseries = AWS_Timeseries