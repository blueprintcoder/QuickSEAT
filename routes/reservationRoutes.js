// routes/reservationRoutes.js
const express = require("express");
const router = express.Router();
const { isUserLoggedIn } = require("../middleware/auth");
const { isLoggedIn } = require("../middleware");
const { isRestaurantLoggedIn } = require("../middleware/auth");
const Reservation = require("../models/reservation");
const Restaurant = require("../models/restaurant");
const {
    sendNewBookingNotification,
    sendBookingApprovedNotification,
    sendBookingDeclinedNotification,
    sendBookingCancelledNotification
} = require("../utils/mailer");

// Debug Middleware
router.use((req, res, next) => {
  console.log("➡️ Reached Reservation Route:", req.method, req.originalUrl);
  next();
});

// ============================================
// BOOK A TABLE (Legacy endpoint)
// ============================================
router.post("/", isUserLoggedIn, async (req, res) => {
  try {
    const { restaurantId, date, time, guests, specialRequests } = req.body;

    if (!restaurantId || !date || !time || !guests) {
      req.session.error = "Please fill all booking fields.";
      return res.redirect("/restaurants");
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      req.session.error = "Restaurant not found.";
      return res.redirect("/restaurants");
    }

    const dateTime = new Date(`${date}T${time}`);
    const newReservation = new Reservation({
      restaurant: restaurant._id,
      customer: req.user._id,
      dateTime,
      partySize: parseInt(guests, 10),
      notes: specialRequests || "",
      status: "pending",
    });

    await newReservation.save();
    await newReservation.populate('restaurant customer');

    // EMIT SOCKET EVENT TO RESTAURANT DASHBOARD
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant_${restaurantId}`).emit('newBooking', {
        restaurantId: restaurantId,
        booking: newReservation
      });
      console.log(`📤 Socket event emitted for restaurant: ${restaurantId}`);
    }

    req.session.success = 'Booking request submitted successfully!';
    return res.redirect(`/booking-confirmation/${newReservation._id}`);
  } catch (error) {
    console.error("❌ Booking error:", error);
    req.session.error = "Error booking table. Try again.";
    return res.redirect("/restaurants");
  }
});

// ============================================
// MY BOOKINGS
// ============================================
router.get("/my-bookings", isUserLoggedIn, async (req, res) => {
  try {
    const reservations = await Reservation.find({ customer: req.user._id })
      .populate("restaurant")
      .sort({ dateTime: -1 });
    res.render("my-bookings.ejs", { reservations, pageTitle: "My Bookings" });
  } catch (error) {
    console.error("❌ Error fetching my bookings:", error);
    req.session.error = "Could not load your bookings.";
    res.redirect("/restaurants");
  }
});

// ============================================
// CREATE NEW RESERVATION (Primary endpoint)
// ============================================
router.post('/restaurants/:id/reserve', isUserLoggedIn, async (req, res) => {
  try {
    const { dateTime, partySize, notes } = req.body;
    const restaurantId = req.params.id;

    // Validate required fields
    if (!dateTime || !partySize) {
      req.session.error = "Please provide all required booking details.";
      return res.redirect(`/restaurants/${restaurantId}`);
    }

    // Verify restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      req.session.error = "Restaurant not found.";
      return res.redirect("/restaurants");
    }

    const newReservation = new Reservation({
      restaurant: restaurantId,
      customer: req.user._id,
      dateTime,
      partySize: parseInt(partySize, 10),
      notes: notes || "",
      status: 'pending'
    });

    await newReservation.save();
    await newReservation.populate('restaurant customer');

        // ✅ SEND EMAIL TO RESTAURANT
    try {
      await sendNewBookingNotification(
        restaurant.email,
        newReservation,
        restaurant
      );
      console.log('📧 New booking email sent to restaurant');
    } catch (emailError) {
      console.error('❌ Error sending email:', emailError);
      // Don't fail the booking if email fails
    }

    // EMIT SOCKET EVENT TO RESTAURANT-SPECIFIC ROOM
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant_${restaurantId}`).emit('newBooking', {
        restaurantId: restaurantId,
        booking: newReservation
      });
      console.log(`✅ New booking emitted to room: restaurant_${restaurantId}`);
    }

    req.session.success = 'Booking request submitted successfully!';
    return res.redirect(`/booking-confirmation/${newReservation._id}`);

  } catch (err) {
    console.error('❌ Error creating reservation:', err);
    req.session.error = 'Failed to create booking';
    return res.redirect('back');
  }
});

