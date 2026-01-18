require("dotenv").config();

const express = require("express");
const app = express();
const path = require("path");
const methodOverride = require("method-override");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const flash = require("express-flash");
const cookieParser = require("cookie-parser");
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
const DB_URL = process.env.DB_URL || "mongodb://127.0.0.1:27017/Quickseat";
const PORT = process.env.PORT || 8080;

// CREATE HTTP SERVER
const server = http.createServer(app);

// SOCKET.IO
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins to fix production CORS issues
    methods: ["GET", "POST"],
  },
});

// ==================== MIDDLEWARE (CORRECT ORDER) ====================

// 1. Body Parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 2. Static Files
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static("public/images"));
app.use("/uploads", express.static("uploads"));

// 3. Method Override
app.use(methodOverride("_method"));

// 4. Cookie Parser (MUST come before session)
app.use(cookieParser());

// 5. Session (MUST come before flash)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: DB_URL }),
  })
);

// 6. Flash Messages (MUST come after session)
app.use(flash());

// 7. Passport
require("./config/passport")(passport);
app.use(passport.initialize());
app.use(passport.session());

// ==================== VIEWS ====================

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ==================== MAKE SOCKET.IO AVAILABLE ====================

app.set("io", io);

// ==================== GLOBAL LOCALS ====================

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.session.success;
  res.locals.error = req.session.error;
  res.locals.messages = req.flash(); // Add this for flash messages
  delete req.session.success;
  delete req.session.error;
  next();
});

// ==================== HOME PAGE ROUTE ====================

app.get("/", async (req, res) => {
  try {
    const restaurants = await Restaurant.find({});
    res.render("restaurants/index.ejs", { restaurants });
  } catch (err) {
    console.error("Error loading home page:", err);
    res.render("error.ejs", { message: "Failed to load restaurants." });
  }
});

// ==================== AUTH ROUTES ====================

app.use("/", authRoutes);
app.use("/api/otp", require("./routes/otpRoutes"));

// ==================== GOOGLE OAUTH ====================

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/");
  }
);

// ==================== OTHER ROUTES ====================

app.use("/", reservationRoutes);
app.use("/", calendarRoutes);
app.use("/areas", areaRoutes);
app.use("/restaurants", restaurantRoutes);
app.use("/restaurant-dashboard", require("./routes/dashboardRoutes"));
app.use("/reservations", reservationRoutes);
app.use("/bookings", require("./routes/reservationRoutes"));
app.use("/tables", tableRoutes);

// ==================== SOCKET.IO CONNECTION ====================

io.on("connection", (socket) => {
  console.log("✅ New client connected:", socket.id);

  socket.on("joinRestaurant", (restaurantId) => {
    socket.join(`restaurant_${restaurantId}`);
    console.log(
      `👥 ${socket.id} joined restaurant room: restaurant_${restaurantId}`
    );
  });

  socket.on("joinCustomer", (customerId) => {
    socket.join(`customer_${customerId}`);
    console.log(`✅ Socket ${socket.id} joined room: customer_${customerId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// ==================== START SERVER ====================

connectDB(DB_URL).then(() => {
  server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});
