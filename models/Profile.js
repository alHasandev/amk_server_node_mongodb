const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  bio: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    required: true,
  },
  birthPlace: {
    type: String,
    required: true,
  },
  birthDate: {
    type: Date,
    required: true,
  },
  contact: String,
  address: String,
  skills: [String],
  experiences: [
    {
      company: String,
      field: String,
      job: String,
      from: Date,
      to: Date,
      isCurrent: Boolean,
      description: String,
    },
  ],
  educations: [
    {
      school: String,
      degree: String,
      major: String,
      from: Date,
      to: Date,
      isCurrent: Boolean,
      description: String,
    },
  ],
});

module.exports = mongoose.model("profile", profileSchema);
