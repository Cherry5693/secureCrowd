require("dotenv").config();

const express = require("express")
const http = require("http")
const cors = require("cors")
const { Server } = require("socket.io");
const connectDB = require("./config/db")
const userController = require("./Controllers/UserController")
const Message = require("./models/Message")

const app = express();
app.use(cors())
app.use(express.json())

connectDB()

const server = http.createServer(app)

const io = new Server(server, {
    cors : { origin : "*" }
})

app.use("/api/users", userController)

app.get("/", (req, res) =>{
    res.send("Chat server running");
})

let count = 0
io.on("connection", (socket) =>{
    console.log("User Connected : ", socket.id);
    count++
    console.log("count :", count)
    socket.on("join_group", (groupId)=>{
        socket.join(groupId)
    })

    socket.on("send_message", async (data) =>{
        const messageData = {
            groupId: data.groupId,
            sender: data.sender || "anonymous",
            message: data.message,
            time: new Date()
        }

        try {
            const saved = await Message.create(messageData)
            io.to(data.groupId).emit("receive_message", saved)
        } catch(err) {
            console.error("send_message error:", err)
            socket.emit("error", { message: "Failed to save message" })
        }
    })

    socket.on("disconnect", () =>{
        console.log('User Disconnected:', socket.id);
    })
})



server.listen(5000, () =>{
    console.log("Server running on port 5000")
})