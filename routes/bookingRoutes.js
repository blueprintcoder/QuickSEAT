const express = require("express");
const router = express.Router();
const { isUserLoggedIn } = require("../middleware/auth");
const Reservation = require("../models/reservation");
const Restaurant = require("../models/restaurant");
const User = require("../models/user");
const mongoose = require("mongoose");

// BOOK A TABLE
router.post("/", async (req, res) => {
  try {
    const { restaurantId, date, time, guests } = req.body;
    const restaurant = await Restaurant.findById(restaurantId);
    const newReservation = new Reservation({
      restaurant: restaurant._id,
      customer: req.user._id,
      dateTime: new Date(`${date} ${time}`),
      partySize: guests,
      status: "pending",
      menuItems: req.body.menuItems
    });
    await newReservation.save();

    const io = req.app.get("io");
    const populatedReservation = await Reservation.findById(newReservation._id).populate("customer", "fullname");
    io.to(`restaurant_${restaurant._id}`).emit("newBooking", {
      booking : populatedReservation,
      restaurantId: restaurantId,
    });

    req.session.success = "Booking submitted!";
    res.redirect("/reservations/my-bookings"); // ✅ FIXED
  } catch (error) {
    console.error(error);
    req.session.error = "Error booking table.";
    res.redirect("/restaurants");
  }
});


// MY BOOKINGS
router.get("/my-bookings", isUserLoggedIn, async (req, res) => {
  const reservations = await Reservation.find({ customer: req.user._id }).populate("restaurant");
  res.render("my-bookings.ejs", { reservations });
});

module.exports = router;
