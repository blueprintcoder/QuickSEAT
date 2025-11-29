const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/Quickseat");
        console.log("✅ MongoDB Connected Successfully");
    } catch (err) {
        console.error("❌ DB Connection Error:", err);
    }
};

module.exports = connectDB;
