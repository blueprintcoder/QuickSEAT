const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: false,
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
      sparse: true,  // Optional - not all users have it initially
    },
    passwordSetAt: Date,
    
    authMethod: {
      type: String,
      enum: ['google', 'email-password', 'both'],
      default: 'email-password'
    },
    
    // ✅ KEY FIELD: Tracks if user is NEW or EXISTING
    isNewUser: {
      type: Boolean,
      default: true,
    },
    
    phone: { 
      type: String,
      sparse: true,
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
    
    googleId: { 
      type: String, 
      unique: true, 
      sparse: true 
    },
    resetToken: {
      type: String,
      sparse: true
    },
    resetTokenExpiry: Date,
    
    // Security Questions (for backup/fallback)
    securityQuestions: [{
      question: String,
      answer: String  // Hashed answer
    }],
    
    // Failed password reset attempts tracking
    passwordResetAttempts: {
      type: Number,
      default: 0
    },
    passwordResetBlockedUntil: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);