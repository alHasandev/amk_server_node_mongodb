const express = require("express");
const Profile = require("../models/Profile");
const auth = require("../middleware/auth");

const router = express.Router();

// Creating current user profile
router.post("/", auth, async (req, res) => {
  const profile = new Profile({
    bio: req.body.bio,
    gender: req.body.gender,
    birthPlace: req.body.birthPlace,
    birthDate: req.body.birthDate,
  });

  try {
    const newProfile = await profile.save();

    // save profile id to current user
    req.user.profile = newProfile._id;
    const updatedUser = await req.user.save();

    return res.status(201).json(updatedUser);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ err: err.message });
  }
});

// Updating current user profile

module.exports = router;
