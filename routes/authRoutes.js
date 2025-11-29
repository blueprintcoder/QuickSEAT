const express = require("express");
const router = express.Router();
const passport = require("passport");
const bcrypt = require("bcryptjs");
const Restaurant = require("../models/restaurant");
const User = require("../models/user");

// ---------- SIGNUP ----------
router.get("/signup", (req, res) =>
  res.render("signup.ejs", { error: res.locals.error, formData: {} })
);

// routes/authRoutes.js → /signup/complete
router.post('/signup', async (req, res) => {
  const { email, password, fullName, phone, role } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const phoneExists = await User.findOne({ phone });
    if (phoneExists) {
      return res.status(400).json({ error: 'Phone number already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
    email: email.toLowerCase(),
    fullName,
    phone,
    role: role || 'customer', 
    password: hashedPassword,
    isVerified: true,
    isNewUser: false,  // ✅ Manual signup - NO modal needed
    authMethod: 'email-password'
});

await newUser.save();


    req.login(newUser, (err) => {
      if (err) return res.status(500).json({ error: 'Login failed' });
      res.json({ success: true, redirect: '/restaurants' });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== GOOGLE OAUTH PASSWORD SETUP ==========

// Check if user has password set
router.get('/auth/check-password-status', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ passwordSet: false });
    }
    
    const passwordSet = !!req.user.password; // true if password exists
    res.json({ passwordSet });
});

// Set password route (after Google login)
router.post('/auth/set-password', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const { password } = req.body;

        // Validation
        if (!password || password.length < 6) {
            return res.status(400).json({ 
                message: 'Password must be at least 6 characters' 
            });
        }

        // Check if already has password
        if (req.user.password) {
            return res.status(400).json({ 
                message: 'Password already set' 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            {
                password: hashedPassword,
                authMethod: 'both',
                passwordSetAt: new Date(),
                isNewUser: false  // ✅ Mark as old - hide modal
            },
            { new: true }
        );

        res.json({ 
            success: true, 
            message: 'Password set successfully' 
        });

    } catch (error) {
        console.error('Error setting password:', error);
        res.status(500).json({ 
            message: 'Error setting password',
            error: error.message 
        });
    }
});


// Route to check if user needs to show password modal
router.get('/auth/user-status', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ authenticated: false });
    }
    
    // Show modal if: NEW USER + GOOGLE AUTH + NO PASSWORD
    const showPasswordModal = req.user.isNewUser && req.user.googleId && !req.user.password;
    
    res.json({ 
        authenticated: true,
        user: req.user,
        showPasswordModal: showPasswordModal
    });
});


// ========== END GOOGLE OAUTH PASSWORD SETUP ==========


// ---------- LOGIN ----------
router.get("/login", (req, res) =>
  res.render("login.ejs", { pageTitle: "Select Login Type" })
);

router.get("/login/user", (req, res) =>
  res.render("auth/user-login.ejs", { pageTitle: "User Login" })
);

router.post(
  "/login/user",
  passport.authenticate("local", {
    failureRedirect: "/login/user",
    failureFlash: true,
  }),
  (req, res) => {
    const redirectPath = req.session.returnTo || "/restaurants";
    delete req.session.returnTo;
    res.redirect(redirectPath);
  }
);

router.get("/login/restaurant", (req, res) =>
  res.render("auth/restaurant-login.ejs", { pageTitle: "Restaurant Login" })
);

router.post("/login/restaurant", async (req, res) => {
  const { restaurantId, password } = req.body;
  const restaurant = await Restaurant.findOne({ restaurantId });
  if (!restaurant || !(await restaurant.comparePassword(password))) {
    req.session.error = "Invalid credentials.";
    return res.redirect("/login/restaurant");
  }
  req.session.restaurantId = restaurant.restaurantId;
  req.session.restaurantName = restaurant.name;
  req.session.success = `Logged into ${restaurant.name}.`;
  res.redirect("/restaurant-dashboard");
});

// ---------- LOGOUT ----------
router.get("/logout", (req, res) => {
  if (req.session.restaurantId) {
    delete req.session.restaurantId;
    delete req.session.restaurantName;
  }
  req.logout((err) => {
    if (err) console.error(err);
    res.redirect("/");
  });
});

module.exports = router;
