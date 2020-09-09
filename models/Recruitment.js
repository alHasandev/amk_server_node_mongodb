const mongoose = require("mongoose");

const ObjectId = mongoose.Schema.Types.ObjectId;

const recruitmentSchema = new mongoose.Schema({
  candidates: [
    {
      user: {
        type: ObjectId,
        ref: "user",
      },
      status: {
        type: String,
      },
    },
  ],
  title: {
    type: String,
  },
  position: {
    type: ObjectId,
    ref: "position",
  },
  positionName: {
    type: String,
    required: true,
  },
  department: {
    type: ObjectId,
    ref: "department",
  },
  departmentName: {
    type: String,
  },
  numberRequired: {
    type: Number,
    default: 1,
  },
  pending: {
    type: Number,
    default: 0,
  },
  accepted: {
    type: Number,
    default: 0,
  },
  rejected: {
    type: Number,
    default: 0,
  },
  hired: {
    type: Number,
    default: 0,
  },
  requirements: [String],
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
  isActive: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("recruitment", recruitmentSchema);
