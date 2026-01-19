const nodemailer = require('nodemailer');

// ✅ Create reusable transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    secure: true,
    port: 465,
    auth: {
        user: process.env.EMAIL_USER || "quickseatofficial@gmail.com",
        pass: process.env.EMAIL_PASSWORD || "dtshamikobyjvfda"
    }
});

// Verify connection on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email transporter error:', error);
    } else {
        console.log('✅ Email transporter ready');
    }
});

// ========================
// EMAIL TEMPLATES
// ========================

// New Booking Notification (to Restaurant)
const sendNewBookingNotification = (restaurantEmail, booking, restaurant) => {
    const mailOptions = {
        from: '"QuickSEAT" <quickseatofficial@gmail.com>',
        to: restaurantEmail,
        subject: '🔔 New Booking Request - QuickSEAT',
        html: `
            <h2>New Booking Request</h2>
            <p>Hi <strong>${restaurant.name}</strong>,</p>
            <p>You have received a new booking request!</p>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Customer:</strong> ${booking.customer.fullName}</p>
                <p><strong>Email:</strong> ${booking.customer.email}</p>
                <p><strong>Phone:</strong> ${booking.customer.phone || 'N/A'}</p>
                <p><strong>Date & Time:</strong> ${new Date(booking.dateTime).toLocaleString()}</p>
                <p><strong>Party Size:</strong> ${booking.partySize} guests</p>
                <p><strong>Special Requests:</strong> ${booking.notes || 'None'}</p>
            </div>
            
            <p><a href="${process.env.APP_BASE_URL || 'http://localhost:8080'}/restaurant-dashboard" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View in Dashboard</a></p>
            
            <p>Best regards,<br><strong>QuickSEAT Team</strong></p>
        `
    };
    
    return transporter.sendMail(mailOptions);
};

// Booking Approved (to Customer)
const sendBookingApprovedNotification = (customerEmail, booking, restaurant) => {
    const hasGoogleMapsUrl = restaurant && restaurant.googleMapsUrl && restaurant.googleMapsUrl.trim() !== '';
    const locationHtml = hasGoogleMapsUrl 
        ? `<p><strong>Location:</strong> <a href="${restaurant.googleMapsUrl}" target="_blank" rel="noopener noreferrer">${restaurant.address}</a></p>`
        : `<p><strong>Location:</strong> ${restaurant.address}</p>`;
    
    const mailOptions = {
        from: '"QuickSEAT" <quickseatofficial@gmail.com>',
        to: customerEmail,
        subject: '✅ Your Booking is Confirmed - QuickSEAT',
        html: `
            <h2>Booking Confirmed!</h2>
            <p>Hi <strong>${booking.customer.fullName}</strong>,</p>
            <p>Great news! Your booking at <strong>${restaurant.name}</strong> has been confirmed! 🎉</p>
            
            <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Restaurant:</strong> ${restaurant.name}</p>
                ${locationHtml}
                <p><strong>Date & Time:</strong> ${new Date(booking.dateTime).toLocaleString()}</p>
                <p><strong>Party Size:</strong> ${booking.partySize} guests</p>
            </div>
            
            <p>Please arrive 10 minutes early. If you need to cancel, visit your bookings page.</p>
            
            <p><a href="${process.env.APP_BASE_URL || 'http://localhost:8080'}/my-bookings" style="background: #27ae60; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Your Booking</a></p>
            
            <p>Best regards,<br><strong>QuickSEAT Team</strong></p>
        `
    };
    
    return transporter.sendMail(mailOptions);
};

// Booking Declined (to Customer)
const sendBookingDeclinedNotification = (customerEmail, booking, restaurant) => {
    const mailOptions = {
        from: '"QuickSEAT" <quickseatofficial@gmail.com>',
        to: customerEmail,
        subject: '❌ Your Booking was Declined - QuickSEAT',
        html: `
            <h2>Booking Status Update</h2>
            <p>Hi <strong>${booking.customer.fullName}</strong>,</p>
            <p>Unfortunately, your booking request at <strong>${restaurant.name}</strong> has been declined.</p>
            
            <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Restaurant:</strong> ${restaurant.name}</p>
                <p><strong>Requested Date & Time:</strong> ${new Date(booking.dateTime).toLocaleString()}</p>
                <p><strong>Party Size:</strong> ${booking.partySize} guests</p>
            </div>
            
            <p>You can try booking another time or contact the restaurant directly for more information.</p>
            
            <p><a href="${process.env.APP_BASE_URL || 'https://zerowait.onrender.com/'}/restaurants" style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Browse Restaurants</a></p>
            
            <p>Best regards,<br><strong>QuickSEAT Team</strong></p>
        `
    };
    
    return transporter.sendMail(mailOptions);
};

