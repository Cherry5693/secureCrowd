const mongoose = require("mongoose")

const connectDB = async () => {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
        console.log("DB Error: MONGODB_URI is not configured in environment")
        process.exit(1)
    }

    try {
        await mongoose.connect(uri);
        console.log("Database Connected")
    } catch(err) {
        console.log("DB Error: ", err)
        process.exit(1)
    }
}

module.exports = connectDB