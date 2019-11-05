module.exports = {
    
    AccessError: class extends Error {
        constructor(msg='forbidden', code=403){
            super(msg)
            this.name = 'AccessError'
            this.code = code
        }
    }

}