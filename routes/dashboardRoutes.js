const express = require("express");
const router = express.Router();
const { isRestaurantLoggedIn } = require("../middleware/auth");
const Restaurant = require("../models/restaurant");
const Reservation = require("../models/reservation");
const MenuItem = require("../models/menuItem");
const upload = require("../middleware/multer");

// DASHBOARD
router.get("/", isRestaurantLoggedIn, async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ 
      restaurantId: req.session.restaurantId 
    });
    
    if (!restaurant) {
      req.session.error = "Restaurant not found.";
      return res.redirect("/restaurant-login");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch ALL reservations
    const allReservations = await Reservation.find({
      restaurant: restaurant._id,
      dateTime: { $gte: today, $lt: tomorrow }
    })
    .populate("customer")
    .populate("menuItems")
    .sort({ dateTime: 1 });

    console.log('📊 Fetched reservations:', allReservations.map(r => ({ 
      id: r._id.toString().slice(-4), 
      status: r.status 
    })));

    // ⭐ Separate by DB status, normalize for frontend
    const pendingRequests = allReservations.filter(r => r.status === 'pending');

    const confirmedRequests = allReservations
  .filter(r => r.status === 'approved')
  .map(r => ({ ...r.toObject(), status: 'confirmed' }));

    const rejectedRequests = allReservations
  .filter(r => r.status === 'declined')
  .map(r => ({ ...r.toObject(), status: 'rejected' }));

    console.log('✅ Separated:', {
      pending: pendingRequests.length,
      confirmed: confirmedRequests.length,
      rejected: rejectedRequests.length
    });

    res.render("restaurant-dashboard/dashboard", {
      pageTitle: "Restaurant Dashboard",
      restaurant,
      pendingRequests,
      confirmedRequests,
      rejectedRequests,
    });
  } catch (err) {
    console.error("❌ Dashboard error:", err);
    req.session.error = "Failed to load dashboard.";
    res.redirect("/restaurant-login");
  }
});

// ✅ RESERVATIONS PAGE (for the navbar "Reservations" link)
router.get("/reservations", isRestaurantLoggedIn, async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      restaurantId: req.session.restaurantId,
    });

    if (!restaurant) {
      req.session.error = "Restaurant not found.";
      return res.redirect("/restaurants");
    }

    // Fetch all reservations for this restaurant
    const reservations = await Reservation.find({ restaurant: restaurant._id })
      .populate("customer")
      .sort({ dateTime: -1 });

    res.render("restaurant-dashboard/reservations.ejs", {
      pageTitle: "All Reservations",
      restaurant,
      reservations,
      errorMessage: null, // ✅ added default error message
      successMessage: null, // ✅ added default success message
    });
  } catch (err) {
    console.error("Error loading reservations page:", err);
    req.session.error = "Failed to load reservations.";
    res.redirect("/restaurant-dashboard");
  }
});

// In your routes file
// ✅ CALENDAR PAGE
router.get("/calendar", isRestaurantLoggedIn, async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      restaurantId: req.session.restaurantId,
    });

    if (!restaurant) {
      req.session.error = "Restaurant not found.";
      return res.redirect("/restaurants");
    }

    res.render("restaurant-dashboard/calendar-page", {
      pageTitle: "Calendar",
      restaurant: restaurant,
    });
  } catch (err) {
    console.error("Error loading calendar page:", err);
    req.session.error = "Failed to load calendar.";
    res.redirect("/restaurant-dashboard");
  }
});

// ✅ Add this API endpoint
router.get(
  "/by-restaurant/:restaurantId",
  isRestaurantLoggedIn,
  async (req, res) => {
    try {
      const reservations = await Reservation.find({
        restaurant: req.params.restaurantId,
      })
        .populate("customer")
        .sort({ dateTime: -1 });

      res.json(reservations);
    } catch (err) {
      console.error("Error fetching reservations:", err);
      res.status(500).json({ error: "Failed to fetch reservations" });
    }
  }
);

router.get("/floorplan", (req, res) => {
  try {
    const restaurant = { _id: req.session.restaurantId };
    res.render("floorPlan", {
      restaurant: restaurant,
      pageTitle: "Floor Plan - QuickSEAT",
    });
  } catch (error) {
    res.status(500).send("Error loading floor plan");
  }
});

// Menu Management Page
router.get("/menu", isRestaurantLoggedIn, async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      restaurantId: req.session.restaurantId,
    });

    if (!restaurant) {
      req.session.error = "Restaurant not found.";
      return res.redirect("/restaurant-login");
    }

    const menus = await MenuItem.find({ restaurant: restaurant._id }).sort({
      cuisine: 1,
      dishName: 1,
    });

    res.render("restaurant-dashboard/menu.ejs", {
      restaurant,
      menus,
      success: req.session.success,
      error: req.session.error,
    });

    delete req.session.success;
    delete req.session.error;
  } catch (err) {
    console.error("Menu page error:", err);
    req.session.error = "Failed to load menu page.";
    res.redirect("/restaurant-dashboard");
  }
});

