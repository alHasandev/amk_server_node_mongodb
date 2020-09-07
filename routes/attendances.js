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
const { time, normalDate, reverseNormalDate } = require("../utils/time");
const validationPart = require("../assets/pdf-make/validationPart");
const forceAbsence = require("../utils/schedule");

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

// Force attendance to absence
router.get("/absence", async (req, res) => {
  try {
    const attendances = await forceAbsence(new Date());

    return res.status(201).json(attendances);
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Getting all attendances of all user
router.get("/", auth, async (req, res) => {
  const { month, ...query } = req.query;

  let start = "";
  let end = "";
  if (month) {
    [start, end] = month.split(":");
    if (!end) {
      let [year, monthNum] = month.split("-");
      start = normalDate(month);
      end = normalDate(new Date(year, Number(monthNum), 0));
      // console.log(year, monthNum, new Date(year, monthNum + 1, 0));
    }
  } else {
    start = normalDate(new Date());
    end = normalDate(
      new Date(new Date().getFullYear, new Date().getMonth() + 1, 0)
    );
  }
  console.log(start, end);
  try {
    const attendances = await Attendance.find({
      date: {
        $gte: start,
        $lte: end,
      },
      ...query,
    });
    console.log(attendances);
    return res.json(attendances);
  } catch (err) {
    console.error(err);
    return res.sendStatus(404);
  }
});

// Getting PDF Calendar Form
router.get("/print/calendar", async (req, res) => {
  try {
    const employee = await Employee.findById(req.query.employee).populate({
      path: "user position department",
      select: "-password",
    });

    const daynames = [
      "senin",
      "selasa",
      "rabu",
      "kamis",
      "jum'at",
      "sabtu",
      "minggu",
    ];

    const calendar = [];

    const date = new Date(req.query.month);
    const year = date.getFullYear();
    const month = date.getMonth();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const firstWeekDay = date.getDay();
    const lastWeekDay = new Date(year, month, lastDate).getDay();

    const weekCount = Math.ceil((lastDate + firstWeekDay) / 7);

    const attendances = await Attendance.find({
      date: {
        $gte: `${req.query.month}-01`,
        $lte: `${req.query.month}-${lastDate}`,
      },
      employee: req.query.employee,
    });
    console.log(attendances);
    // HItungan Kehadiran
    const absence = attendances.filter(
      (attendance) => attendance.status === "absence"
    );
    const leave = attendances.filter(
      (attendance) => attendance.status === "leave"
    );
    const present = attendances.filter(
      (attendance) => attendance.status === "present"
    );

    const fillColors = {
      leave: "#d69e2e",
      absence: "#f56565",
      present: "#48bb78",
    };

    const prevDate = [];
    for (let i = 0; i < firstWeekDay; i++) {
      prevDate.push({
        text: "",
        style: "tableData",
        alignment: "center",
        fillColor: "#EEEEEE",
      });
    }

    let dateNum = 1;
    for (let j = 1; j <= weekCount; j++) {
      const weekDate = [];
      let lastDateWeek = 7 * j - firstWeekDay;
      for (let i = dateNum; i <= lastDateWeek; i++) {
        let dt = i < 10 ? `0${i}` : i;
        let currAttd = attendances.find(
          (attendance) =>
            normalDate(attendance.date) === `${req.query.month}-${dt}`
        );
        console.log(currAttd);
        if (i > lastDate) {
          weekDate.push({
            text: "",
            style: "tableData",
            alignment: "center",
            fillColor: "#EEEEEE",
          });
        } else {
          weekDate.push({
            text: i,
            style: "tableData",
            alignment: "center",
            fillColor: currAttd ? fillColors[currAttd.status] : "#FFFFFF",
          });
        }
      }
      calendar.push(weekDate);
      dateNum = lastDateWeek + 1;
    }
    calendar[0].unshift(...prevDate);

    const pdfName = ["attendances-calendar"];

    // let buildRecruitments = [];

    const docDef = {
      content: [
        pdfHeader("Laporan Kalender Kehadiran"),
        {
          style: "table",
          table: {
            widths: [150, "*"],
            body: [
              [
                {
                  text: "Bulan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: time.getMonth("2020-9"),
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "NIK",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: employee.user.nik,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Nama",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: employee.user.name,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Jabatan/Posisi",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: employee.position.name,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Department",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: employee.department.name,
                  style: "tableData",
                  alignment: "left",
                },
              ],
            ],
          },
        },
        {
          style: "table",
          table: {
            widths: [150, 10, "*"],
            body: [
              [
                {
                  text: "Hadir",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  alignment: "center",
                  table: {
                    widths: ["*"],
                    body: [
                      [
                        {
                          text: "",
                          margin: [0, 6, 0, 6],
                          fillColor: fillColors["present"],
                        },
                      ],
                    ],
                  },
                  layout: {
                    defaultBorder: false,
                  },
                },
                {
                  text: present.length,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Izin/Cuti",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  alignment: "center",
                  table: {
                    widths: ["*"],
                    body: [
                      [
                        {
                          text: "",
                          margin: [0, 6, 0, 6],
                          fillColor: fillColors["leave"],
                        },
                      ],
                    ],
                  },
                  layout: {
                    defaultBorder: false,
                  },
                },
                {
                  text: leave.length,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Tidak Hadir",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  alignment: "center",
                  table: {
                    widths: ["*"],
                    body: [
                      [
                        {
                          text: "",
                          margin: [0, 6, 0, 6],
                          fillColor: fillColors["absence"],
                        },
                      ],
                    ],
                  },
                  layout: {
                    defaultBorder: false,
                  },
                },
                {
                  text: absence.length,
                  style: "tableData",
                  alignment: "left",
                },
              ],
            ],
          },
        },
        {
          style: "table",
          table: {
            widths: ["*", "*", "*", "*", "*", "*", "*"],
            body: [
              [
                { text: "Minggu", alignment: "center", style: "tableHeader" },
                {
                  text: "Senin",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Selasa",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Rabu",
                  alignment: "center",
                  style: "tableHeader",
                },
                { text: "Kamis", alignment: "center", style: "tableHeader" },
                { text: "Jum'at", alignment: "center", style: "tableHeader" },
                { text: "Sabtu", alignment: "center", style: "tableHeader" },
              ],
              ...calendar,
            ],
          },
        },
        validationPart({
          positionName: "Banjarmasin, " + time.getMonth(),
          username: "Human Resources Manajer",
          nik: "",
        }),
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
    return err;
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
      path: "user position department",
      select: "-password",
    });

    const pdfName = [
      "attendances",
      `employee-${employee.user.nik}-${employee.user.name}`,
    ];

    // let buildRecruitments = [];

    const docDef = {
      content: [
        pdfHeader("Laporan Kehadiran Karyawan"),
        {
          style: "table",
          table: {
            widths: [150, "*"],
            body: [
              [
                {
                  text: "Bulan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: time.getMonth("2020-9"),
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "NIK",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: employee.user.nik,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Nama",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: employee.user.name,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Jabatan/Posisi",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: employee.position.name,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Department",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: employee.department.name,
                  style: "tableData",
                  alignment: "left",
                },
              ],
            ],
          },
        },
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
        validationPart({
          positionName: "Banjarmasin, " + time.getMonth(),
          username: "Human Resorces Manajer",
          nik: "",
        }),
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
