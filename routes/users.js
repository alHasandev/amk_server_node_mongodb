const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");
const Profile = require("../models/Profile");

// Getting all
router.get("/", async (req, res) => {
  try {
    const users = await User.find().select("-password");

    return res.json(users);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Getting current user
router.get("/me", auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ _id: req.user.profile });
    req.user.profile = profile;
    // console.log(profile);
    return res.json(req.user);
  } catch (err) {}
});

// Getting one
router.get("/:id", getUser, (req, res) => {
  return res.json(res.user);
});

// Creating one
router.post("/", isUniqueUser(true), async (req, res) => {
  const user = new User({
    nik: req.body.nik,
    name: req.body.name,
    email: req.body.email,
  });

  try {
    // Bcrypt setup
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // Push hashed password to user
    user.password = hashedPassword;

    const newUser = await user.save();
    return res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
});

// Updating one
router.patch("/:id", getUser, async (req, res) => {
  if (req.body.nik) res.user.nik = req.body.nik;
  if (req.body.name) res.user.name = req.body.name;
  if (req.body.email) res.user.email = req.body.email;
  if (req.body.privilege) res.user.privilege = req.body.privilege;
  if (req.body.password) {
    // Bcrypt setup
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // Push hashed password to user
    res.user.password = hashedPassword;
  }

  // set updated at date
  res.user.updatedAt = new Date();

  try {
    const updatedUser = await res.user.save();
    return res.json(updatedUser);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
});

router.delete("/reset", async (req, res) => {
  try {
    await User.deleteMany({});

    return res.status(205).json({ message: "User data is reseted!" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Deleting One
router.delete("/:id", getUser, async (req, res) => {
  try {
    await res.user.remove();
    res.json({ message: "Deleted user" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Function: get user by id
async function getUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (user == null) {
      return res.status(404).json({ message: "User not found!" });
    }

    res.user = user;
    next();
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: "Not valid user id!" });
  }
}

// Function: check if nik and email is exist
function isUniqueUser(bool = true) {
  return async (req, res, next) => {
    try {
      const users = await User.find({
        $or: [{ nik: req.body.nik }, { email: req.body.email }],
      });
      if (users.length > 0 === bool) {
        return res
          .status(400)
          .json({ message: bool ? "Not unique user!" : "Is unique user" });
      }
      next();
    } catch (err) {
      console.error(err);
      return res
        .status(400)
        .json({ message: "Please specify valid Email or NIK number!" });
    }
  };
}

module.exports = router;
