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
const sectionMembers = {}

io.on("connection", (socket) =>{
    console.log("User Connected : ", socket.id);
    count++
    console.log("count :", count)

    socket.on("join_section", ({ section, username })=>{
        const roomName = "section_" + section
        socket.join(roomName)

        socket.section = section
        socket.username = username || socket.id

        if (!sectionMembers[section]) {
            sectionMembers[section] = []
        }
        if (!sectionMembers[section].includes(socket.username)) {
            sectionMembers[section].push(socket.username)
        }

        io.to(roomName).emit("members_update", sectionMembers[section])
    })

    socket.on("send_message", async (data) =>{
        const messageData = {
            section: data.section,
            sender: data.sender || "anonymous",
            message: data.message,
            time: new Date()
        }

        try {
            const saved = await Message.create(messageData)
            io.to("section_" + data.section).emit("receive_message", saved)
        } catch(err) {
            console.error("send_message error:", err)
            socket.emit("error", { message: "Failed to save message" })
        }
    })

    socket.on("disconnect", () =>{
        console.log('User Disconnected:', socket.id);

        const section = socket.section
        const username = socket.username
        if (section && sectionMembers[section]) {
            sectionMembers[section] = sectionMembers[section].filter((u) => u !== username)
            io.to("section_" + section).emit("members_update", sectionMembers[section])
        }
    })
})


const port = 3000
server.listen(port, () =>{
    console.log("Server running on port ", port)
})