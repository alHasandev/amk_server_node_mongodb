const mongoose = require("mongoose");

const ObjectId = mongoose.Schema.Types.ObjectId;
const candidateSchema = new mongoose.Schema({
  user: {
    type: ObjectId,
    ref: "user",
  },
  recruitment: {
    type: ObjectId,
    ref: "recruitment",
  },
  status: String,
  appliedAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  comment: String,
});

module.exports = mongoose.model("candidate", candidateSchema);
