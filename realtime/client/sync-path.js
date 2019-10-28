export default class SyncPath extends Map {

    constructor(socket, path){
        
        super()

        this.path = path
        this.socket = socket

        this.onSync = this.onSync.bind(this)
    }

    add(object){
        this.set(object, object)
    }
    
    connect(){
        this.isConnected = true
        this.socket.emit('join', this.path)
    }

    close(){
        this.isConnected = false
        this.socket.emit('leave', this.path)
    }

    onSync(data){
        // this.emit('change', data)
        this.forEach(object=>{
            
            if( object.onSync )
                object.onSync(data)
        })
    }

}