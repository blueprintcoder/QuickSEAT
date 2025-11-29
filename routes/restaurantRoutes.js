// routes/restaurantRoutes.js (Enhanced with specific duplicate field detection)
const express = require("express");
const router = express.Router();
const Restaurant = require("../models/restaurant");
const { isUserLoggedIn } = require("../middleware/auth");
const { isManagerOfRestaurant } = require("../middleware/roles");
const { isRestaurantLoggedIn } = require("../middleware/auth");
const MenuItem = require("../models/menuItem");
const User = require("../models/user"); // ✅ Added for guest user creation
const Reservation = require("../models/reservation"); // ✅ Added for booking save
const upload = require('../middleware/multer');
const { uploadFields } = upload;
const fs = require('fs');
const path = require('path');
const {
  sendNewBookingNotification // ✅ Added for email
} = require("../utils/mailer");

// ---------- ALL RESTAURANTS ----------
router.get("/", async (req, res) => {
  try {
    const restaurants = await Restaurant.find({});
    res.render("restaurants/index.ejs", { restaurants });
  } catch {
    res.render("restaurants/index.ejs", { restaurants: [] });
  }
});

// ---------- SEARCH ----------
router.get("/search", async (req, res) => {
  try {
    const { query } = req.query;
    let filter = {};

    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: "i" } },
        { address: { $regex: query, $options: "i" } },
      ];
    }

    const restaurants = await Restaurant.find(filter);

    res.render("restaurants/search-results.ejs", {
      restaurants,
      searchQuery: query,
      searchDate: req.query.date || "",
      searchTime: req.query.time || "",
      searchGuests: req.query.guests || "",
    });
  } catch (error) {
    req.session.error = "Error searching restaurants.";
    res.redirect("/restaurants");
  }
});

// ---------- NEW ----------
router.get("/new", isUserLoggedIn, (req, res) => {
  const error = req.session.error;
  const success = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.render("restaurants/new.ejs", { error, success });
});

