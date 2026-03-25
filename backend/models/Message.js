
const mongoose = require("mongoose")

const messageSchema = mongoose.Schema({
    section: String, 
    sender : String, 
    message : String,
    time : { type: Date, default: Date.now }
})

module.exports = mongoose.model("Message", messageSchema)