const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Import models
const User = require("../models/User");

// Import middleware
const auth = require("../middleware/auth");

const router = express.Router();

// Get authenticated user
router.get("/", auth, async (req, res) => {
  return res.json(req.user);
});

// Authenticate user
router.post("/", getUserByEmail, async (req, res) => {
  try {
    const isMatch = await bcrypt.compare(req.body.password, res.user.password);

    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const payload = {
      _id: res.user.id,
      email: res.user.email,
      privilege: res.user.privilege,
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET_TOKEN, {
      expiresIn: "40m",
    });

    return res.json({ accessToken: accessToken });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Cannot check credentials, please try again later" });
  }
});

// Function: get user by email
async function getUserByEmail(req, res, next) {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    res.user = user;
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: "Invalid credentials" });
  }
}

module.exports = router;
