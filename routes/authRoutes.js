const express = require("express");
const router = express.Router();
const passport = require("passport");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const Restaurant = require("../models/restaurant"); 
const jwt = require('jsonwebtoken');
const { sendPasswordResetEmail, sendPasswordResetConfirmation } = require('../utils/mailer');



// ========================================
// SIGNUP PAGE (GET)
// ========================================
router.get("/signup", (req, res) =>
  res.render("signup.ejs", { error: res.locals.error, formData: {} })
);

// ========================================
// MANUAL SIGNUP (POST) - SCENARIO B1
// ========================================
router.post('/signup', async (req, res) => {
  const { email, password, fullName, phone, role } = req.body;

  try {
    // Validation
    if (!email || !password || !fullName || !phone) {
      return res.status(400).json({ 
        error: 'All fields are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      });
    }

    // Check if email exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Email already in use' 
      });
    }

    // Check if phone exists
    const phoneExists = await User.findOne({ phone });
    if (phoneExists) {
      return res.status(400).json({ 
        error: 'Phone number already in use' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ B1 SCENARIO: New manual user - Password set at signup
    const newUser = new User({
      email: email.toLowerCase(),
      fullName,
      phone,
      role: role || 'customer',
      password: hashedPassword,
      isVerified: true,
      isNewUser: false,        // ✅ NO MODAL NEEDED
      authMethod: 'email-password',
      passwordSetAt: new Date()
    });

    await newUser.save();

    // Auto-login
    req.login(newUser, (err) => {
      if (err) return res.status(500).json({ error: 'Login failed' });
      res.redirect('/restaurants');
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================================
// LOGIN PAGE (GET)
// ========================================
router.get("/login", (req, res) =>
  res.render("login.ejs", { pageTitle: "Select Login Type" })
);

router.get("/login/user", (req, res) =>
  res.render("auth/user-login.ejs", { pageTitle: "User Login" })
);

// ========================================
// MANUAL LOGIN (POST) - SCENARIO B2 ✅ FIXED
// ========================================
router.post(
  "/login/user",
  passport.authenticate("local", {
    failureRedirect: "/login/user",
    failureFlash: true,
    failureMessage: true
  }),
  async (req, res) => {
    try {
      // ✅ B2 SCENARIO: Mark as existing user
      if (req.user) {
        req.user.isNewUser = false;
        await req.user.save();
      }

      const redirectPath = req.session.returnTo || "/restaurants";
      delete req.session.returnTo;
      
      // ✅ ACTUAL PAGE REDIRECT (not JSON response)
      res.redirect(redirectPath);
    } catch (error) {
      console.error('Login redirect error:', error);
      res.redirect('/login/user');
    }
  }
);


router.get("/login/restaurant", (req, res) =>
  res.render("auth/restaurant-login.ejs", { pageTitle: "Restaurant Login" })
);

router.post("/login/restaurant", async (req, res) => {
  const { restaurantId, password } = req.body;
  
  try {
    const restaurant = await Restaurant.findOne({ restaurantId });
    
    if (!restaurant || !(await restaurant.comparePassword(password))) {
      req.session.error = "Invalid credentials.";
      return res.redirect("/login/restaurant");
    }
    
    req.session.restaurantId = restaurant.restaurantId;
    req.session.restaurantName = restaurant.name;
    req.session.success = `Logged into ${restaurant.name}.`;
    res.redirect("/restaurant-dashboard");
  } catch (err) {
    console.error('Restaurant login error:', err);
    req.session.error = "Login failed";
    res.redirect("/login/restaurant");
  }
});


// ========================================
// GOOGLE OAUTH ROUTES
// ========================================
router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // ✅ A1 & A2 SCENARIOS: Redirected to home
    // Frontend will check if modal should show
    res.redirect('/');
  }
);

// ========================================
// CHECK USER STATUS - DETERMINE IF MODAL NEEDED
// ========================================
router.get('/auth/user-status', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ 
      authenticated: false,
      showPasswordModal: false
    });
  }

  // ✅ LOGIC: Show modal only if:
  // - User is NEW (isNewUser: true)
  // - User used Google auth (googleId exists)
  // - User doesn't have password yet (password is null/undefined)
  
  const showPasswordModal = 
    req.user.isNewUser && 
    req.user.googleId && 
    !req.user.password;

  res.json({ 
    authenticated: true,
    user: {
      id: req.user._id,
      email: req.user.email,
      fullName: req.user.fullName,
      authMethod: req.user.authMethod
    },
    showPasswordModal: showPasswordModal,
    isNewUser: req.user.isNewUser,
    hasPassword: !!req.user.password
  });
});

// ========================================
// SET PASSWORD - AFTER GOOGLE LOGIN (A1 ONLY)
// ========================================
router.post('/auth/set-password', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authenticated' 
      });
    }

    const { password } = req.body;

    // Validation
    if (!password || password.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Password is required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'Password must be at least 6 characters' 
      });
    }

    // Only allow if user doesn't already have a password
    if (req.user.password) {
      return res.status(400).json({ 
        success: false,
        message: 'Password already set' 
      });
    }

    // Hash and save password
    const hashedPassword = await bcrypt.hash(password, 10);

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        password: hashedPassword,
        passwordSetAt: new Date(),
        isNewUser: false,        // ✅ Mark as old - hide modal
        authMethod: 'both'       // User can now login with email+password or Google
      },
      { new: true }
    );

    // Update session
    req.user = updatedUser;

    res.json({ 
      success: true,
      message: 'Password set successfully!'
    });

  } catch (error) {
    console.error('Error setting password:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error setting password',
      error: error.message 
    });
  }
});

