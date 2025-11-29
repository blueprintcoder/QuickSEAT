// models/User.js - UPDATED WITH AUTHENTICATION SUPPORT

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// models/User.js
const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: [false], // ← Change to false or remove required
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    password: {
    type: String,
    sparse: true  // Optional - only required for password login
},
passwordSetAt: Date,
authMethod: {
    type: String,
    enum: ['google', 'email-password', 'both'],
    default: 'email-password'
},
isNewUser: {
    type: Boolean,
    default: true  // Mark as new on creation
},


    phone: { 
    type: String, 
    required: function() { return !this.googleId; }  // Only required if NOT Google user
    },
    role: {
      type: String,
      enum: ["customer", "manager"],
      default: "customer",
    },
    isGuest: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: { type: String },
    otpExpires: { type: Date },
    googleId: { type: String, unique: true, sparse: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