// Add New Dish
router.post(
  "/menu/add",
  isRestaurantLoggedIn,
  upload.single("image"),
  async (req, res) => {
    try {
      const { cuisine, type, dishName, price } = req.body;

      console.log(cuisine);
      console.log(type);
      console.log(dishName);
      console.log(price);

      const restaurant = await Restaurant.findOne({
        restaurantId: req.session.restaurantId,
      });

      console.log(restaurant);

      if (!restaurant) {
        req.session.error = "Restaurant not found.";
        return res.redirect("/restaurant-login");
      }

      if (!cuisine || !type || !dishName || !price) {
        req.session.error = "All fields except image are required.";
        return res.redirect("/restaurant-dashboard/menu");
      }

      const menuItem = new MenuItem({
        restaurant: restaurant._id,
        cuisine: cuisine.trim(),
        type: type.toLowerCase(),
        dishName: dishName.trim(),
        price: parseFloat(price),
        image: req.file ? `/uploads/${req.file.filename}` : null,
      });

      console.log(menuItem);
      await menuItem.save();

      req.session.success = `🥳 Your dish "${dishName}" has been listed successfully!`;
      res.redirect("/restaurant-dashboard/menu");
    } catch (err) {
      console.error("Add dish error:", err);
      req.session.error = err.message || "Failed to add dish.";

      res.redirect("/restaurant-dashboard/menu");
    }
  }
);

// ========================================
// MENU MANAGEMENT - TOGGLE AVAILABILITY
// ========================================
router.put("/menu/:id/toggle", isRestaurantLoggedIn, async (req, res) => {
  try {
    const dish = await MenuItem.findById(req.params.id);

    if (!dish) {
      return res.status(404).json({ error: "Dish not found" });
    }

    dish.isAvailable = !dish.isAvailable;
    await dish.save();

    res.json({ success: true, isAvailable: dish.isAvailable });
  } catch (err) {
    console.error("Toggle availability error:", err);
    res.status(500).json({ error: "Failed to update availability" });
  }
});

// ========================================
// MENU MANAGEMENT - DELETE DISH
// ========================================
router.delete("/menu/:id", isRestaurantLoggedIn, async (req, res) => {
  try {
    const dish = await MenuItem.findById(req.params.id);

    if (!dish) {
      return res.status(404).json({ error: "Dish not found" });
    }

    await MenuItem.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete dish error:", err);
    res.status(500).json({ error: "Failed to delete dish" });
  }
});

router.get("/edit", isRestaurantLoggedIn, async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      restaurantId: req.session.restaurantId,
    });

    if (!restaurant) {
      req.session.error = "Restaurant not found.";
      return res.redirect("/restaurant-login");
    }

    res.render("restaurants/edit", {  // Assuming the path as per your earlier mention
      pageTitle: `Edit ${restaurant.name}`,
      restaurant,
      success: req.session.success,
      error: req.session.error,
    });

    delete req.session.success;
    delete req.session.error;
  } catch (err) {
    console.error("Edit restaurant GET error:", err);
    req.session.error = "Failed to load edit form.";
    res.redirect("/restaurant-dashboard");
  }
});

// ========================================
// RESTAURANT EDIT PAGE (POST)
// ========================================
router.post("/edit", isRestaurantLoggedIn, async (req, res) => {
  try {
    const { name, description, address, phone, email } = req.body;  // Assuming common fields; adjust as needed
    const restaurant = await Restaurant.findOne({
      restaurantId: req.session.restaurantId,
    });

    if (!restaurant) {
      req.session.error = "Restaurant not found.";
      return res.redirect("/restaurant-login");
    }

    if (!name || !address || !phone) {  // Required fields; adjust as needed
      req.session.error = "Name, address, and phone are required.";
      return res.redirect("/restaurant-dashboard/edit");
    }

    // Update fields
    restaurant.name = name.trim();
    if (description) restaurant.description = description.trim();
    if (address) restaurant.address = address.trim();
    if (phone) restaurant.phone = phone.trim();
    if (email) restaurant.email = email.trim();

    await restaurant.save();

    req.session.success = `✅ Restaurant details updated successfully!`;
    res.redirect("/restaurant-dashboard");
  } catch (err) {
    console.error("Edit restaurant POST error:", err);
    req.session.error = err.message || "Failed to update restaurant details.";
    res.redirect("/restaurant-dashboard/edit");
  }
});

module.exports = router;
