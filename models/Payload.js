const mongoose = require("mongoose");

const ObjectId = mongoose.Schema.Types.ObjectId;
const payloadSchema = new mongoose.Schema({
  month: String,
  employee: {
    type: ObjectId,
    ref: "employee",
  },
  department: {
    type: ObjectId,
    ref: "department",
  },
  salary: Number,
  bonus: Number,
  reduction: Number,
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("payload", payloadSchema);
