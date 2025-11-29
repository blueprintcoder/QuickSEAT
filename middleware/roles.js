// middleware/roles.js

const Restaurant = require("../models/restaurant");

// Check if the logged-in user is the manager of the restaurant
const isManagerOfRestaurant = async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      req.session.error = "Restaurant not found.";
      return res.redirect("/restaurants-dashboard");
    }

    // Store restaurant for easy access later (optional)
    res.locals.restaurantToEdit = restaurant;

    // Check ownership
    if (restaurant.manager) {
      return next();
    }

    req.session.error = "Access denied. You are not the manager of this restaurant.";
    return res.redirect("/restaurants-dashboard");
  } catch (err) {
    console.error("Error in isManagerOfRestaurant middleware:", err);
    req.session.error = "Something went wrong.";
    res.redirect("/restaurants-dashboard");
  }
};

module.exports = { isManagerOfRestaurant };