// Booking Cancelled (to Restaurant)
const sendBookingCancelledNotification = (restaurantEmail, booking, restaurant) => {
    const mailOptions = {
        from: '"QuickSEAT" <quickseatofficial@gmail.com>',
        to: restaurantEmail,
        subject: '🚫 Booking Cancelled - QuickSEAT',
        html: `
            <h2>Booking Cancelled</h2>
            <p>Hi <strong>${restaurant.name}</strong>,</p>
            <p>A customer has cancelled their booking.</p>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Customer:</strong> ${booking.customer.fullName}</p>
                <p><strong>Original Date & Time:</strong> ${new Date(booking.dateTime).toLocaleString()}</p>
                <p><strong>Party Size:</strong> ${booking.partySize} guests</p>
            </div>
            
            <p>Best regards,<br><strong>QuickSEAT Team</strong></p>
        `
    };
    
    return transporter.sendMail(mailOptions);
};

// ✅ New: Restaurant Creation Confirmation (to Restaurant Manager)
const sendRestaurantConfirmation = (restaurantEmail, restaurant) => {
    const hasGoogleMapsUrl = restaurant && restaurant.googleMapsUrl && restaurant.googleMapsUrl.trim() !== '';
    const mailOptions = {
        from: '"QuickSEAT" <quickseatofficial@gmail.com>',
        to: restaurantEmail,
        subject: `🎉 Welcome! Your Restaurant "${restaurant.name}" is Now Live on QuickSEAT`,
        html: `
            <h1>🎉 Restaurant Added Successfully!</h1>
            <p>Dear Manager,</p>
            <p>Your restaurant <strong>${restaurant.name}</strong> has been successfully added to QuickSEAT.</p>
            
            <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Restaurant Name:</strong> ${restaurant.name}</p>
                <p><strong>Address:</strong> ${restaurant.address}</p>
                <p><strong>Total Tables:</strong> ${restaurant.totalTables}</p>
                <p><strong>Max Party Size:</strong> ${restaurant.maxPartySize}</p>
                <p><strong>Restaurant ID (for login):</strong> ${restaurant.restaurantId}</p>
                <p><strong>Dashboard Password:</strong> (The one you set during registration)</p>
            </div>
            
            ${hasGoogleMapsUrl ? `
            <p>View your restaurant location on Google Maps:</p>
            <p><a href="${restaurant.googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">🗺️ Open Google Maps</a></p>
            ` : '<p>Google Maps URL not available at this time.</p>'}
            
            <p>Login to your dashboard: <a href="${process.env.APP_BASE_URL || 'http://localhost:8080'}/restaurant-login" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Login to Dashboard</a></p>
            
            <p>Best regards,<br><strong>QuickSEAT Team</strong></p>
        `
    };
    
    return transporter.sendMail(mailOptions);
};

// ========================
// PASSWORD RESET EMAILS ✅ NEW
// ========================

// Password Reset Email (with JWT token link)
const sendPasswordResetEmail = (userEmail, resetToken, userName) => {
    const resetLink = `${process.env.APP_BASE_URL || 'http://localhost:8080'}/auth/reset-password/${resetToken}`;
    
    const mailOptions = {
        from: '"QuickSEAT" <quickseatofficial@gmail.com>',
        to: userEmail,
        subject: '🔐 Reset Your Password - QuickSEAT',
        html: `
            <h2>Password Reset Request</h2>
            <p>Hi <strong>${userName}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to proceed:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background: #667eea; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                    🔐 Reset Password
                </a>
            </div>
            
            <p>Or copy this link in your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">
                <a href="${resetLink}">${resetLink}</a>
            </p>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <p style="margin: 0; color: #856404;"><strong>⏰ This link expires in 30 minutes</strong></p>
            </div>
            
            <p>If you didn't request this, please ignore this email or contact support.</p>
            
            <p>Best regards,<br><strong>QuickSEAT Team</strong></p>
        `
    };
    
    return transporter.sendMail(mailOptions);
};

// Password Reset Success Confirmation
const sendPasswordResetConfirmation = (userEmail, userName) => {
    const mailOptions = {
        from: '"QuickSEAT" <quickseatofficial@gmail.com>',
        to: userEmail,
        subject: '✅ Your Password Has Been Reset - QuickSEAT',
        html: `
            <h2>Password Reset Successful</h2>
            <p>Hi <strong>${userName}</strong>,</p>
            <p>Your password has been successfully reset! 🎉</p>
            
            <p>You can now log in with your new password:</p>
            <p><a href="${process.env.APP_BASE_URL || 'http://localhost:8080'}/login/user" style="background: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                🔓 Login Now
            </a></p>
            
            <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                <p style="margin: 0; color: #155724;"><strong>💡 Tip:</strong> Keep your password safe and don't share it with anyone.</p>
            </div>
            
            <p>Best regards,<br><strong>QuickSEAT Team</strong></p>
        `
    };
    
    return transporter.sendMail(mailOptions);
};

module.exports = {
    transporter,
    sendNewBookingNotification,
    sendBookingApprovedNotification,
    sendBookingDeclinedNotification,
    sendBookingCancelledNotification,
    sendRestaurantConfirmation,
    sendPasswordResetEmail,           // ✅ NEW
    sendPasswordResetConfirmation     // ✅ NEW
};