// ---------- ADD ----------
router.post("/add", isUserLoggedIn, uploadFields, async (req, res) => {
  console.log('🔍 /add route hit - Starting restaurant creation'); // Debug: Route entered
  console.log('📝 Request body:', req.body); // Debug: Log form data
  console.log('🖼️ Request files:', req.files); // Debug: Log uploaded files
  console.log('👤 Current user:', req.user ? { _id: req.user._id, email: req.user.email } : 'No user'); // Debug: User check

  try { 
    const { name, address, googleMapsUrl, totalTables, maxPartySize, restaurantId, restaurantPassword, email } = req.body;
    console.log('✅ Destructured data:', { name, address, totalTables, maxPartySize, restaurantId, email }); // Debug: Parsed fields

    // ✅ Added: Validate required fields
    if (!name || !address || !googleMapsUrl || !totalTables || !maxPartySize || !restaurantId || !restaurantPassword || !email) {
      console.log('❌ Missing required fields'); // Debug
      req.session.error = "All required fields must be filled.";
      return res.redirect("/restaurants/new");
    }

    // ✅ Added: Validate numbers
    const totalTablesNum = parseInt(totalTables);
    const maxPartySizeNum = parseInt(maxPartySize);
    if (isNaN(totalTablesNum) || totalTablesNum < 1 || totalTablesNum > 100) {
      console.log('❌ Invalid totalTables:', totalTables); // Debug
      req.session.error = "Total Tables must be a number between 1 and 100.";
      return res.redirect("/restaurants/new");
    }
    if (isNaN(maxPartySizeNum) || maxPartySizeNum < 1 || maxPartySizeNum > 50) {
      console.log('❌ Invalid maxPartySize:', maxPartySize); // Debug
      req.session.error = "Maximum Party Size must be a number between 1 and 50.";
      return res.redirect("/restaurants/new");
    }

    // ✅ Added: Validate password length
    if (restaurantPassword.length < 6) {
      console.log('❌ Password too short'); // Debug
      req.session.error = "Dashboard Password must be at least 6 characters.";
      return res.redirect("/restaurants/new");
    }

    // ✅ Added: Basic email format check (simple regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Invalid email format'); // Debug
      req.session.error = "Please enter a valid email address.";
      return res.redirect("/restaurants/new");
    }

    // ✅ Added: Basic URL format check for Google Maps
    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlRegex.test(googleMapsUrl)) {
      console.log('❌ Invalid Google Maps URL'); // Debug
      req.session.error = "Please enter a valid Google Maps URL.";
      return res.redirect("/restaurants/new");
    }

    // ✅ Added: Validate main image upload (server-side enforcement)
    if (!req.files || !req.files['mainImage'] || !req.files['mainImage'][0]) {
      console.log('❌ No main image uploaded'); // Debug
      req.session.error = "Main image is required.";
      return res.redirect("/restaurants/new");
    }

    // ✅ Enhanced: Check for duplicates individually for specific error messages
    let duplicateField = null;
    let existing = null;

    // Check name (exact match, case-insensitive)
    existing = await Restaurant.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' } });
    if (existing) {
      duplicateField = 'name';
    } else {
      // Check restaurantId (exact match)
      existing = await Restaurant.findOne({ restaurantId: restaurantId.trim().toUpperCase() });
      if (existing) {
        duplicateField = 'restaurantId';
      } else {
        // Check email (exact match, lowercase)
        existing = await Restaurant.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
          duplicateField = 'email';
        }
      }
    }

    console.log('🔍 Duplicate check result:', duplicateField ? `Duplicate on ${duplicateField}` : 'No duplicate'); // Debug
    if (duplicateField) {
      console.log('❌ Duplicate found, redirecting with specific error'); // Debug
      req.session.error = `The ${duplicateField === 'name' ? 'Restaurant Name' : duplicateField === 'restaurantId' ? 'Restaurant ID' : 'Email'} already exists. Please choose a unique one.`;
      return res.redirect("/restaurants/new");
    }

    // Handle main image
    const mainImage = req.files['mainImage'][0].path.replace('public', '');
    console.log('🖼️ Main image path:', mainImage); // Debug

    // Handle gallery images
    const galleryImages = req.files['galleryImages']
      ? req.files['galleryImages'].slice(0, 5).map(f => f.path.replace('public', '')) // Limit to 5
      : [];
    console.log('🖼️ Gallery images paths:', galleryImages); // Debug

    // Create new restaurant instance
    const newRestaurant = new Restaurant({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      address: address.trim(),
      googleMapsUrl: googleMapsUrl.trim(),
      totalTables: totalTablesNum,
      maxPartySize: maxPartySizeNum,
      restaurantId: restaurantId.trim().toUpperCase(), // Standardize ID
      manager: req.user._id,
      mainImage,
      galleryImages
    });
    console.log('📝 New restaurant object created:', { name: newRestaurant.name, restaurantId: newRestaurant.restaurantId }); // Debug

    // Hash password
    console.log('🔐 Hashing password...'); // Debug
    await newRestaurant.hashAndSetPassword(restaurantPassword);
    console.log('✅ Password hashed successfully'); // Debug

    // Save to DB
    console.log('💾 Saving to database...'); // Debug
    await newRestaurant.save();
    console.log('✅ Restaurant saved! ID:', newRestaurant._id); // Debug: Confirm save

    // Set session
    req.session.restaurantId = newRestaurant.restaurantId;
    req.session.restaurantName = newRestaurant.name;
    console.log('🔑 Session set:', { restaurantId: newRestaurant.restaurantId, restaurantName: newRestaurant.name }); // Debug

    // ✅ New: Send confirmation email with clickable Google Maps URL
    try {
      await sendRestaurantConfirmation(email, newRestaurant);
      console.log('📧 Confirmation email sent with Google Maps link');
    } catch (emailError) {
      console.error('❌ Confirmation email failed:', emailError);
      // Don't fail the creation if email fails
    }
    
    req.session.success = 'Restaurant created successfully!';
    console.log('🚀 Redirecting to dashboard'); // Debug
    res.redirect("/restaurant-dashboard");
  } catch (err) {
    console.error("❌ Add restaurant error (full stack):", err.stack); // Debug: Full error log with stack
    req.session.error = `Failed to add restaurant: ${err.message}`;
    res.redirect("/restaurants/new");
  }
});

