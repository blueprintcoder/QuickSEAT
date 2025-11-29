// ==================== IMPORTS ====================
const mongoose = require("mongoose");
const connectDB = require("./init/db");
const Restaurant = require("./models/restaurant");
const User = require("./models/user");
const Reservation = require("./models/reservation");
const bcrypt = require("bcryptjs");

// --- Configuration (Must match app.js) ---
const MONGODB_URI = "mongodb://127.0.0.1:27017/Quickseat";

// ==================== DATE HELPERS ====================
const future1Hour = new Date(Date.now() + 1000 * 60 * 60 * 1);
const future3Hours = new Date(Date.now() + 1000 * 60 * 60 * 3);
const past2Days = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2);

// ==================== SEED DATA ====================

// --- USERS ---
const userSeeds = [
  {
    fullName: "Mike Manager",
    phone: "9000000001",
    email: "mike.mgr@quickseat.com",
    role: "manager",
    password: "managerpassword",
  },
  {
    fullName: "Jane Franchise",
    phone: "9911223300",
    email: "jane.ops@quickseat.com",
    role: "manager",
    password: "managerpassword",
  },
  {
    fullName: "Alice Customer",
    phone: "9000000002",
    email: "alice@test.com",
    role: "customer",
    password: "customerpassword",
  },
];

// --- RESTAURANTS ---
// seed/restaurants.js

const restaurant = [
  {
    name: "Spice Hut",
    address: "MG Road, Bhilai",
    cuisine: ["Indian", "Tandoori"],
    totalTables: 15,
    maxPartySize: 8,
    restaurantId: "spicehut001",
    email: "spicehut@demo.com",
    restaurantPassword: "spice123", // Will be hashed before saving
    priceRange: "$$",
    rating: 4.3,
    description: "A vibrant Indian restaurant known for its rich spices and traditional flavors.",
    openingHours: "10:00 AM - 11:00 PM",
    phone: "+91 9876543210",
    website: "https://spicehut.com",
    mainImage: "/images/spicehut-main.jpg",
    galleryImages: [
      "/images/spicehut1.jpg",
      "/images/spicehut2.jpg",
      "/images/spicehut3.jpg",
    ],
  },
  {
    name: "The Green Bistro",
    address: "Sector 6, Durg",
    cuisine: ["Continental", "Vegan"],
    totalTables: 12,
    maxPartySize: 6,
    restaurantId: "greenbistro001",
    email: "greenbistro@demo.com",
    restaurantPassword: "green123",
    priceRange: "$$",
    rating: 4.7,
    description: "Eco-friendly vegan bistro offering healthy and flavorful meals.",
    openingHours: "8:00 AM - 10:00 PM",
    phone: "+91 9898989898",
    website: "https://greenbistro.com",
    mainImage: "/images/greenbistro-main.jpg",
    galleryImages: [
      "/images/greenbistro1.jpg",
      "/images/greenbistro2.jpg",
    ],
  },
  {
    name: "The Noodle Spot",
    address: "G.E. Road, Bhilai",
    cuisine: ["Asian", "Chinese", "Thai"],
    totalTables: 20,
    maxPartySize: 4,
    restaurantId: "noodlespot001",
    email: "noodlespot@demo.com",
    restaurantPassword: "noodle123",
    priceRange: "$",
    rating: 4.1,
    description: "Serving delicious noodles and authentic Asian dishes with a modern twist.",
    openingHours: "11:00 AM - 10:00 PM",
    phone: "+91 9123456789",
    website: "https://thenoodlespot.com",
    mainImage: "/images/noodlespot-main.jpg",
    galleryImages: [
      "/images/noodlespot1.jpg",
      "/images/noodlespot2.jpg",
      "/images/noodlespot3.jpg",
    ],
  },
  {
    name: "Cafe Libro",
    address: "Nehru Nagar, Durg",
    cuisine: ["Coffee", "Italian", "Desserts"],
    totalTables: 8,
    maxPartySize: 3,
    restaurantId: "cafelibro001",
    email: "cafelibro@demo.com",
    restaurantPassword: "libro123",
    priceRange: "$",
    rating: 4.5,
    description: "A cozy cafe where books meet freshly brewed coffee and comfort food.",
    openingHours: "9:00 AM - 9:00 PM",
    phone: "+91 9876501234",
    website: "https://cafelibro.com",
    mainImage: "/images/cafelibro-main.jpg",
    galleryImages: [
      "/images/cafelibro1.jpg",
      "/images/cafelibro2.jpg",
    ],
  },
  {
    name: "Global Grills",
    address: "Housing Board Colony, Bhilai",
    cuisine: ["BBQ", "American", "Steak"],
    totalTables: 18,
    maxPartySize: 12,
    restaurantId: "globalgrills001",
    email: "globalgrills@demo.com",
    restaurantPassword: "grill123",
    priceRange: "$$$",
    rating: 4.8,
    description: "Premium BBQ and steakhouse offering an international grilling experience.",
    openingHours: "12:00 PM - 12:00 AM",
    phone: "+91 9999999999",
    website: "https://GlobalGrills-main.com",
    mainImage: "/images/globalgrills-main.jpg",
    galleryImages: [
      "/images/globalgrills1.jpg",
      "/images/globalgrills2.jpg",
      "/images/globalgrills3.jpg",
    ],
  },
];

