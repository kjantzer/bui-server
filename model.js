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

    findSql(where){
        return /*sql*/`SELECT * FROM ${this.config.table} ${this.config.tableAlias||''} ${where}`
    }

    get findLimit(){
        if( this.req.query.perPage )
            return `LIMIT ${this.req.query.pageAt},${this.req.query.perPage}`
            
        return ''
    }

    findParseRow(row){
        return row
    }

    validateUpdate(attrs){
        return attrs
    }

    afterAdd(attrs){
        // noop
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

    get filters(){
        try {
            return this.req.query.filters ? JSON.parse(this.req.query.filters) : {}
        }catch(err){
            console.log('Malformed filters:', this.req.query.filters);
            return {}
        }
    }

    get sorts(){    
        try{
            return this.req.query.sorts ? JSON.parse(this.req.query.sorts) : {}
        }catch(err){
            console.log('Malformed filters:', this.req.query.filters);
            return {}
        }
    }

    orderBy(fn){
        let sorts = this.sorts
        let orderBy = []
        for(let key in sorts ){
            
            let sortOpts = sorts[key]
            let desc = sortOpts.desc ? 'DESC' : 'ASC'

            if( !fn || fn(key, sortOpts) === undefined )
                orderBy.push(`${this.db.escape(key)} ${desc}`)
        }

        return orderBy.length > 0 ? 'ORDER BY '+orderBy.join(', ') : ''
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
            let val = where[key]

            if( ['IS NULL', 'IS NOT NULL'].includes(val) ){
                whereFields.push(`${key} ${val}`)
            }else{

                let oper = '='

                if( typeof val == 'string' ){
                    let [str, customOper, _val] = val.match(/((?:(?:!=)|(?:[><]=?)) )?(.+)/)
                    oper = customOper || oper
                    val = _val 
                }
                
                whereFields.push(`${key} ${oper} ?`)
                whereVals.push(val)
            }
        }

        where = whereFields.length > 0 ? `WHERE ${whereFields.join(' AND ')}` : ''

        let resp = await db.query(this.findSql(where), whereVals)

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
        
        if( !result.insertId && !result.affectedRows )
            throw Error('failed to insert')

        this.id = result.insertId || this.id

        this.afterAdd&&this.afterAdd(attrs)

        return await this.find()
    }

    async update(attrs={}){

        // let subclass remove or modify attributes to be updated
        attrs = this.validateUpdate(attrs)

        if( !this.config.table ) throw Error('missing config.table')

        if( !this.id || !attrs || Object.keys(attrs).length == 0 )
            return false;

        let result = await db.q(/*sql*/`UPDATE ${this.config.table} SET ? WHERE ?`, [attrs, {id:this.id}])

        if( result.affectedRows > 0 )
            return attrs
        
        return false
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