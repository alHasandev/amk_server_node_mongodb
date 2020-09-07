const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "employee",
  },
  date: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
  dayLeave: {
    type: Number,
  },
  description: {
    type: String,
  },
});

module.exports = mongoose.model("attendance", attendanceSchema);
