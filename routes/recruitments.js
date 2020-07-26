const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();
const auth = require("../middleware/auth");
const Recruitment = require("../models/Recruitment");
const User = require("../models/User");

// Getting all
router.get("/", async (req, res) => {
  try {
    console.log(req.query);
    const recruitments = await Recruitment.find({ ...req.query });

    return res.json(recruitments);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Getting one
router.get("/:id", getRecruitment, async (req, res) => {
  return res.json(res.recruitment);
});

// Getting candidates
router.get("/:id/candidates", getRecruitment, async (req, res) => {
  try {
    const candidates = await User.find({
      _id: {
        $in: res.recruitment.candidates,
      },
    })
      .populate("profile")
      .select(["name", "image", "email", "bio", "gender", "birthDate"]);

    return res.json(candidates);
  } catch (err) {
    console.error(err);
    return res.status(404).json({ error: err.message });
  }
});

// Creating one
router.post("/", async (req, res) => {
  console.log(req.body);
  const recruitment = new Recruitment({
    title: req.body.title,
    positionName: req.body.positionName,
    numberRequired: req.body.numberRequired,
    description: req.body.description,
    expiredAt: req.body.expiredAt,
  });

  try {
    const newRecruitment = await recruitment.save();
    return res.status(201).json(newRecruitment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Updating one
router.patch("/:id", getRecruitment, async (req, res) => {
  res.recruitment.updatedAt = new Date();
  if (req.body.title) res.recruitment.title = req.body.title;
  if (req.body.positionName)
    res.recruitment.positionName = req.body.positionName;
  if (req.body.departmentName)
    res.recruitment.departmentName = req.body.departmentName;
  if (req.body.numberRequired)
    res.recruitment.numberRequired = req.body.numberRequired;
  if (req.body.description) res.recruitment.description = req.body.description;
  if (req.body.status) res.recruitment.status = req.body.status;

  try {
    const updatedRecruitment = await res.recruitment.save();

    return res.json(updatedRecruitment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Deleting one
router.delete("/:id", getRecruitment, async (req, res) => {
  try {
    await res.recruitment.remove();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Push new candidate
router.post("/:id/candidate", auth, getRecruitment, async (req, res) => {
  res.recruitment.updatedAt = new Date();

  if (req.user.privilege === "admin")
    return res.status(400).json({ message: "Anda adalah admin!" });

  // Check if user already applied
  const candidate = res.recruitment.candidates.find(
    (candidate) => candidate.toString() === req.user._id.toString()
  );
  if (candidate)
    return res.status(400).json("User already applied to this recruitment!");

  res.recruitment.candidates.push(req.user._id);

  try {
    const updatedRecruitment = await res.recruitment.save();

    return res.status(201).json(updatedRecruitment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Push hired candidate
router.post("/:id/hire", getRecruitment, getUser, async (req, res) => {
  res.recruitment.updatedAt = new Date();

  // Check if user already applied
  const hired = res.recruitment.hired.find(
    (hired) => hired.toString() === res.user._id.toString()
  );
  if (hired) return res.status(400).json("User already hired!");

  res.recruitment.hired.push(res.user._id);

  try {
    const updatedRecruitment = await res.recruitment.save();

    return res.status(201).json(updatedRecruitment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

async function getRecruitment(req, res, next) {
  try {
    const recruitment = await Recruitment.findById(req.params.id);
    if (!recruitment) {
      return res.status(404).json("Recruitment not found!");
    }

    res.recruitment = recruitment;
    next();
  } catch (err) {
    console.error(err);
    return res.status(400).json("Not valid recruitment id");
  }
}

async function getUser(req, res, next) {
  try {
    const user = await User.findById(req.body.user);
    if (!user) {
      return res.status(404).json("User not found!");
    }

    res.user = user;
    next();
  } catch (err) {
    console.error(err);
    return res.status(400).json("Not valid user id");
  }
}

module.exports = router;
