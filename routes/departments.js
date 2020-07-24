const express = require("express");
const Department = require("../models/Department");
const Position = require("../models/Position");

const router = express.Router();

// Getting all
router.get("/", async (req, res) => {
  try {
    const departments = await Department.find();

    return res.json(departments);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Gettting one
router.get("/:id", getDepartment, async (req, res) => {
  return res.json(res.department);
});

// Getting position on that department
router.get("/:id/positions", async (req, res) => {
  try {
    const positions = await Position.find({ department: req.params.id });

    return res.json(positions);
  } catch (err) {
    console.error(err);
    return res.status(404).json({ error: "Position not found!" });
  }
});

// Creating one
router.post("/", async (req, res) => {
  const department = new Department({
    code: req.body.code,
    name: req.body.name,
  });

  try {
    const newDepartment = await department.save();

    return res.status(201).json(newDepartment);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
});

// Updating one
router.patch("/:id", getDepartment, async (req, res) => {
  if (req.body.code) res.department.code = req.body.code;
  if (req.body.name) res.department.name = req.body.name;

  try {
    const updatedDepartment = await res.department.save();

    return res.json(updatedDepartment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Deleting one
router.delete("/:id", getDepartment, async (req, res) => {
  try {
    await res.department.remove();

    return res.json({ message: "Deleted department!" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Push new position
router.post("/:id/position", getDepartment, async (req, res) => {
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
    const updatedDepartment = await res.department.save();

    return res.status(201).json(updatedDepartment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Function: get department by request id
async function getDepartment(req, res, next) {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json("Department not found!");

    res.department = department;
    next();
  } catch (err) {
    console.error(err);
    return res.status(400).json("Not valid department id");
  }
}

module.exports = router;
