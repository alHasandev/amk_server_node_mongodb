const mongoose = require("mongoose");

const ObjectId = mongoose.Schema.Types.ObjectId;

const employeeSchema = new mongoose.Schema({
  user: {
    type: ObjectId,
    ref: "user",
  },
  position: {
    type: ObjectId,
    ref: "position",
  },
  department: {
    type: ObjectId,
    ref: "department",
  },
  joinDate: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("employee", employeeSchema);
