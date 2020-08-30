const express = require("express");
const Employee = require("../models/Employee");
const auth = require("../middleware/auth");
const User = require("../models/User");

const router = express.Router();

// Import for pdf make
const path = require("path");
const PdfPrinter = require("pdfmake");
const appPath = path.dirname(__dirname);
const pdfStyles = require("../assets/pdf-make/styles");
const fonts = {
  Roboto: {
    normal: appPath + "/fonts/Roboto/Roboto-Regular.ttf",
    bold: appPath + "/fonts/Roboto/Roboto-Medium.ttf",
    italics: appPath + "/fonts/Roboto/Roboto-Italic.ttf",
    bolditalics: appPath + "/fonts/Roboto/Roboto-MediumItalic.ttf",
  },
};

const printer = new PdfPrinter(fonts);
const fs = require("fs");

// Getting all
router.get("/", async (req, res) => {
  try {
    // if (req.user.privilege !== "admin") return res.sendStatus(403);

    const employees = await Employee.find().populate({
      path: "user position department",
      select: ["name", "nik", "email", "level"],
      populate: "profile",
    });

    return res.json(employees);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Get PDF
router.get("/print", async (req, res) => {
  try {
    const employees = await Employee.find({ ...req.query }).populate({
      path: "user position",
      select: "-password",
      populate: "profile",
    });

    // console.log(employees);

    const pdfName = ["employees"];

    const docDef = {
      content: [
        {
          text: "Laporan Daftar Karyawan",
          style: "title",
          alignment: "center",
        },
        {
          style: "table",
          table: {
            widths: ["auto", "auto", "*", "auto", "auto", "auto"],
            body: [
              [
                { text: "No.", style: "tableHeader", alignment: "center" },
                { text: "NIK", style: "tableHeader", alignment: "center" },
                {
                  text: "Nama Karyawan",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Umur",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Tanggal Lahir",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Posisi/Jabatan",
                  style: "tableHeader",
                  alignment: "center",
                },
              ],
              ...employees.map((employee, index) => {
                let profile = employee.user.profile;
                let birthDate = new Date(profile.birthDate)
                  .toISOString()
                  .split("T")[0];
                let age = calculateAge(birthDate);

                // console.log(profile);
                return [
                  { text: index + 1, alignment: "center" },
                  { text: employee.user.nik, alignment: "center" },
                  employee.user.name,
                  {
                    text: age,
                    alignment: "center",
                  },
                  {
                    text: birthDate,
                    alignment: "center",
                  },
                  { text: employee.position.name, alignment: "center" },
                ];
              }),
            ],
          },
        },
      ],
      styles: pdfStyles,
    };

    console.log(docDef);
    const pdfDoc = printer.createPdfKitDocument(docDef);

    let temp;
    const folder = "reports/";
    const pdfpath = folder + pdfName.join("_") + ".pdf";
    pdfDoc.pipe((temp = fs.createWriteStream(pdfpath)));
    pdfDoc.end();

    temp.on("finish", async () => {
      // const file = fs.createReadStream(
      //   pdfpath
      // );
      const file = fs.readFileSync(pdfpath);
      const stat = fs.statSync(pdfpath);
      res.setHeader("Content-Length", stat.size);
      res.setHeader("Content-Type", "application/pdf");
      // res.setHeader("Content-Disposition", "attachment; filename=quote.pdf");
      res.send(file);
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Getting one
router.get("/:userId", auth, async (req, res) => {
  try {
    if (req.user.privilege === "admin" || req.user._id === req.params.userId) {
      const employee = await Employee.findById(req.params.userId).populate(
        "user",
        "-password"
      );

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
  console.log(req.body);
  const employee = new Employee({
    user: req.body.user,
    position: req.body.position,
    department: req.body.department,
    joinDate: new Date(),
  });

  try {
    if (req.user.privilege !== "admin") return res.sendStatus(403);
    const newEmployee = await employee.save();

    // Change user privilege to employee
    const user = await User.findById(req.body.user);
    user.privilege = "employee";
    await user.save();

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

// Function: calculage age from given birth date
function calculateAge(birthday) {
  // birthday is a date
  birthday = new Date(birthday);
  var ageDifMs = Date.now() - birthday.getTime();
  var ageDate = new Date(ageDifMs); // miliseconds from epoch
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

module.exports = router;
