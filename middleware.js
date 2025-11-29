// middleware.js
module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    if (req.originalUrl.startsWith("/api")) {
      return res.status(403).json({ success: false, message: "Login required" });
    }
    req.session.error = "You must be logged in!";
    return res.redirect("/login");
  }
  next();
};
