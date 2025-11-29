// models/restaurant.js - Updated for Dual Auth

const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const bcrypt = require("bcryptjs"); // REQUIRED: npm install bcryptjs

const restaurantSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Restaurant name is required"],
      unique: true,
      trim: true,
    },
    address: {
      type: String,
      required: [true, "Restaurant address is required"],
      trim: true,
    },
    googleMapsUrl: {
  type: String,
  required: [true, "Google Maps URL is required for location sharing"],
  trim: true,
  match: [
    /^https?:\/\/(www\.)?(google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)\/.+$/, 
    "Please provide a valid Google Maps URL (e.g., https://goo.gl/maps/..., https://maps.app.goo.gl/..., or https://google.com/maps/...)"
  ], // Updated regex and error message
},
    latitude: Number,
    longitude: Number,
    // New: Unique ID for Restaurant Login (Manager Dashboard Access)
    restaurantId: {
      type: String,
      required: [true, "Restaurant ID is required for login"],
      unique: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    // New: Hashed Password for Dashboard Access
    restaurantPassword: {
      type: String,
      required: [true, "Restaurant password is required"],
    },
    totalTables: {
      type: Number,
      default: 10,
      min: [1, "Restaurant must have at least 1 table"],
      max: [100, "Cannot exceed 100 tables"],
    },
    maxPartySize: {
      type: Number,
      default: 8,
      min: [1, "Party size must be at least 1"],
      max: [50, "Maximum party size cannot exceed 50"],
    },
    // IMPORTANT: Manager must be a User ObjectId
    manager: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Manager is required"],
    },
    // ... other fields remain ...
    cuisine: { type: [String], default: [] },
    priceRange: {
      type: String,
      enum: ["$", "$$", "$$$", "$$$$"],
      default: "$$",
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    description: { type: String, trim: true },
    openingHours: { type: String, default: "9:00 AM - 11:00 PM" },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    floorLayout: [
      {
        tableNumber: Number,
        x: Number,
        y: Number,
        width: Number,
        height: Number,
        shape: String, // 'square', 'round', 'rectangle'
        rotation: Number, // Angle in degrees (for transform)
      },
    ],

    mainImage: {
      type: String,
      default: "/images/default-restaurant.jpg", // Fallback if no image uploaded
      trim: true,
    },
    galleryImages: [
      {
        type: String,
        trim: true,
      },
    ],
    floorLayout: [
      {
        tableNumber: Number,
        x: Number,
        y: Number,
        width: Number,
        height: Number,
        shape: String,
        rotation: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Custom method to hash the password before saving a new restaurant
restaurantSchema.methods.hashAndSetPassword = async function (password) {
  if (password) {
    const salt = await bcrypt.genSalt(10);
    this.restaurantPassword = await bcrypt.hash(password, salt);
  }
};

// Custom method to compare the entered password with the hashed password
restaurantSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.restaurantPassword);
};

module.exports = mongoose.model("Restaurant", restaurantSchema);