// ========================================
// LOGOUT
// ========================================
router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) console.error(err);
    res.redirect("/");
  });
});

router.get('/forgot-password', (req, res) => {
    res.render('auth/forgot-password', { error: null });
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ 
                error: 'Email is required' 
            });
        }

        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            // Don't reveal if email exists (security)
            return res.json({ 
                success: true,
                message: 'If an account exists, you will receive an email with reset instructions'
            });
        }

        // Check if user is blocked (too many attempts)
        if (user.passwordResetBlockedUntil && user.passwordResetBlockedUntil > new Date()) {
            return res.status(429).json({ 
                error: 'Too many reset attempts. Try again later.' 
            });
        }

        // Generate reset token (valid for 30 minutes)
        const resetToken = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30m' }
        );

        // Save reset token and expiry
        user.resetToken = resetToken;
        user.resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        await user.save();

        // Send password reset email
        await sendPasswordResetEmail(user.email, resetToken, user.fullName || 'User');

        res.json({ 
            success: true,
            message: 'Password reset email sent successfully!'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ 
            error: 'Error processing forgot password request' 
        });
    }
});

// ========================================
// RESET PASSWORD - STEP 2: Verify Token & Set New Password
// ========================================
router.get('/auth/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Find user
        const user = await User.findById(decoded.userId);
        
        if (!user || user.resetToken !== token || user.resetTokenExpiry < new Date()) {
            return res.render('auth/reset-password-error', { 
                error: 'Password reset link is invalid or has expired'
            });
        }

        res.render('auth/reset-password', { 
            token,
            email: user.email,
            error: null
        });

    } catch (error) {
        console.error('Reset password verification error:', error);
        res.render('auth/reset-password-error', { 
            error: 'Invalid or expired reset link'
        });
    }
});