module.exports = { data: restaurant };


// --- RESERVATIONS ---
const reservationData = [
  {
    dateTime: future1Hour,
    partySize: 4,
    status: "pending",
    notes: "Need high chair.",
    restaurant: null,
    customer: null,
  },
  {
    dateTime: future3Hours,
    partySize: 2,
    status: "approved",
    notes: "Anniversary celebration.",
    restaurant: null,
    customer: null,
  },
  {
    dateTime: past2Days,
    partySize: 6,
    status: "declined",
    notes: "Over capacity on that day.",
    restaurant: null,
    customer: null,
  },
];

// ==================== SEED FUNCTION ====================
const seedDB = async () => {
  try {
    await connectDB(MONGODB_URI);

    console.log("--- Clearing all collections ---");
    await Restaurant.deleteMany({});
    await User.deleteMany({});
    await Reservation.deleteMany({});

    // --- Seed Users ---
    console.log("--- 1. Seeding Users (Hashing Passwords) ---");
    const hashedUsers = await Promise.all(
      userSeeds.map(async (user) => {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
        return user;
      })
    );
    const insertedUsers = await User.insertMany(hashedUsers);

    const mikeId = insertedUsers.find((u) => u.fullName === "Mike Manager")._id;
    const janeId = insertedUsers.find((u) => u.fullName === "Jane Franchise")._id;
    const customerId = insertedUsers.find((u) => u.role === "customer")._id;

    // --- Seed Restaurants ---
    console.log("--- 2. Seeding Restaurants (Linking Managers & Hashing Dash Passwords) ---");
    const restaurantsToCreate = [];

    for (let i = 0; i < restaurant.length; i++) {
      const r = restaurant[i];
      const managerId = i < 3 ? mikeId : janeId;
      const newRestaurant = new Restaurant({
        ...r,
        manager: managerId,
        galleryImages: [r.mainImage],
        isActive: true,
      });

      await newRestaurant.hashAndSetPassword(r.dummyPassword);
      restaurantsToCreate.push(newRestaurant);
    }

    const insertedRestaurants = await Restaurant.insertMany(restaurantsToCreate);

    const spiceHutId = insertedRestaurants.find((r) => r.name === "Spice Hut")._id;
    const greenBistroId = insertedRestaurants.find((r) => r.name === "The Green Bistro")._id;

    // --- Seed Reservations ---
    console.log("--- 3. Seeding Reservations ---");
    const finalReservations = reservationData.map((r, idx) => ({
      ...r,
      customer: customerId,
      restaurant: idx === 1 ? greenBistroId : spiceHutId,
    }));

    await Reservation.insertMany(finalReservations);

    console.log("✅ Database Seeding Complete! Collections Populated.");
    console.log(`- Manager Login ID: ${restaurant[0].restaurantId} | Pass: dashpassword`);
    console.log(`- Spice Hut ID: ${spiceHutId}`);
    console.log(`- Green Bistro ID: ${greenBistroId}`);
  } catch (err) {
    if (err.errors) {
      console.error("❌ Validation Errors:");
      for (const key in err.errors) {
        console.error(`- ${key}: ${err.errors[key].message}`);
      }
    }
    console.error("❌ Error inserting data:", err.message || err);
  } finally {
    mongoose.connection.close();
  }
};

seedDB();