// ============================================
// BOOKING CONFIRMATION PAGE
// ============================================
router.get('/booking-confirmation/:id', isUserLoggedIn, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('restaurant customer');

    if (!reservation) {
      return res.status(404).render("error.ejs", { message: "Booking not found." });
    }

    res.render("restaurant-dashboard/booking-confirmation.ejs", {
      pageTitle: "Booking Confirmed",
      restaurant: reservation.restaurant,
      booking: reservation,
      user: req.user,
      success: "Booking submitted!"
    });
  } catch (error) {
    console.error("❌ Error loading confirmation page:", error);
    res.status(500).render("error.ejs", { message: "Could not load confirmation page." });
  }
});

// STATUS //
router.put('/:id/status', async (req, res) => {
    try {
        // Auth check (assuming session-based; adjust for JWT/etc.)
        if (!req.session || !req.session.user || req.session.user.role !== 'restaurant') {
            return res.status(401).json({ success: false, message: 'Unauthorized: Restaurant login required' });
        }

        const { id } = req.params;
        const { status } = req.body;

        // Validate status
        if (!['approved', 'declined'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        // Update in DB
        const reservation = await Reservation.findByIdAndUpdate(
            id,
            { status }, // Or map 'declined' to 'rejected' if needed
            { new: true } // Return updated doc
        );

        if (!reservation) {
            return res.status(404).json({ success: false, message: 'Reservation not found' });
        }

        // Optional: Send email notification here

        res.json({ success: true, message: 'Status updated successfully', reservation });
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ============================================
// APPROVE RESERVATION
// ============================================
router.post('/reservations/:id/approve', async (req, res) => {
  try {
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { status: 'approved' },
      { new: true }
    ).populate('restaurant customer');

    if (!reservation) {
      return res.status(404).json({ success: false, error: "Reservation not found" });
    }

        // ✅ SEND EMAIL TO CUSTOMER
    try {
      await sendBookingApprovedNotification(
        reservation.customer.email,
        reservation,
        reservation.restaurant
      );
      console.log('📧 Booking approved email sent to customer');
    } catch (emailError) {
      console.error('❌ Error sending email:', emailError);
    }

    // ✅ FIXED: Emit to all relevant rooms with consistent data
const io = req.app.get('io');
if (io) {
  const eventData = {
    reservationId: reservation._id,
    bookingId: reservation._id,  // Add alternate ID field
    customerId: reservation.customer._id,
    status: 'approved',  // Backend status
    newStatus: 'approved',  // Explicit for frontend
    booking: reservation
  };

  // Emit to restaurant rooms (both IDs)
  io.to(`restaurant_${reservation.restaurant._id}`).emit('bookingStatusChanged', eventData);
  if (reservation.restaurant.restaurantId) {
    io.to(`restaurant_${reservation.restaurant.restaurantId}`).emit('bookingStatusChanged', eventData);
  }

  // Emit to customer room
  io.to(`customer_${reservation.customer._id}`).emit('bookingStatusChanged', eventData);

  console.log(`✅ Approval emitted - Restaurant: ${reservation.restaurant._id}, Customer: ${reservation.customer._id}`);
}

    return res.json({ success: true, message: "Reservation approved" });
  } catch (err) {
    console.error('❌ Approval error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// REJECT RESERVATION
// ============================================
router.post('/reservations/:id/reject', async (req, res) => {
  try {
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { status: 'declined' },
      { new: true }
    ).populate('restaurant customer');

    if (!reservation) {
      return res.status(404).json({ success: false, error: "Reservation not found" });
    }

        // ✅ SEND EMAIL TO CUSTOMER
    try {
      await sendBookingDeclinedNotification(
        reservation.customer.email,
        reservation,
        reservation.restaurant
      );
      console.log('📧 Booking declined email sent to customer');
    } catch (emailError) {
      console.error('❌ Error sending email:', emailError);
    }

    // ✅ FIXED: Emit to all relevant rooms with consistent data
const io = req.app.get('io');
if (io) {
  const eventData = {
    reservationId: reservation._id,
    bookingId: reservation._id,
    customerId: reservation.customer._id,
    status: 'declined',  // Backend status
    newStatus: 'declined',
    booking: reservation
  };

  // Emit to restaurant rooms (both IDs)
  io.to(`restaurant_${reservation.restaurant._id}`).emit('bookingStatusChanged', eventData);
  if (reservation.restaurant.restaurantId) {
    io.to(`restaurant_${reservation.restaurant.restaurantId}`).emit('bookingStatusChanged', eventData);
  }

  // Emit to customer room
  io.to(`customer_${reservation.customer._id}`).emit('bookingStatusChanged', eventData);

  console.log(`✅ Rejection emitted - Restaurant: ${reservation.restaurant._id}, Customer: ${reservation.customer._id}`);
}

    return res.json({ success: true, message: "Reservation rejected" });
  } catch (err) {
    console.error('❌ Rejection error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// CANCEL BOOKING (User-side cancellation)
// ============================================
router.post('/my-bookings/:id/cancel', isUserLoggedIn, async (req, res) => {
  try {
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' },
      { new: true }
    ).populate('restaurant customer');

    if (!reservation) {
      return res.status(404).json({ success: false, error: "Reservation not found" });
    }

        // ✅ SEND EMAIL TO RESTAURANT
    try {
      await sendBookingCancelledNotification(
        reservation.restaurant.email,
        reservation,
        reservation.restaurant
      );
      console.log('📧 Booking cancelled email sent to restaurant');
    } catch (emailError) {
      console.error('❌ Error sending email:', emailError);
    }

    // Emit cancellation event to restaurant dashboard
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant_${reservation.restaurant._id}`).emit('bookingStatusChanged', {
        reservationId: reservation._id,
        customerId: reservation.customer._id,
        status: 'cancelled',
        booking: reservation
      });
      console.log(`🚫 Cancellation emitted for reservation: ${reservation._id}`);
    }

    return res.json({ success: true, message: "Booking cancelled" });
  } catch (err) {
    console.error('❌ Cancellation error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// SHOW RESERVATION FORM
// ============================================
router.get("/restaurants/:id/reserve", async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);
    
    if (!restaurant) {
      return res.render("reservation", { 
        errorMessage: "Restaurant not found", 
        restaurant: {},
        pageTitle: "Make a Reservation"
      });
    }
    
    res.render("reservation", { 
      restaurant, 
      errorMessage: null, 
      successMessage: null,
      pageTitle: "Make a Reservation"
    });
  } catch (error) {
    console.error("❌ Error loading reservation form:", error);
    res.status(500).render("error.ejs", { message: "Could not load reservation form." });
  }
});

// ============================================
// HANDLE RESERVATION FORM SUBMISSION (Legacy)
// ============================================
router.post("/make-reservation", async (req, res) => {
  try {
    console.log("📩 Reservation form data received:", req.body);

    const {
      restaurantId,
      guestName,
      guestEmail,
      guestPhone,
      reservationDate,
      reservationTime,
      guestCount,
      specialRequests
    } = req.body;

    // Combine date and time into one Date object
    const dateTime = new Date(`${reservationDate}T${reservationTime}`);

    // Validate required fields
    if (!restaurantId || !guestName || !guestEmail || !reservationDate || !reservationTime || !guestCount) {
      console.log("❌ Missing fields in reservation data");
      return res.status(400).render("error.ejs", { message: "Please fill all required fields." });
    }

    // Find restaurant
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      console.log("❌ Restaurant not found:", restaurantId);
      return res.status(404).render("error.ejs", { message: "Restaurant not found." });
    }

    // Create reservation
    const newReservation = new Reservation({
      restaurant: restaurant._id,
      customerName: guestName,
      customerEmail: guestEmail,
      customerPhone: guestPhone,
      dateTime,
      partySize: parseInt(guestCount, 10),
      notes: specialRequests || "",
      status: "pending",
    });

    await newReservation.save();
    await newReservation.populate('restaurant');
    console.log("✅ Reservation saved successfully:", newReservation);

    // ✅ FIXED: Emit to BOTH _id and restaurantId rooms for compatibility
const io = req.app.get('io');
if (io) {
  // Emit to MongoDB _id room (primary)
  io.to(`restaurant_${restaurant._id}`).emit('newBooking', {
    restaurantId: restaurant._id,
    booking: newReservation
  });
  
  // Also emit to custom restaurantId room if it exists
  if (restaurant.restaurantId && restaurant.restaurantId !== restaurant._id.toString()) {
    io.to(`restaurant_${restaurant.restaurantId}`).emit('newBooking', {
      restaurantId: restaurant.restaurantId,
      booking: newReservation
    });
  }
  
  console.log(`✅ New booking emitted to rooms: _id=${restaurant._id}, restaurantId=${restaurant.restaurantId || 'N/A'}`);
}


    // Render success page
    res.render("restaurant-dashboard/booking-confirmation.ejs", {
      pageTitle: "Reservation Successful",
      restaurant,
      booking: newReservation,
      successMessage: "Your reservation request has been sent!",
      errorMessage: null,
    });

  } catch (err) {
    console.error("❌ Error making reservation:", err);
    res.status(500).render("error.ejs", { message: "Failed to make reservation." });
  }
});

// ✅ NEW: GET RESERVATIONS BY RESTAURANT (FOR CALENDAR)
router.get("/by-restaurant/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const reservations = await Reservation.find({ restaurant: restaurantId })
      .populate("customer")
      .sort({ dateTime: -1 });

    res.json(reservations);
  } catch (error) {
    console.error("❌ Error fetching reservations by restaurant:", error);
    res.status(500).json({ error: "Failed to fetch reservations" });
  }
});

// ============================================
// SEND EMAIL REMINDERS TO PENDING BOOKINGS
// ============================================
router.post('/send-reminders', async (req, res) => {
  try {
    const { restaurantId, bookingIds } = req.body;

    if (!restaurantId || !bookingIds || bookingIds.length === 0) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const bookings = await Reservation.find({ 
      _id: { $in: bookingIds },
      restaurant: restaurantId 
    }).populate('customer');

    let successCount = 0;
    let failureCount = 0;

    for (const booking of bookings) {
      try {
        const customerEmail = booking.customer ? booking.customer.email : null;
        
        if (customerEmail) {
          await sendBookingReminderNotification(
            customerEmail,
            booking,
            restaurant
          );
          successCount++;
        }
      } catch (emailError) {
        console.error(`Failed to send reminder for booking ${booking._id}:`, emailError);
        failureCount++;
      }
    }

    res.json({ 
      success: true, 
      message: `Reminders sent: ${successCount} successful, ${failureCount} failed`,
      successCount,
      failureCount
    });

  } catch (error) {
    console.error("❌ Error sending reminders:", error);
    res.status(500).json({ error: "Failed to send reminders" });
  }
});

// ============================================
// UPDATE BOOKING STATUS (PATCH /bookings/:id/status)
// ============================================
// ============================================
// UPDATE BOOKING STATUS
// ============================================
router.patch('/:id/status', isRestaurantLoggedIn, async (req, res) => {
  try {
    const { status } = req.body; // 'confirmed' or 'rejected' from frontend
    
    // ✅ FIXED: Explicit status mapping
    const statusMap = {
      'confirmed': 'approved',
      'rejected': 'declined'
    };
    
    const backendStatus = statusMap[status];
    if (!backendStatus) {
      return res.status(400).json({ success: false, message: 'Invalid status. Use "confirmed" or "rejected".' });
    }
    const isApproved = status === 'confirmed';

    // ✅ FIXED: Populate both restaurant & customer for auth + emails
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { status: backendStatus },
      { new: true }
    ).populate('restaurant customer');

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Auth check: Ensure it's the restaurant's booking
    if (reservation.restaurant.restaurantId !== req.session.restaurantId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // ✅ ADD: Send appropriate email (non-blocking)
    let emailSent = true;
    try {
      if (isApproved) {
        await sendBookingApprovedNotification(
          reservation.customer.email,
          reservation,
          reservation.restaurant
        );
        console.log('📧 Approval email sent to customer:', reservation.customer.email);
      } else {
        await sendBookingDeclinedNotification(
          reservation.customer.email,
          reservation,
          reservation.restaurant
        );
        console.log('📧 Decline email sent to customer:', reservation.customer.email);
      }
    } catch (emailError) {
      console.error('❌ Email send error:', emailError);
      emailSent = false; // Track for optional response
    }

        // ✅ FIXED: Emit to ALL relevant rooms with complete data
    const io = req.app.get('io');
    if (io) {
      const eventData = {
        reservationId: reservation._id,
        bookingId: reservation._id,
        customerId: reservation.customer._id,
        status: backendStatus,  // 'approved' or 'declined'
        newStatus: status,  // 'confirmed' or 'rejected' for frontend compatibility
        booking: reservation
      };

      // Emit to restaurant rooms (both ID types)
      io.to(`restaurant_${reservation.restaurant._id}`).emit('bookingStatusChanged', eventData);
      if (reservation.restaurant.restaurantId) {
        io.to(`restaurant_${reservation.restaurant.restaurantId}`).emit('bookingStatusChanged', eventData);
      }

      // Emit to customer room
      io.to(`customer_${reservation.customer._id}`).emit('bookingStatusChanged', eventData);

      console.log(`✅ Status "${status}" (backend: "${backendStatus}") emitted to all rooms`);

      console.log(`✅ Socket emitted "${status}" for booking: ${reservation._id} (email: ${emailSent ? 'sent' : 'failed'})`);
    }

    // ✅ Response: Include email status for debugging (remove in prod if unwanted)
    res.json({ 
      success: true, 
      message: `Booking ${status}`, 
      reservation,
      emailSent 
    });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
