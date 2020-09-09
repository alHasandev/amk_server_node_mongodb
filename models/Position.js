const mongoose = require("mongoose");

const positionSchema = new mongoose.Schema({
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "department",
  },
  code: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  level: {
    type: String,
    default: "staff",
  },
  salary: {
    type: Number,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("position", positionSchema);
