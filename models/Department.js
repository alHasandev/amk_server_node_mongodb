const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  positions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "position",
    },
  ],
});

module.exports = mongoose.model("department", departmentSchema);
