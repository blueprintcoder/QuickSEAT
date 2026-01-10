const mongoose = require("mongoose");

const connectDB = async () => {
    try {
    const DB_URI = process.env.DB_URL || "mongodb://127.0.0.1:27017/Quickseat";
    await mongoose.connect(DB_URI);
        console.log("✅ MongoDB Connected Successfully");
    } catch (err) {
        console.error("❌ DB Connection Error:", err);
    }
};

module.exports = connectDB;