router.post('/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;

        // Validation
        if (!newPassword || !confirmPassword) {
            return res.status(400).json({ 
                error: 'All fields are required' 
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ 
                error: 'Passwords do not match' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                error: 'Password must be at least 6 characters' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Find user
        const user = await User.findById(decoded.userId);
        
        if (!user || user.resetToken !== token || user.resetTokenExpiry < new Date()) {
            return res.status(400).json({ 
                error: 'Password reset link is invalid or has expired' 
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user
        user.password = hashedPassword;
        user.resetToken = null;
        user.resetTokenExpiry = null;
        user.passwordResetAttempts = 0;
        user.passwordResetBlockedUntil = null;
        user.authMethod = user.googleId ? 'both' : 'email-password';
        user.passwordSetAt = new Date();
        
        await user.save();

        // Send confirmation email
        await sendPasswordResetConfirmation(user.email, user.fullName || 'User');

        res.json({ 
            success: true,
            message: 'Password reset successfully! You can now login with your new password.',
            redirect: '/login/user'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ 
            error: 'Error resetting password' 
        });
    }
});

// ========================================
// SECURITY QUESTIONS FALLBACK
// ========================================
router.post('/auth/get-security-questions', async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user || !user.securityQuestions || user.securityQuestions.length === 0) {
            return res.status(400).json({ 
                error: 'No security questions set for this account' 
            });
        }

        // Return only questions (not answers)
        const questions = user.securityQuestions.map((q, index) => ({
            index,
            question: q.question
        }));

        res.json({ questions });

    } catch (error) {
        console.error('Get security questions error:', error);
        res.status(500).json({ 
            error: 'Error retrieving security questions' 
        });
    }
});

router.post('/auth/verify-security-answers', async (req, res) => {
    try {
        const { email, answers } = req.body; // answers = [{ index, answer }]

        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user || !user.securityQuestions) {
            return res.status(400).json({ 
                error: 'User not found' 
            });
        }

        // Check if user is blocked
        if (user.passwordResetBlockedUntil && user.passwordResetBlockedUntil > new Date()) {
            return res.status(429).json({ 
                error: 'Too many failed attempts. Try again later.' 
            });
        }

        // Verify answers
        let allCorrect = true;
        
        for (const { index, answer } of answers) {
            const question = user.securityQuestions[index];
            if (!question) {
                allCorrect = false;
                break;
            }

            // Compare hashed answers
            const isCorrect = await bcrypt.compare(answer.toLowerCase().trim(), question.answer);
            if (!isCorrect) {
                allCorrect = false;
                break;
            }
        }

        if (!allCorrect) {
            // Increment failed attempts
            user.passwordResetAttempts = (user.passwordResetAttempts || 0) + 1;
            
            // Block after 3 failed attempts for 15 minutes
            if (user.passwordResetAttempts >= 3) {
                user.passwordResetBlockedUntil = new Date(Date.now() + 15 * 60 * 1000);
            }
            
            await user.save();
            
            return res.status(400).json({ 
                error: ```Incorrect answers. ${3 - (user.passwordResetAttempts - 1)} attempts remaining.``` 
            });
        }

        // Answers correct - generate temporary token
        const tempToken = jwt.sign(
            { userId: user._id, method: 'security-questions' },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '15m' }
        );

        // Reset attempts on success
        user.passwordResetAttempts = 0;
        user.passwordResetBlockedUntil = null;
        await user.save();

        res.json({ 
            success: true,
            token: tempToken,
            message: 'Security answers verified! You can now reset your password.'
        });

    } catch (error) {
        console.error('Verify security answers error:', error);
        res.status(500).json({ 
            error: 'Error verifying security answers' 
        });
    }
});

router.post('/auth/reset-password-via-questions', async (req, res) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ 
                error: 'Passwords do not match' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                error: 'Password must be at least 6 characters' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        if (decoded.method !== 'security-questions') {
            return res.status(400).json({ 
                error: 'Invalid reset method' 
            });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(400).json({ 
                error: 'User not found' 
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user
        user.password = hashedPassword;
        user.authMethod = user.googleId ? 'both' : 'email-password';
        user.passwordSetAt = new Date();
        
        await user.save();

        // Send confirmation email
        await sendPasswordResetConfirmation(user.email, user.fullName || 'User');

        res.json({ 
            success: true,
            message: 'Password reset successfully!',
            redirect: '/login/user'
        });

    } catch (error) {
        console.error('Reset password via questions error:', error);
        res.status(500).json({ 
            error: 'Error resetting password' 
        });
    }
});

module.exports = router;