// ---------- EDIT ----------
router.get("/:id/edit", isManagerOfRestaurant, (req, res) => {
  res.render("restaurants/edit.ejs", { restaurant: res.locals.restaurantToEdit });
});

// ---------- UPDATE ----------
router.put("/:id", isManagerOfRestaurant, upload.array('newImages'), async (req, res) => {
  try {
    const { name, address, totalTables, maxPartySize, mainImage, removedImages } = req.body;

    let removed = [];
    if (removedImages) {
      removed = Array.isArray(removedImages) ? removedImages : (typeof removedImages === 'string' ? removedImages.split(',') : []);
      removed = removed.filter(Boolean);
    }

    const newImages = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];

    const restaurant = await Restaurant.findById(req.params.id);

    let gallery = (restaurant.galleryImages || []).filter(img => !removed.includes(img));
    gallery = gallery.concat(newImages);

    let newMain = mainImage && !removed.includes(mainImage) ? mainImage : (gallery[0] || '/images/default-restaurant.jpg');

    await Restaurant.findByIdAndUpdate(req.params.id, {
      name,
      address,
      totalTables: Number(totalTables),
      maxPartySize: Number(maxPartySize),
      mainImage: newMain,
      galleryImages: gallery.filter(img => img !== newMain)
    });

    const updatedRestaurant = await Restaurant.findById(req.params.id);

    req.session.restaurantId = updatedRestaurant.restaurantId;
    req.session.restaurantName = updatedRestaurant.name;

    const io = req.app.get('io');
    io.emit('restaurantUpdated', {
      _id: updatedRestaurant._id,
      name: updatedRestaurant.name,
      mainImage: updatedRestaurant.mainImage,
      address: updatedRestaurant.address,
      totalTables: updatedRestaurant.totalTables,
      maxPartySize: updatedRestaurant.maxPartySize
    });

    req.session.success = 'Restaurant updated successfully!';
    res.redirect("/restaurant-dashboard");
  } catch (err) {
    console.error(err);
    req.session.error = 'Update failed';
    res.redirect('back');
  }
});

// ---------- SHOW ----------
router.get("/:id", async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id).populate("manager");
    if (!restaurant) {
      req.session.error = "Restaurant not found.";
      return res.redirect("/restaurants");
    }

    const menuItems = await MenuItem.find({ restaurant: req.params.id });

    res.render("restaurants/show.ejs", { restaurant, menuItems });
  } catch (err) {
    console.error("Error fetching restaurant:", err);
    req.session.error = "Failed to load restaurant details.";
    res.redirect("/restaurants");
  }
});

// ---------- MAKE RESERVATION FORM (GET) ----------
router.get("/:id/reserve", async (req, res) => {
  try {
    console.log('📄 Loading reserve form for ID:', req.params.id); // ✅ Debug
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).render("makeReservation", {
        restaurant: { name: "Unknown" },
        menuItems: [],
        errorMessage: "Restaurant not found.",
      });
    }

    const menuItems = await MenuItem.find({ 
      restaurant: restaurant._id,
      isAvailable: true 
    }).sort({ cuisine: 1, dishName: 1 });

    console.log('✅ Form loaded with', menuItems.length, 'menu items'); // ✅ Debug

    res.render("makeReservation", { 
      restaurant,
      menuItems,
      errorMessage: null,
      successMessage: null
    });
  } catch (error) {
    console.error("❌ Error loading reservation form:", error.stack); // ✅ Detailed log
    res.status(500).render("makeReservation", {
      restaurant: { name: "Error" },
      menuItems: [],
      errorMessage: "Failed to load reservation form.",
    });
  }
});

