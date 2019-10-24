let db

const defaultConfig = {
    idAttribute: 'id'
}

module.exports = class Model {

    static setDB(_db){ db = _db }

// methods to override in subclass

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

// =================================================
    
    constructor(attrs, req){

        if( !db )
            console.warn('Model: `db` has not been set yet')
            
        this.db = db
        this.req = req
        this.attrs = attrs || {}

        for(let key in attrs){
            this[key] = attrs[key]
        }
    }

    get config(){ return {} }

    get idAttribute(){ return this.config.idAttribute || defaultConfig.idAttribute }
    get tableAlias(){ return this.config.tableAlias || this.config.table }

    get isInvalid(){
        return this.attrs === undefined
    }

    toJSON(){
        return !this.id ? [] : this.attrs
    }

// =================================================
//  Deafult CRUD method implementations

    async find(where=null){

        if( !this.config.table ) throw Error('missing config.table')

        let id = null;

        // make sure "id" is prefixed with correct table name/alias
        if( where && where[this.idAttribute] ){
            id = where[this.idAttribute]
            delete where[this.idAttribute]
            where[this.tableAlias+'.'+this.idAttribute] = id
        
        }else if( where && where[this.tableAlias+'.'+this.idAttribute] ){
            id = where[this.tableAlias+'.'+this.idAttribute]

        // if no special WHERE given, default to querying for this model
        }else if( !where && this.id ) {
            where = {}
            id = this.id
            where[this.tableAlias+'.'+this.idAttribute] = this.id
        }

        where = where || {}

        // let subclassed model apply more to where clause
        this.findWhere(where)

        let whereFields = []
        let whereVals = []

        for( let key in where ){
            whereFields.push(`${key} = ?`)
            whereVals.push(where[key])
        }

        where = whereFields.length > 0 ? `WHERE ${whereFields.join(' AND ')}` : ''

        let resp = await db.query(`${this.findSql()} ${where}`, whereVals)

        // parse each row (for decoding JSON strings, etc)
        await Promise.all(resp.map(row=>{
            return this.findParseRow(row)
        }))
        
        if( id && id == this.id ){
            this.attrs = resp[0]
            return this
        }else if( id ){
            // FIXME:
            console.log('return as new class?');
            return resp[0]
        }

        return resp;
    }

    async add(attrs={}){

        if( !this.config.table ) throw Error('missing config.table')

        if( !attrs || Object.keys(attrs).length == 0 )
            return false;

        let result = await db.q(/*sql*/`INSERT INTO ${this.config.table} SET ?`, attrs)
        return String(result.affectedRows)
    }

    async update(attrs={}){

        // let subclass remove or modify attributes to be updated
        this.validateUpdate(attrs)

        if( !this.config.table ) throw Error('missing config.table')

        if( !this.id || !attrs || Object.keys(attrs).length == 0 )
            return false;

        let result = await db.q(/*sql*/`UPDATE ${this.config.table} SET ? WHERE ?`, [attrs, {id:this.id}])
        return String(result.affectedRows)
    }

    async destroy(){

        if( !this.config.table ) throw Error('missing config.table')
        if( !this.id ) throw Error('missing id')

        await this.find()
        
        if( this.isInvalid ) throw Error('not found')

        await this.beforeDestroy()

        let result = await db.q(/*sql*/`DELETE FROM ${this.config.table} WHERE id = ?`, this.id)
        return String(result.affectedRows)
    }
}