// routes/otpRoutes.js
const express = require('express');
const router = express.Router();
const { transporter } = require('../utils/mailer');

// 💡 FIX 1: Destructure rateLimit and ipKeyGenerator from the package
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const emailKey = req.body.email?.toLowerCase();
        if (emailKey) {
            return emailKey;
        }
        
        return ipKeyGenerator(req); 
    },
    
    message: { error: 'Too many OTP requests. Try again after 15 minutes.' }
});

router.post('/send', otpLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  req.session.emailOtp = otp;
  req.session.emailOtpExpires = Date.now() + 10 * 60 * 1000;
  req.session.pendingEmail = email.toLowerCase();

  try {
    await transporter.sendMail({
      from: '"QuickSEAT" <quickseatofficial@gmail.com>',
      to: email,
      subject: 'QuickSEAT - Your OTP',
      html: `
        <div style="font-family: Arial; text-align: center; padding: 30px; background: #f0f0f0;">
          <h2>Verify Your Email</h2>
          <p>Your OTP is:</p>
          <h1 style="font-size: 40px; letter-spacing: 10px; color: #667eea;">${otp}</h1>
          <p><small>Valid for 10 minutes • Resend anytime</small></p>
        </div>
      `
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

router.post('/verify', (req, res) => {
  const { email, otp } = req.body;
  const lowerEmail = email.toLowerCase();

  if (req.session.pendingEmail === lowerEmail &&
      req.session.emailOtp === otp && 
      Date.now() < req.session.emailOtpExpires) {
    req.session.verifiedEmail = lowerEmail;
    delete req.session.emailOtp;
    delete req.session.emailOtpExpires;
    delete req.session.pendingEmail;
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid or expired OTP' });
  }
});

module.exports = router;