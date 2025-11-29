// routes/calendar.js
const express = require('express');
const router = express.Router();
const Restaurant = require('../models/restaurant'); 
const Reservation = require('../models/reservation'); // If you have one

// Calendar route
router.get('/', async (req, res) => {
  try {
    // Get restaurant details (if manager is logged in)
    const restaurant = req.user?.restaurant 
      ? await Restaurant.findById(req.user.restaurant)
      : null;

    // Fetch reservations (optional for now)
    const reservations = await Reservation.find({ restaurant: restaurant?._id });

    res.render('restaurant/calendar', { restaurant, reservations });
  } catch (err) {
    console.error("Error loading calendar:", err);
    res.status(500).send("Error loading calendar page");
  }
});


module.exports = router;
