const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const passport = require('passport');

module.exports = function(passport) {

    // ========================================
    // LOCAL STRATEGY (Email/Password)
    // ========================================
    passport.use(new LocalStrategy(
        {
            usernameField: 'email',
            passwordField: 'password'
        },
        async (email, password, done) => {
            try {
                const user = await User.findOne({ email: email.toLowerCase() });

                if (!user) {
                    return done(null, false, { message: 'No account found with this email' });
                }

                // User must have a password for manual login
                if (!user.password) {
                    return done(null, false, { message: 'Please sign up first' });
                }

                const isMatch = await bcrypt.compare(password, user.password);

                if (!isMatch) {
                    return done(null, false, { message: 'Incorrect password' });
                }

                // ✅ B2 SCENARIO: Existing manual user logging in
                user.isNewUser = false;
                await user.save();

                return done(null, user);

            } catch (error) {
                return done(error);
            }
        }
    ));

    // ========================================
    // GOOGLE OAUTH STRATEGY
    // ========================================
    passport.use(new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8080/auth/google/callback'
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if googleId already exists
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    // ✅ A2 SCENARIO: Existing Google user logging in
                    user.isNewUser = false;
                    await user.save();
                    return done(null, user);
                }

                // Check if email exists (from previous manual signup)
                const existingEmail = await User.findOne({ 
                    email: profile.emails[0].value 
                });
                
                if (existingEmail) {
                    // Link Google to existing account
                    existingEmail.googleId = profile.id;
                    existingEmail.isNewUser = false;  // Already has password from manual signup
                    existingEmail.authMethod = 'both';
                    await existingEmail.save();
                    return done(null, existingEmail);
                }

                // ✅ A1 SCENARIO: NEW Google user signing up
                const newUser = new User({
                    googleId: profile.id,
                    email: profile.emails[0].value.toLowerCase(),
                    fullName: profile.displayName,
                    isVerified: true,
                    role: 'customer',
                    isNewUser: true,      // NEW USER - Show modal
                    password: null,       // No password yet
                    authMethod: 'google'
                });

                await newUser.save();
                return done(null, newUser);

            } catch (error) {
                return done(error);
            }
        }
    ));

    // Serialize user
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (error) {
            done(error);
        }
    });
};