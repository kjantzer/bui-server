<p align="center">
    <img width="200" src="./logo.png"/>
</p>

BUI Server
==================

![demo](https://img.shields.io/badge/Status-In_Development-blue)

Classes and tools for the backend of a [BUI application](https://github.com/kjantzer/bui)

# Documentation

## DB
Creates a pooled [MySQL](https://www.npmjs.com/package/mysql) connection with
a promised based query method.

```js
// db.js class
const DB = require('bui-server/db')

const db = new DB({
    connectionLimit : 10,
    host            : 'example.org',
    user            : 'bob',
    password        : 'secret',
    database        : 'my_db'
})

module.exports = db

// in other files
const db = require('./db')

let result = await db.query(`SELECT * FROM table`)
```

## API

```js
const app = require('express')();

new API(app, [
    MyClass,
    AnotherClass
])

class MyClass {

    // required
    static get api(){return {
        root: null // optional root to append to each route path
        routes: [
            ['get', '/url-path', 'methodName']
        ]
    }}

    // optionally prevent model from being accessible via API
    get canAccess(){ 
        // if( this.req.user.id != 1 ) return false
        return true
    }

    methodName(req){
        // do something
        return 'the value'
    }
}
```

## Model

Models are only useful if they can query the database

```js
const Model = require('bui-server/model')

Model.setDB(requre('./my-db-class'))
```

```js
const Model = require('bui-server/model')

module.exports = class MyModel extends Model {

    static get api(){return {
        root: '/my-model',
        routes: [
            ['get', '/:id?', 'find']
        ]
    }}

    get config(){ return {
        table: 'my_table',
        tableAlias: false
    }}

    findWhere(where){
        // add or manipulate the where clause
    }

    findSql(){
        return /*sql*/`SELECT * FROM ${this.config.table}`
    }

    findParseRow(row){
        return row
    }

    validateUpdate(attrs){
        return attrs
    }

    beforeDestroy(){
        // nothing to do
    }

}
```