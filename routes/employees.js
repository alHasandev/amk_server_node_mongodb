const express = require("express");
const Employee = require("../models/Employee");
const auth = require("../middleware/auth");

const router = express.Router();

// Getting all
router.get("/", auth, async (req, res) => {
  try {
    if (req.user.privilege !== "admin") return res.sendStatus(403);

    const employees = await Employee.find().populate("user", ["name", "image"]);

    return res.json(employees);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Getting one
router.get("/:userId", auth, async (req, res) => {
  try {
    if (req.user.privilege === "admin" || req.user._id === req.params.userId) {
      const employee = await Employee.findOne({
        user: req.params.userId,
      }).populate("user", "-password");

      return res.json(employee);
    }

    return res.sendStatus(403);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Creating one
router.post("/", auth, async (req, res) => {
  const employee = new Employee({
    user: req.body.user,
    position: req.body.position,
    department: req.body.department,
    joinDate: new Date(),
  });

  try {
    if (req.user.privilege !== "admin") return res.sendStatus(403);
    const newEmployee = await employee.save();

    return res.status(201).json(newEmployee);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Updating one
router.patch("/:userId", auth, getEmployeeByUserId, async (req, res) => {
  if (req.body.position) res.employee.position = req.body.position;
  if (req.body.department) res.employee.department = req.body.department;

  try {
    if (req.user.privilege !== "admin") return res.sendStatus(403);

    const updatedEmployee = await res.employee.save();
    return res.json(updatedEmployee);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Deleting one
router.delete("/:userId", auth, getEmployeeByUserId, async (req, res) => {
  try {
    await Employee.remove();

    return res.json({ message: "Deleted employee!" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Function: get employee by user id
async function getEmployeeByUserId(req, res, next) {
  try {
    const employee = await Employee.findOne({ user: req.params.userId });

    res.employee = employee;
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = router;
