require("dotenv").config();

const express = require("express");
const app = express();
const path = require("path");
const methodOverride = require("method-override");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const connectDB = require("./init/db");
const Restaurant = require("./models/restaurant");
const restaurantRoutes = require("./routes/restaurantRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const authRoutes = require("./routes/authRoutes");
const calendarRoutes = require("./routes/calendar");
const areaRoutes = require("./routes/areas");
const tableRoutes = require("./routes/tables");
const http = require("http");
const { Server } = require("socket.io");

// CONFIG
const MONGO_URI = "mongodb://127.0.0.1:27017/Quickseat";
const PORT = 8080;

// CREATE HTTP SERVER
const server = http.createServer(app);

// TO THIS:
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// MIDDLEWARE
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));

// STATIC FOLDERS
app.use("/images", express.static("public/images"));
app.use("/uploads", express.static("uploads"));

// SESSION
app.use(
  session({
    secret: "supersecret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO_URI }),
  })
);

// PASSPORT
require("./config/passport")(passport);
app.use(passport.initialize());
app.use(passport.session());

// GLOBAL LOCALS
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.session.success;
  res.locals.error = req.session.error;
  delete req.session.success;
  delete req.session.error;
  next();
});

// MAKE SOCKET.IO AVAILABLE TO ROUTES
app.set("io", io);

// VIEWS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ✅ HOME PAGE ROUTE (fix for "Cannot GET /")
app.get("/", async (req, res) => {
  try {
    const restaurants = await Restaurant.find({});
    res.render("restaurants/index.ejs", { restaurants });
  } catch (err) {
    console.error("Error loading home page:", err);
    res.render("error.ejs", { message: "Failed to load restaurants." });
  }
});

// ROUTES
app.use("/", authRoutes);
app.use("/api/otp", require("./routes/otpRoutes"));
app.use("/", reservationRoutes);
app.use("/", calendarRoutes);
app.use("/areas", areaRoutes);
app.use("/restaurants", require("./routes/restaurantRoutes"));
app.use("/restaurant-dashboard", require("./routes/dashboardRoutes"));
app.use("/reservations", require("./routes/reservationRoutes"));
app.use('/bookings', require("./routes/reservationRoutes")); 

// ✅ GOOGLE OAUTH ROUTES - ADD HERE
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication
    res.redirect('/');
  }
);

// CORRECT VERSION - Only ONE connection handler
io.on("connection", (socket) => {
  console.log("✅ New client connected:", socket.id);

  // In your socket connection handler
  socket.on("joinRestaurant", (restaurantId) => {
    socket.join(`restaurant_${restaurantId}`);
    console.log(
      `👥 ${socket.id} joined restaurant room: restaurant_${restaurantId}`
    );
  });

  // ✅ NEW: Join customer-specific room
  socket.on("joinCustomer", (customerId) => {
    socket.join(`customer_${customerId}`);
    console.log(`✅ Socket ${socket.id} joined room: customer_${customerId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// app.js or server.js

// Add this line BEFORE other routes
app.use("/tables", tableRoutes);

// Example: If your other routes are like:
app.use("/reservations", reservationRoutes);
app.use("/restaurants", restaurantRoutes);

// Add above them or below, doesn't matter as long as it's before app.listen()

// DB + SERVER
connectDB(MONGO_URI).then(() => {
  server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});
