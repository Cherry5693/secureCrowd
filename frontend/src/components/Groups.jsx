import { useEffect, useState } from "react"
import { io } from "socket.io-client"
import Members from "./Members"

const socket = io(import.meta.env.VITE_API_URL)
function Groups({ user, onLogout }){
    
    const [message, setMessage] = useState("")
    const [messages, setMessages] = useState([])
    const [members, setMembers] = useState([])
    const section = user.section

    useEffect(() =>{
        socket.emit("join_section", { section, username: user.username })
        
        socket.on("receive_message", (data) =>{
            setMessages((prev) => [...prev, data])
        })

        socket.on("members_update", (updatedMembers) => {
            setMembers(updatedMembers)
        })

        socket.on("error", (err) => {
            console.error("Socket error", err)
        })

        return () => {
            socket.off("receive_message")
            socket.off("members_update")
            socket.off("error")
        }
    }, [section, user.username])

    const sendMessage = () => {
        if(message.trim() === "") return

        const msgBody = {
            section, 
            message, 
            sender : user.username
        }
        socket.emit("send_message", msgBody)
        setMessage("")
    }

    return (
        <div style={{ display: "flex", gap: "20px" }}>
            <div style={{ flex: 1 }}>
                <div>Section: {section}</div>
                <div>
                    <h3>Welcome, {user.username}</h3>
                    <button onClick={onLogout}>Logout</button>
                </div>

                <div style={{ minHeight: "300px", border: "1px solid #666", padding: "10px", margin: "10px 0" }}>
                    {messages.map((msg, index) => (
                        <div key={index}>
                            <b>{msg.sender}:</b> {msg.message}
                        </div>
                    ))}
                </div>

                <div>
                    <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type Message"
                        style={{ width: "70%" }}
                    />
                    <button onClick={sendMessage}>Send</button>
                </div>
            </div>

            <Members members={members} />
        </div>
    )
    
}

export default Groups