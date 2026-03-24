import { useEffect, useState } from "react"
import { io } from "socket.io-client"

const socket = io("http://localhost:5000")
function Groups({ user, onLogout }){
    
    const [message, setMessage] = useState("")
    const [messages, setMessages] = useState([]);
    const groupId = "group1"

    useEffect(() =>{
        socket.emit("join_group", groupId)
        
        socket.on("receive_message", (data) =>{
            setMessages((prev) => [...prev, data])
        })

        socket.on("error", (err) => {
            console.error("Socket error", err)
        })

        return () => {
            socket.off("receive_message")
            socket.off("error")
        }
    }, [])

    const sendMessage = () => {
        if(message.trim() === "") return

        const msgBody = {
            groupId, 
            message, 
            sender : user.username
        }
        socket.emit("send_message", msgBody)
        setMessage("")
    }

    return (
        <>
        <div>
            <div>
                <h3>Welcome, {user.username}</h3>
                <button onClick={onLogout}>Logout</button>
            </div>

            <div>
                {messages.map((msg, index) =>(
                    <div key={index}>
                        <b>{msg.sender}:</b> {msg.message}
                    </div>
                ))}
            </div>

            <input 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type Message"
            />

            <button onClick={sendMessage}>Send</button>
        </div>
        </>
    )
}

export default Groups