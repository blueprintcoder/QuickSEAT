# QuickSEAT - Restaurant Table Booking System

A full-stack web application for managing restaurant table bookings with real-time updates, drag-and-drop floor planning, and integrated authentication.

## 🎯 Project Overview

QuickSEAT is a restaurant management system that enables restaurants to efficiently manage table bookings, visualize floor plans, and track real-time booking status through an intuitive dashboard. The system features modern authentication with Google OAuth2 and optional password protection, ensuring secure access to booking management features.

## ✨ Key Features

### Authentication & Security
- **Google OAuth2 Integration** - Seamless login with Google accounts via Passport.js
- **Optional Password Setup** - Modal-based optional password creation on first login that persists until user sets a password
- **Session Management** - Secure session handling with environment-based configuration

### Restaurant Dashboard
- **Drag-and-Drop Floor Plan** - Interactive visual representation of restaurant tables
- **Table Management** - Create, edit, and delete tables with real-time status updates
- **Live Booking Status** - Visual indicators for table availability and booking details
- **Click-to-View Details** - Quick access to booking information by clicking on tables
- **Calendar View** - Date-based booking management and scheduling

### Real-Time Updates
- **WebSocket Integration** - Instant updates across all connected clients
- **Live Booking Synchronization** - Bookings appear immediately without page reloads
- **Real-Time Notifications** - Email notifications for booking confirmations and updates

### User Experience
- **Responsive UI** - Attractive and functional interface for desktop and mobile
- **EJS Templating** - Dynamic server-side rendering for responsive pages
- **Intuitive Navigation** - Clean dashboard layout for efficient booking management

## 🛠️ Technology Stack

### Backend
- **Node.js** - JavaScript runtime environment
- **Express.js** - Web application framework
- **Passport.js** - Authentication middleware with Google OAuth2 strategy
- **MongoDB** - NoSQL database for data persistence
- **WebSockets** - Real-time bidirectional communication
- **Nodemailer** - Email notification service

### Frontend
- **EJS** - Embedded JavaScript templating engine
- **HTML5 & CSS3** - Markup and styling
- **JavaScript (Client-side)** - Interactive features and real-time updates
- **Drag-and-Drop API** - Table positioning and management

### Development & Deployment
- **Git** - Version control
- **dotenv** - Environment variable management
- **npm** - Package management

## 📋 Project Structure

```
quickseat/
├── config/
│   └── database.js          # MongoDB connection configuration
├── routes/
│   ├── auth.js              # Authentication routes (Google OAuth)
│   ├── bookings.js          # Booking management routes
│   └── dashboard.js         # Dashboard routes
├── views/
│   ├── login.ejs            # Login/signup page
│   ├── dashboard.ejs        # Main dashboard
│   ├── floor-plan.ejs       # Floor plan visualization
│   └── calendar.ejs         # Calendar booking view
├── models/
│   ├── User.js              # User schema
│   ├── Table.js             # Table schema
│   └── Booking.js           # Booking schema
├── public/
│   ├── css/                 # Stylesheets
│   └── js/                  # Client-side scripts
├── app.js                   # Express application setup
├── server.js                # Server entry point
├── .env                     # Environment variables (not in git)
└── package.json             # Project dependencies
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance like MongoDB Atlas)
- Google OAuth2 credentials (from Google Cloud Console)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/blueprintcoder/QuickSEAT.git
   cd quickseat
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```
   PORT=3000
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/quickseat
   SESSION_SECRET=your-session-secret-key
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-specific-password
   NODE_ENV=development
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## 🔐 Authentication Flow

1. User visits the login page
2. Clicks "Login with Google"
3. Redirected to Google OAuth consent screen
4. After authentication, user is redirected to dashboard
5. On first login, optional password setup modal appears
6. Modal persists until user sets a password or dismisses it
7. User gains access to dashboard features

## 📊 Database Schema

### User Model
- User ID (Google ID)
- Email
- Name
- Profile Picture
- Password (optional)
- Created At

### Table Model
- Table ID
- Restaurant ID
- Table Number
- Capacity
- Position (X, Y coordinates for floor plan)
- Status (Available/Booked)
- Created At
- Updated At

### Booking Model
- Booking ID
- User ID
- Table ID
- Booking Date
- Time Slot
- Number of Guests
- Status (Confirmed/Cancelled)
- Email Notification Sent
- Created At
- Updated At

## 🔄 Real-Time Updates Implementation

The system uses WebSockets for real-time synchronization:

```javascript
// Client connects to WebSocket
const socket = io();

// Listen for booking updates
socket.on('bookingUpdated', (booking) => {
  updateTableStatus(booking);
});

// Emit new booking
socket.emit('newBooking', bookingData);
```

## 📧 Email Notifications

Users receive email notifications for:
- Booking confirmation
- Booking cancellation
- Booking reminders (if implemented)
- Status updates

## 📱 Responsive Design

The application is optimized for:
- Desktop browsers (1920px and above)
- Tablets (768px - 1024px)
- Mobile devices (320px - 767px)

## 🐛 Known Issues & Future Enhancements

### Current Phase
- Core booking functionality
- Basic floor plan visualization
- Real-time updates with WebSockets

### Planned Features
- Admin panel for restaurant configuration
- Analytics and reporting dashboard
- Multiple restaurant support
- Payment integration
- SMS notifications
- Waitlist management
- Advanced search and filtering

## 🤝 Contributing

This is an independent educational project. For contributions or suggestions:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the MIT License.

## 👨‍💻 Author

**Your Name** - BTech Computer Science (AI) student at IIIT Naya Raipur

## 🙏 Acknowledgments

- Passport.js for authentication strategy
- Socket.io for real-time communication
- MongoDB for database solutions
- Express.js for web framework
- Google OAuth2 for authentication service

## 📞 Contact & Support

For questions or support regarding this project, please reach out through:
- GitHub Issues
- Email

---

**Project Status**: Active Development (5th Semester)

Last Updated: November 29, 2025
