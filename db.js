const mysql = require('mysql');

module.exports = class DB {

    constructor(config){
        this.pool = mysql.createPool(config);
    }
    
    getConnection(){
        return new Promise((resolve, reject)=>{
            this.pool.getConnection(function(err, connection) {
                if( err ) reject(err)
                else resolve(connection)
            });
        })
    }

    query(sql, data){
		return new Promise((resolve, reject)=>{

			sql = mysql.format(sql, data)

            // gets connection, queries, then releases connection
			this.pool.query(sql, (err, results, fields)=>{
				if( err ){
					console.info(sql);
                    err.lastQuery = sql
					reject(err)
				}else
                    results = new DBResults(...results)
                    results.fromQuery = sql
					resolve(results)
			})
		})
	}

    // alias
    q(){
        return this.query(...arguments)
    }

    format(...args){
		return mysql.format.apply(mysql, args)
	}

}

class DBResults extends Array {
    
    groupBy(key){
        let group = {}
        this.forEach(row=>{
            if( row[key] )
                group[row[key]] =  row
        })
        return group
	}

    get first(){ return this[0] }
    get last(){ return this[this.length-1] }
	
	get values(){
		return this.map(d=>d[Object.keys(d)[0]])
	}
	
	get value(){
		let values = this.map(d=>d[Object.keys(d)[0]])
		return values[0]
	}
    
}