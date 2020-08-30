const express = require("express");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const auth = require("../middleware/auth");
const Employee = require("../models/Employee");

const router = express.Router();

// Import for pdfmake
const PdfPrinter = require("pdfmake");
const pdfFonts = require("../assets/pdf-make/fonts");
const pdfHeader = require("../assets/pdf-make/header");
const pdfStyles = require("../assets/pdf-make/styles");

const fonts = pdfFonts;

const printer = new PdfPrinter(fonts);
const fs = require("fs");

// Import utilities
const { time, reverseNormalDate } = require("../utils/time");

// Static
const attendanceStatus = {
  leave: "IZIN/CUTI",
  present: "HADIR",
  absence: "TIDAK HADIR",
};

// Getting current user attendances
router.get("/me", auth, getEmployee, async (req, res) => {
  try {
    const attendances = await Attendance.find({ employee: req.employee._id });
    return res.json(attendances);
  } catch (err) {
    console.error(err);
    return res.sendStatus(404);
  }
});

// Getting all attendances of all user
router.get("/", auth, async (req, res) => {
  try {
    const attendances = await Attendance.find();
    return res.json(attendances);
  } catch (err) {
    console.error(err);
    return res.sendStatus(404);
  }
});

// Getting PDF by employee id
router.get("/print/:employeeId", async (req, res) => {
  try {
    const attendances = await Attendance.find({
      employee: req.params.employeeId,
      ...req.query,
    });

    const employee = await Employee.findById(req.params.employeeId).populate({
      path: "user",
      select: "-password",
    });

    const pdfName = [
      "attendances",
      `employee-${employee.user.nik}-${employee.user.name}`,
    ];

    // let buildRecruitments = [];

    const docDef = {
      content: [
        pdfHeader("Laporan Daftar Kehadiran " + employee.user.name),
        {
          style: "table",
          table: {
            widths: ["auto", "auto", "auto", "auto", "*"],
            body: [
              [
                { text: "No.", alignment: "center", style: "tableHeader" },
                {
                  text: "Tanggal",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Hari",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Status",
                  alignment: "center",
                  style: "tableHeader",
                },
                { text: "Keterangan", alignment: "left", style: "tableHeader" },
              ],
              ...attendances.map((attendance, index) => {
                return [
                  { text: index + 1, alignment: "center" },
                  {
                    text: reverseNormalDate(attendance.date),
                    alignment: "center",
                    style: "tableData",
                  },
                  {
                    text: time.getDayName(attendance.date),
                    alignment: "center",
                    style: "tableData",
                  },
                  {
                    text: attendanceStatus[attendance.status],
                    alignment: "center",
                    style: "tableData",
                  },
                  {
                    text: attendance.description,
                    alignment: "left",
                    style: "tableData",
                  },
                ];
              }),
            ],
          },
        },
      ],
      styles: pdfStyles,
    };

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

// Getting all attendances of selected employee
router.get("/:employeeId", auth, async (req, res) => {
  try {
    const attendances = await Attendance.find({
      employee: req.params.employeeId,
    });
    return res.json(attendances);
  } catch (err) {
    console.error(err);
    return res.sendStatus(404);
  }
});

// Getting attendances of user with date range
// Creating new attendance for current user
router.post("/me", auth, getEmployee, async (req, res) => {
  const attendance = new Attendance({
    employee: req.employee._id,
    date: req.body.date,
    status: req.body.status,
    dayLeave: req.body.dayLeave,
    description: req.body.description ? req.body.description : "",
  });

  try {
    const newAttendance = await attendance.save();

    return res.status(201).json(newAttendance);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

// Creating new attendance for user
router.post("/", auth, async (req, res) => {
  let attendance = new Attendance({
    employee: req.body.employee,
    date: req.body.date,
    status: req.body.status,
    dayLeave: req.body.dayLeave,
    description: req.body.description,
  });

  try {
    const newAttendance = await attendance.save();

    if (req.body.status === "leave" && req.body.dayLeave > 1) {
      const promise = [];
      for (let i = 1; i < req.body.dayLeave; i++) {
        let date = new Date(req.body.date);
        date.setDate(date.getDate() + i);
        console.log(date);
        attendance = new Attendance({
          employee: req.body.employee,
          status: req.body.status,
          date: date,
          dayLeave: req.body.dayLeave,
          description: req.body.description,
        });
        promise.push(attendance.save());
      }
      Promise.all(promise);
    }

    return res.status(201).json(newAttendance);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

// Updating existing attendance of user

// Middleware: get user by params user id
async function getEmployee(req, res, next) {
  try {
    let query;
    if (req.user._id) {
      query = { user: req.user._id };
    }

    if (req.params.employeeId) {
      query = { _id: req.params.employeeId };
    }

    const employee = await Employee.findOne(query);
    res.employee = employee;
    next();
  } catch (err) {
    console.error(err);
    return res.sendStatus(404);
  }
}

module.exports = router;
