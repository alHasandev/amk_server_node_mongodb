const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  nik: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  privilege: {
    type: String,
    default: "user",
  },
  image: {
    type: String,
    default: "default.png",
  },
  profile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "profile",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("user", userSchema);
