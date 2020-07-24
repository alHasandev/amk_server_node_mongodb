require("dotenv").config();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Function: authenticate jwt token
module.exports = async function auth(req, res, next) {
  const token = req.headers["authorization"];
  console.log(token);

  if (!token)
    return res.status(401).json({ msg: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_TOKEN);
    req.user = await User.findOne({ email: decoded.email });
    next();
  } catch (err) {
    console.error(err);
    return res.status(403).json({ msg: "Invalid token" });
  }
};
