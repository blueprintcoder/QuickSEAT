// middleware/auth.js - Updated for Dual Auth

// 1. Checks for a valid Passport-based general User session.
const isUserLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) { 
        return next();
    }
    req.session.returnTo = req.originalUrl;
    req.session.error = 'Please log in as a User to continue.'; 
    // Redirect to the selection page, or '/login/user' if implemented
    res.redirect('/login'); 
};

// 2. Checks for a valid Restaurant Manager session (custom session variable).
const isRestaurantLoggedIn = (req, res, next) => {
    // Check for the custom restaurant credential set in app.js
    if (req.session.restaurantId) { 
        return next();
    }
    req.session.error = 'You must log in as a Restaurant Manager to access the dashboard.';
    res.redirect('/login/restaurant');
};

// 3. isOwner (Remains, but is now ONLY for checking User ownership)
const isOwner = (req, res, next) => {
    // NOTE: Requires a resource (e.g., req.booking) to be loaded by a preceding middleware
    // For simplicity, we'll keep the general authentication check here.
    if (req.isAuthenticated() && req.user && req.booking && req.user._id.equals(req.booking.customer)) {
        return next();
    }
    
    // Fallback error
    res.status(403).render('error.ejs', { 
        message: 'Access Denied', 
        error: 'You are not authorized to modify this resource.' 
    });
};

module.exports = {
    isUserLoggedIn,           // New primary check for customer/general access
    isRestaurantLoggedIn,     // New check for dashboard access
    isOwner,
    // Old isAuthenticated, isManager, isCustomer are removed/obsolete
};