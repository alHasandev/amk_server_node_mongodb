const express = require("express");
const Position = require("../models/Position");
const Department = require("../models/Department");

const router = express.Router();

// Getting all
router.get("/", async (req, res) => {
  try {
    const positions = await Position.find();

    return res.json(positions);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Getting one
router.get("/:id", getPosition, async (req, res) => {
  return res.json(res.position);
});

// Creating one + Push new position to department's position list
router.post("/", getDepartment, async (req, res) => {
  const position = new Position({
    department: res.department._id,
    code: req.body.code,
    name: req.body.name,
    salary: req.body.salary,
  });

  try {
    // Save new position
    const newPosition = await position.save();

    // Push new position to department's position list
    res.department.positions.push(newPosition._id);
    await res.department.save();

    return res.status(201).json(newPosition);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Updating one
router.patch("/:id", getPosition, async (req, res) => {
  if (req.body.code) res.position.code = req.body.code;
  if (req.body.name) res.position.name = req.body.name;
  if (req.body.salary) res.position.salary = req.body.salary;

  try {
    const updatedPosition = await res.position.save();

    return res.json(updatedPosition);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Deleting one
router.delete("/:id", getPosition, async (req, res) => {
  try {
    await res.position.remove();

    return res.json({ message: "Deleted position" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Function: get position by request params id
async function getPosition(req, res, next) {
  try {
    const position = await Position.findById(req.params.id);
    if (!position)
      return res.status(404).json({ error: "Position not found!" });

    res.position = position;
    next();
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: "Not valid position id" });
  }
}

// Function: get department by request body department
async function getDepartment(req, res, next) {
  try {
    const department = await Department.findById(req.body.department);
    if (!department)
      return res.status(404).json({ error: "Deparment not found!" });

    res.department = department;
    next();
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: "Invalid department id" });
  }
}

module.exports = router;
