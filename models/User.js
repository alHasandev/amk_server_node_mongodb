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
    default: "https://amk.widian-store.com/images/profile/default.png",
  },
  profile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "profile",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("user", userSchema);
