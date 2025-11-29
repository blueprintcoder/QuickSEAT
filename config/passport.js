// config/passport.js - PASSPORT LOCAL STRATEGY CONFIGURATION

const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const passport = require('passport');

module.exports = function(passport) {

    // Local Strategy for Email/Password Login
    passport.use(new LocalStrategy(
        {
            usernameField: 'email', // Use email instead of username
            passwordField: 'password'
        },
        async (email, password, done) => {
            try {
                // Find user by email
                const user = await User.findOne({ email: email.toLowerCase() });

                if (!user) {
                    return done(null, false, { message: 'No account found with this email' });
                }

                // Compare password
                const isMatch = await bcrypt.compare(password, user.password);

                if (!isMatch) {
                    return done(null, false, { message: 'Incorrect password' });
                }

                // Success
                return done(null, user);

            } catch (error) {
                return done(error);
            }
        }
    ));

    // ===== GOOGLE OAUTH STRATEGY =====
    passport.use(new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: 'http://localhost:8080/auth/google/callback' || process.env.GOOGLE_CALLBACK_URL
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user already exists with this Google ID
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
    user.isNewUser = false;  // ✅ OLD USER - Already has password
    await user.save();
    return done(null, user);
}


                // Check if user exists with this email
                const existingEmail = await User.findOne({ email: profile.emails[0].value });
                
                if (existingEmail) {
    existingEmail.googleId = profile.id;
    existingEmail.isNewUser = false;  // ✅ OLD USER - No modal
    await existingEmail.save();
    return done(null, existingEmail);
}


                // Create new user with isNewUser flag
const newUser = new User({
    googleId: profile.id,
    email: profile.emails[0].value,
    fullName: profile.displayName,
    isVerified: true,
    role: 'customer',
    isNewUser: true,  // ✅ NEW USER - Mark for modal
    password: null    // No password initially
});

await newUser.save();
return done(null, newUser);


            } catch (error) {
                return done(error);
            }
        }
    ));

    // Serialize user (store user ID in session)
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user (retrieve user from session)
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (error) {
            done(error);
        }
    });
};