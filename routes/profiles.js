const express = require("express");
const Profile = require("../models/Profile");
const auth = require("../middleware/auth");

const router = express.Router();

// Getting current user profile
router.get("/me", auth, async (req, res) => {
  try {
    const profile = await Profile.findById(req.user.profile);

    if (!profile) return res.sendStatus(404);

    return res.json(profile);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

// Creating current user profile or update if exist
router.post("/", auth, async (req, res) => {
  const data = {
    bio: req.body.bio,
    gender: req.body.gender,
    birthPlace: req.body.birthPlace,
    birthDate: req.body.birthDate,
    skills: req.body.skills.split(",").map((skill) => skill.trim()),
  };

  try {
    // Check if profile is exist
    let profile = await Profile.findById(req.user.profile);
    if (profile) {
      if (data.bio) profile.bio = data.bio;
      if (data.gender) profile.gender = data.gender;
      if (data.birthPlace) profile.birthPlace = data.birthPlace;
      if (data.birthDate) profile.birthDate = data.birthDate;
      if (data.skills) profile.skills = data.skills;
    } else {
      profile = new Profile(data);
    }

    const updatedProfile = await profile.save();

    // save profile id to current user
    req.user.profile = updatedProfile._id;
    const updatedUser = await req.user.save();

    return res.status(201).json(updatedUser);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ err: err.message });
  }
});

// Push new education to profile
router.post("/educations", auth, async (req, res) => {
  const newEducation = {
    school: req.body.school,
    degree: req.body.degree,
    major: req.body.major,
    from: req.body.from,
    to: req.body.to,
    isCurrently: !!req.body.isCurrently,
    description: req.body.description,
  };

  try {
    const profile = await Profile.findById(req.user.profile);

    profile.educations.push(newEducation);

    const updatedProfile = await profile.save();
    return res.status(201).json(updatedProfile.educations);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Push new experience to profile
router.post("/experiences", auth, async (req, res) => {
  const newExperience = {
    company: req.body.company,
    field: req.body.field,
    job: req.body.job,
    from: req.body.from,
    to: req.body.to,
    isCurrently: !!req.body.isCurrently,
    description: req.body.description,
  };

  try {
    const profile = await Profile.findById(req.user.profile);

    profile.experiences.push(newExperience);

    const updatedProfile = await profile.save();
    return res.status(201).json(updatedProfile.experiences);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Change existing educations of profile
router.put("/educations/:educationId", auth, async (req, res) => {
  const newEducation = {
    school: req.body.school,
    degree: req.body.degree,
    major: req.body.major,
    from: req.body.from,
    to: req.body.to,
    isCurrently: !!req.body.isCurrently,
    description: req.body.description,
  };

  try {
    const profile = await Profile.findById(req.user.profile);

    profile.educations = profile.educations.map((education) => {
      if (education._id.toString() === req.params.educationId)
        return newEducation;
      return education;
    });
    // profile.educations.id(req.params.educationId).set(newEducation);

    // console.log(profile.educations);

    const updatedProfile = await profile.save();
    return res.json(updatedProfile.educations);
    // return res.sendStatus(500);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Change existing experience of profile
router.put("/experiences/:experienceId", auth, async (req, res) => {
  const newExperience = {
    company: req.body.company,
    field: req.body.field,
    job: req.body.job,
    from: req.body.from,
    to: req.body.to,
    isCurrently: !!req.body.isCurrently,
    description: req.body.description,
  };

  try {
    const profile = await Profile.findById(req.user.profile);

    profile.experiences = profile.experiences.map((experience) => {
      if (experience._id.toString() === req.params.experienceId.toString())
        return newExperience;
      return experience;
    });

    const updatedProfile = await profile.save();
    return res.status(201).json(updatedProfile.experiences);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Removing current user profile education
router.delete("/educations/:educationId", auth, async (req, res) => {
  try {
    const profile = await Profile.findById(req.user.profile);

    // Find educations array item that match the given education id and remove it
    // profile.educations = profile.educations.filter(
    //   (education) =>
    //     education._id.toString() !== req.params.educationId.toString()
    // );

    profile.educations.id(req.params.educationId).remove();

    console.log(req.params.educationId);
    console.log(profile.educations);

    const updatedProfile = await profile.save();
    return res.json(updatedProfile.educations);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Removing current user profile education
router.delete("/experiences/:experienceId", auth, async (req, res) => {
  try {
    const profile = await Profile.findById(req.user.profile);

    profile.experiences.id(req.params.experienceId).remove();

    console.log(req.params.experienceId);
    console.log(profile.experiences);

    const updatedProfile = await profile.save();
    return res.json(updatedProfile.experiences);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
