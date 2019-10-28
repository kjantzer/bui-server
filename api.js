
const DEFAULT_OPTS = {
    root: ''
}

module.exports = class API {

	constructor(app, classes, opts={}){

        this.opts = Object.assign({}, DEFAULT_OPTS, opts)
		
        this.app = app
		this._classes = new Map()

		classes.forEach(Class=>{
            
            if( !Class.name )
                return console.warn('! API: not a valid class')

			if( !Class.api || !Class.api.routes )
                return console.warn('! API: class must specify `api.routes`')

			Class.api.routes.forEach(this.setupRoute.bind(this, Class))

            if( Class.api.sync )
                this.setupSync(Class)
		})		
	}

    setupSync(Class){
        if( !this.opts.sync ) return console.error('`sync` not given')

        let path = Class.api.root

        if( this.opts.root )
            path = this.opts.root + path

        path += '/:id'

        Class.prototype.sync = this.opts.sync.add(path, Class)
    }

	setupRoute(Class, route){

		let [method, path, ...args] = route

        args = Array.from(args)

        let fnName = args.pop()

        if( !Class.prototype[fnName] ){
            return console.warn(`! API: ${Class.name}.${fnName} does not exist`)
        }

        args.push(async (req, res)=>{

            if( !req.isAuthenticated() )
                return res.status(401).send({error: 'session expired', code: 401})

			// let c = this.init(Class)
            let model = new Class(req.params, req)

            if( 'canAccess' in model && await model.canAccess === false )
                return res.status(401).send({error: 'unauthorized', code: 401})

			try{
                let args = []

                if( ['add', 'update', 'patch'].includes(fnName) )
                    args.push(req.body)

				let resp = await model[fnName].apply(model, args)

                // TODO: let class determine how response is returned?
                this.finishResponse(req, res, resp)                

			}catch(err){
                console.log(err.stack)
                let code = err.name == 'Error' ? 400 : 500
                res.status(code).send({
                    error: err.message,
                    code: code,
                    type: err.name
                })
			}
		})

        if( Class.api.root )
            path = Class.api.root + path

        if( this.opts.root )
            path = this.opts.root + path
        
        args.unshift(path)

		this.app[method](...args)
	}

    finishResponse(req, res, resp){

        if( req.query.display !== undefined && resp && resp.path ){
            let path = (req.query.display === 'preview' && resp.previewPath) || resp.path
            res.sendFile(path)

        }else if( req.query.download !== undefined && resp && resp.path ){
            let path = (req.query.download === 'preview' && resp.previewPath) || resp.path
            res.download(path, req.query.filename)

        }else{
            res.send(resp)
        }
    }

}