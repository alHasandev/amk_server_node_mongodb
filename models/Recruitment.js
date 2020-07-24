const mongoose = require("mongoose");

const recruitmentSchema = new mongoose.Schema({
  candidates: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
  ],
  title: {
    type: String,
  },
  positionName: {
    type: String,
    required: true,
  },
  departmentName: {
    type: String,
    required: true,
  },
  numberRequired: {
    type: Number,
    default: 1,
  },
  hired: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
  ],
  description: {
    type: String,
  },
  status: {
    type: String,
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  expiredAt: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model("recruitment", recruitmentSchema);