// ---------- HANDLE RESERVATION SUBMISSION (POST - Guest/Anonymous) ----------
router.post("/make-reservation", async (req, res) => {
  try {
    console.log('📝 Guest booking attempt:', req.body); // ✅ Debug input
    const { 
      restaurantId, 
      guestName, 
      guestEmail, 
      guestPhone, 
      reservationDate, 
      reservationTime, 
      guestCount, 
      specialRequests,
      menuItems: rawMenuItems
    } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      console.log('❌ Restaurant not found for guest booking');
      return res.status(404).render("makeReservation", {
        restaurant: { name: "Unknown" },
        menuItems: [],
        errorMessage: "Restaurant not found.",
      });
    }

    const dateTime = new Date(`${reservationDate}T${reservationTime}`);
    if (isNaN(dateTime.getTime()) || dateTime < new Date()) {
      console.log('❌ Invalid date for guest booking');
      const availableMenuItems = await MenuItem.find({ 
        restaurant: restaurantId, isAvailable: true 
      });
      return res.render("makeReservation", {
        restaurant, menuItems: availableMenuItems, errorMessage: "Reservation must be in the future.",
      });
    }

    // Create or find guest user
    let customer = await User.findOne({ email: guestEmail.toLowerCase() });
    if (!customer) {
      customer = new User({
        fullName: guestName,
        email: guestEmail.toLowerCase(),
        phone: guestPhone || '',
        isGuest: true
      });
      await customer.save();
      console.log('✅ Created guest user:', customer._id);
    } else {
      console.log('✅ Found existing user:', customer._id);
    }

    // Parse menuItems
    let selectedMenuItems = [];
    if (rawMenuItems) {
      selectedMenuItems = Array.isArray(rawMenuItems) ? rawMenuItems : [rawMenuItems];
      selectedMenuItems = selectedMenuItems.filter(id => id && id.trim() !== '');
    }

    const newReservation = new Reservation({
      restaurant: restaurant._id,
      customer: customer._id,
      dateTime: dateTime,
      partySize: parseInt(guestCount),
      notes: specialRequests || '',
      menuItems: selectedMenuItems,
      status: "pending", // ✅ Standardized
    });

    await newReservation.save();
    console.log('✅ Guest booking saved:', newReservation._id);

    // ✅ Populate for emission/email
    await newReservation.populate([
      'restaurant', 
      'customer', 
      { path: 'menuItems', model: 'MenuItem' }
    ]);

    // Send email to restaurant
    try {
      await sendNewBookingNotification(restaurant.email, newReservation, restaurant);
      console.log('📧 Guest booking email sent');
    } catch (emailError) {
      console.error('❌ Guest email failed:', emailError);
    }

    // ✅ Emit real-time (standardized)
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant_${restaurant.restaurantId}`).emit('newBooking', {
        restaurantId: restaurant.restaurantId,
        booking: newReservation
      });
      console.log(`✅ Guest booking emitted: ${newReservation._id}`);
    }

    // Render success on same page (no redirect for guests, as per original)
    const availableMenuItems = await MenuItem.find({ 
      restaurant: restaurantId, isAvailable: true 
    });
    res.render("makeReservation", {
      restaurant,
      menuItems: availableMenuItems,
      successMessage: `Reservation sent successfully! ${selectedMenuItems.length > 0 ? `Pre-ordered ${selectedMenuItems.length} item(s).` : ''}`,
      errorMessage: null
    });
  } catch (error) {
    console.error("❌ FULL ERROR guest reservation:", error.stack); // ✅ Detailed log
    res.status(500).render("makeReservation", {
      restaurant: { name: "Error" },
      menuItems: [],
      errorMessage: "Failed to submit reservation. Please try again.",
    });
  }
});

// ---------- CALENDAR ----------
router.get('/calendar', isRestaurantLoggedIn, async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ restaurantId: req.session.restaurantId });
    if (!restaurant) {
      req.session.error = "Restaurant not found.";
      return res.redirect("/restaurants");
    }
    res.render('restaurant-dashboard/calendar', { restaurant });
  } catch (err) {
    console.error("Error loading calendar:", err);
    req.session.error = "Failed to load calendar.";
    res.redirect("/restaurant-dashboard");
  }
});

module.exports = router;