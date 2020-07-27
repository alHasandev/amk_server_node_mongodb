require("dotenv").config();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Function: authenticate jwt token
module.exports = async function auth(req, res, next) {
  const token = req.headers["authorization"];
  // console.log(token);

  if (!token)
    return res.status(401).json({ message: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_TOKEN);
    req.user = await User.findById(decoded._id).select("-password");
    if (!req.user) res.status(403).json({ message: "Invalid token" });
    next();
  } catch (err) {
    console.error(err);
    return res.status(403).json({ message: "Invalid token" });
  }
};
