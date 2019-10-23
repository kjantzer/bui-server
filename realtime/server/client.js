module.exports = class Client {
	
	constructor(io, socket){
		this.io = io
		this.socket = socket

        let user = socket.request.user
        let data = this.socket.handshake.query

        socket.attr = JSON.parse(data.attr||'{}')

        socket.attr = Object.assign(socket.attr, {
            id: user.id,
            name: user.name,
            email: user.email,
            type: user.type
        })
	}
	
}