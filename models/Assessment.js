const mongoose = require("mongoose");

const ObjectId = mongoose.Schema.Types.ObjectId;
const assessmentSchema = new mongoose.Schema({
  employee: {
    type: ObjectId,
    ref: "employee",
  },
  manner: {
    type: Number,
    default: 0,
  },
  expertness: {
    type: Number,
    default: 0,
  },
  diligence: {
    type: Number,
    default: 0,
  },
  tidiness: {
    type: Number,
    default: 0,
  },
  comment: {
    type: String,
  },
});

module.exports = mongoose.model("assessment", assessmentSchema);
