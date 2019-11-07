const UrlPattern = require('url-pattern')

module.exports = class Sync extends Map {
    
    constructor(io){
        super()

        this.io = io.of('/sync');

        this.io.on('connection', this.onConnection.bind(this));
    }

    add(path, Class){

        let pathPattern = new UrlPattern(path)
        
        this.set(pathPattern, Class)

        let io = this.io

        // store reference to sync path pattern
        Class.prototype.syncPathPattern = pathPattern

        // create a syncPath getter that will use the sync path pattern
        // and create a string using the class attributres
        // path: `/book/:id` will become `/book/1` (if `class.id == 1`)
        if( Class.prototype.syncPath === undefined )
        Object.defineProperty(Class.prototype, 'syncPath', {
            get: function syncPath() {
                return this.syncPathPattern.stringify(this)
            }
        });

        Class.prototype.syncData = function(data, toClients){

            if( !this.syncPath ) return console.error('Class does have `syncPath` set')

            if( toClients ){
                let room = io.adapter.rooms[this.syncPath]
                if( !room ) return

                for( let socketID in io.sockets ){
                    let socket = io.sockets[socketID]
                    if( socket.rooms[this.syncPath] && toClients(socket)){
                        socket.emit('sync', {
                            path: this.syncPath,
                            socketIDs: this.req.socketIDs || [],
                            data: data
                        })
                    }   
                }
            }else{
                io.to(this.syncPath).emit('sync', {
                    path: this.syncPath,
                    socketIDs: this.req.socketIDs || [],
                    data: data
                })
            }
        }
    }

    getClassFor(path, socket){
        
        let matchedClass

        // get the class for the given path, will use url-pattern to match the string
        this.forEach((Class, classPath)=>{
            
            // example: `/book/:id`.match(`/book/1`) == {id:1}
            let matched = classPath.match(path)

            // if matched, create a class instance with the matched params
            if( !matchedClass && matched ){
                matchedClass = new Class(matched, socket.request)
            }
        })
        
        return matchedClass
    }

    onConnection(socket){

        socket.on('disconnecting', ()=>{
            for( let path in socket.rooms ){

                let classInstance = this.getClassFor(path, socket)

                if( classInstance && classInstance.syncClientDidLeave)
                    classInstance.syncClientDidLeave(socket)
            }
            
        })

        // when a new socket joins, listen for requests to "join" a particular path
        socket.on('join', async (path)=>{
            
            // see if we have a class registered for this path
            let classInstance = this.getClassFor(path, socket)

            if( !classInstance ) return console.warn('no sync class for:', path)

            // make sure this socket user has access to this class/model
            if( 'canAccess' in classInstance && await classInstance.canAccess === false )
                return console.warn('unauthorized access')

            // syncPath should have been set by the `.add` method above
            if( !classInstance.syncPath ) return console.error('Class does have `syncPath` set')

            socket.join(classInstance.syncPath)

            if( classInstance.syncClientDidJoin )
                classInstance.syncClientDidJoin(socket)
        });

        // listen for the socket to request leaving 
        socket.on('leave', (path)=>{
            let classInstance = this.getClassFor(path, socket)

            if( !classInstance ) return console.warn('cannot leave:', path, '; does not exist')

            socket.leave(classInstance.syncPath)

            if( classInstance.syncClientDidLeave )
                classInstance.syncClientDidLeave(socket)
        });
    }
    
}
