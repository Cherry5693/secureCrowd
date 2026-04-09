const mongoose = require("mongoose")

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured in environment")
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, 
    })

    console.log(` ✅ Database Connected: ${conn.connection.host}`)
    return conn
  } catch (err) {
    console.error("DB Error:", err.message)
    throw err 
  }
}

module.exports = connectDB