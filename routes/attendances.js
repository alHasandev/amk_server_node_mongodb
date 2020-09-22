const express = require("express");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const auth = require("../middleware/auth");
const Employee = require("../models/Employee");
const bcrypt = require("bcrypt");

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
const {
  time,
  normalDate,
  reverseNormalDate,
  getDatePosition,
} = require("../utils/time");
const validationPart = require("../assets/pdf-make/validationPart");
const forceAbsence = require("../utils/schedule");

// Static
const attendanceStatus = {
  leave: "IZIN/CUTI",
  present: "HADIR",
  absence: "TIDAK HADIR",
};

// Getting all attendances of all user
router.get("/", auth, async (req, res) => {
  const { dateRange, month, ...query } = req.query;

  if (dateRange) {
    let [start, end] = req.query.dateRange.split(":");

    query.date = { $gte: start, $lte: end };
  }

  if (month) {
    const [year, nMonth] = month.split("-");
    const start = `${month}-01`;
    const end = `${year}-${Number(nMonth) + 1}-01`;

    query.date = { $gte: start, $lt: end };
  }

  // console.log(start, end);
  try {
    const attendances = await Attendance.find({
      ...query,
    })
      .populate({
        path: "employee",
        populate: {
          path: "user",
          select: "-password",
        },
      })
      .sort({ date: -1 });

    // console.log(attendances);
    return res.json(attendances);
  } catch (err) {
    console.error(err);
    return res.sendStatus(404);
  }
});

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

// Getting one attendance by attendance id
router.get("/one/:attendanceId", auth, async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.attendanceId);

    return res.json(attendance);
  } catch (err) {
    console.error(err);
    return res.sendStatus(404);
  }
});

// Force status attendance to absence for employee
router.get("/absence", async (req, res) => {
  try {
    const attendances = await forceAbsence(normalDate(new Date()));

    // write to log file
    fs.appendFile(
      "schedule.log",
      `Force ${
        attendances.length
      } employee to absence status at ${new Date()}!!\n`,
      (err) => {
        if (err) throw err;
      }
    );

    return res.status(201).json(attendances);
  } catch (err) {
    console.error();
  }
});

// Getting qr text
router.get("/qrcode", async (req, res) => {
  const password = "fasjfjalsflaksjflkasjfeafesafa";
  // const time = "" + new Date().getMinutes() + new Date().getSeconds();
  // Get current timestamp
  const time = new Date().getTime();
  console.log("generate qrcode time", time);

  try {
    const encryptedPassword = await bcrypt.hash(password, 10);

    return res.json({ text: encryptedPassword, time: Number(time) });
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Verify qr code
router.post("/qrcode", auth, async (req, res) => {
  const password = "fasjfjalsflaksjflkasjfeafesafa";

  try {
    console.log("body", req.body);
    const isMatch = await bcrypt.compare(password, req.body.text);

    if (!isMatch)
      return res.status(500).json({
        error: "QR Code tidak sesuai !!",
      });

    // const time = "" + new Date().getMinutes() + new Date().getSeconds();
    const time = new Date().getTime();
    console.log("time now", time);
    console.log("time qrcode", req.body.time);
    console.log("different:", Number(time) - Number(req.body.time));

    if (Number(time) - Number(req.body.time) > 30000)
      return res.status(500).json({
        error: "QR Code sudah kadaluarsa, tolong lakukan scan qr code kembali",
      });

    // Set attendance to present
    const employee = await Employee.findOne({ user: req.user._id });

    // Check apakah sudah melakukan scan kehadiran

    let attendance = await Attendance.findOne({
      employee: employee._id,
      date: normalDate(new Date()),
    });

    if (attendance)
      return res.status(403).json({
        error: "Anda sudah melakukan absensi, " + attendance.description,
      });

    attendance = new Attendance({
      employee: employee._id,
      date: normalDate(new Date()),
      status: "present",
      description: "Absensi dengan QR Code",
    });

    const newAttendance = await attendance.save();

    return res.status(201).json(newAttendance);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Getting attendance monthly format
router.get("/monthly", auth, async (req, res) => {
  const { monthRange, ...query } = req.query;

  if (monthRange) {
    let [start, end] = req.query.monthRange.split(":");

    start = `${start}-01`;
    let [endYear, endMonth] = end.split("-");
    end = `${endYear}-${Number(endMonth) + 1}-01`;

    query.date = { $gte: start, $lt: end };
  }

  // console.log(start, end);
  try {
    const attendances = await Attendance.find({
      ...query,
    })
      .populate({
        path: "employee",
        populate: {
          path: "user",
          select: "-password",
        },
      })
      .sort({ date: 1, employee: 1 });

    const group = {};

    attendances.map((attendance) => {
      const { date, employee, status } = attendance;
      const key =
        time.yearMonth(date, 1) + "-" + (employee && employee._id) || "404";

      if (!group[key]) {
        group[key] = {
          month: time.yearMonth(date, 1),
          employee: employee,
          present: 0,
          leave: 0,
          absence: 0,
        };
      }

      group[key][attendance.status] += 1;
    });

    const monthlyAttendances = Object.keys(group).map((key) => ({
      _id: key,
      ...group[key],
    }));
    return res.json(monthlyAttendances);
  } catch (err) {
    console.error(err);
    return res.sendStatus(404);
  }
});

// Creating new attendance for current user
router.get("/calendar/:attendanceGroupId", auth, async (req, res) => {
  const [year, month, employeeId] = req.params.attendanceGroupId.split("-");

  try {
    const attendances = await Attendance.aggregate([
      {
        $project: {
          date: {
            $dateToString: {
              date: "$date",
              format: "%Y-%m-%d",
            },
          },
          day: {
            $dateToString: {
              date: "$date",
              format: "%d",
            },
          },
          month: {
            $dateToString: {
              date: "$date",
              format: "%Y-%m",
            },
          },
          employee: { $toString: "$employee" },
          status: 1,
          description: 1,
        },
      },
      {
        $match: {
          month: `${year}-${month}`,
          employee: employeeId,
        },
      },
      {
        $sort: {
          date: 1,
        },
      },
    ]);

    const employee = await Employee.findById(employeeId).populate({
      path: "user",
      select: "-password",
    });

    const calendar = {};
    const total = {
      present: 0,
      leave: 0,
      absence: 0,
    };

    attendances.map(({ day, status }) => {
      total[status] += 1;
      calendar[day] = status;
    });

    return res.json({ month: `${year}-${month}`, employee, total, calendar });
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

router.get("/print", async (req, res) => {
  try {
    const { dateRange, ...query } = req.query;

    const filter = {
      date: "Semua",
      employee: "Semua",
      status: "Semua",
    };

    if (dateRange) {
      let [start, end] = req.query.dateRange.split(":");

      query.date = { $gte: start, $lte: end };
      filter.date = `${start} sampai ${end}`;
    }

    if (query.status) {
      switch (query.status) {
        case "present":
          filter.status = "HADIR";
          break;
        case "leave":
          filter.status = "IZIN/CUTI";
          break;
        case "absence":
          filter.status = "TIDAK HADIR";
          break;

        default:
          break;
      }
    }

    if (query.employee) {
      const employee = await Employee.findById(query.employee).populate({
        path: "user position",
        select: "-password",
      });

      const user = employee.user || {};
      const position = employee.position || {};

      filter.employee = `[${position.code}] ${user.name}`;
    }

    const attendances = await Attendance.find({
      ...query,
    })
      .populate({
        path: "employee",
        populate: {
          path: "user",
          select: "-password",
        },
      })
      .sort({ date: 1 });

    const pdfName = ["attendances"];

    // let buildRecruitments = [];

    const docDef = {
      content: [
        pdfHeader("Laporan Kehadiran Karyawan Harian"),
        {
          style: "table",
          table: {
            widths: [120, "*"],
            body: [
              [
                {
                  text: "Tanggal Cetak",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: time.getDateString(),
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
            widths: [120, "*"],
            body: [
              [
                {
                  text: "FILTER",
                  style: "tableHeader",
                  alignment: "left",
                  colSpan: 2,
                },
                {},
              ],
              [
                {
                  text: "Tanggal",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: filter.date,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Karyawan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: filter.employee,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Status",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: filter.status,
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
            widths: ["auto", "auto", "auto", "auto", "auto", "*"],
            body: [
              [
                { text: "No.", alignment: "center", style: "tableHeader" },
                {
                  text: "Tanggal",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "NIK",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Nama Karyawan",
                  alignment: "left",
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
                const employee = attendance.employee || {};
                const user = employee.user || {};
                return [
                  { text: index + 1, alignment: "center" },
                  {
                    text: reverseNormalDate(attendance.date),
                    alignment: "center",
                    style: "tableData",
                  },
                  {
                    text: user.nik,
                    alignment: "center",
                    style: "tableData",
                  },
                  {
                    text: user.name,
                    alignment: "left",
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
    return res.sendStatus(500);
  }
});

router.get("/print/monthly", async (req, res) => {
  try {
    const { monthRange, ...query } = req.query;

    const filter = {
      month: "Semua",
      employee: "Semua",
    };

    if (monthRange) {
      let [start, end] = req.query.monthRange.split(":");

      start = `${start}-01`;
      let [endYear, endMonth] = end.split("-");
      end = `${endYear}-${Number(endMonth) + 1}-01`;

      query.date = { $gte: start, $lt: end };

      filter.month = `${time.getMonth(start)} - ${time.getMonth(end)}`;
    }

    if (query.employee) {
      const employee = await Employee.findById(query.employee).populate({
        path: "user position",
        select: "-password",
      });

      const user = employee.user || {};
      const position = employee.position || {};

      filter.employee = `[${position.code}] ${user.name}`;
    }

    const attendances = await Attendance.find({
      ...query,
    })
      .populate({
        path: "employee",
        populate: {
          path: "user",
          select: "-password",
        },
      })
      .sort({ date: 1 });

    const group = {};

    attendances.map((attendance) => {
      const { date, employee, status } = attendance;
      const key =
        time.yearMonth(date, 1) + "-" + (employee && employee._id) || "404";

      if (!employee) return;

      if (!group[key]) {
        group[key] = {
          month: time.yearMonth(date, 1),
          employee: employee,
          present: 0,
          leave: 0,
          absence: 0,
        };
      }

      group[key][attendance.status] += 1;
    });

    const monthlyAttendances = Object.keys(group).map((key) => ({
      _id: key,
      ...group[key],
    }));

    const pdfName = ["attendances"];

    // let buildRecruitments = [];

    const docDef = {
      content: [
        pdfHeader("Laporan Bulanan Kehadiran Karyawan"),
        {
          style: "table",
          table: {
            widths: [120, "*"],
            body: [
              [
                {
                  text: "Tanggal Cetak",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: time.getDateString(),
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
            widths: [120, "*"],
            body: [
              [
                {
                  text: "FILTER",
                  style: "tableHeader",
                  alignment: "left",
                  colSpan: 2,
                },
                {},
              ],
              [
                {
                  text: "Bulan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: filter.month,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Karyawan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: filter.employee,
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
            widths: ["auto", "auto", "auto", "*", "auto", "auto", "auto"],
            body: [
              [
                { text: "No.", alignment: "center", style: "tableHeader" },
                {
                  text: "Bulan",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "NIK",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Nama Karyawan",
                  alignment: "left",
                  style: "tableHeader",
                },
                {
                  text: "Hadir",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Izin/Cuti",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Tidak Hadir",
                  alignment: "center",
                  style: "tableHeader",
                },
              ],
              ...monthlyAttendances.map((attendance, index) => {
                const employee = attendance.employee || {};
                const user = employee.user || {};
                return [
                  { text: index + 1, alignment: "center" },
                  {
                    text: time.getMonth(attendance.date),
                    alignment: "center",
                    style: "tableData",
                  },
                  {
                    text: user.nik,
                    alignment: "center",
                    style: "tableData",
                  },
                  {
                    text: user.name,
                    alignment: "left",
                    style: "tableData",
                  },
                  {
                    text: attendance.present,
                    alignment: "center",
                    style: "tableData",
                  },
                  {
                    text: attendance.leave,
                    alignment: "center",
                    style: "tableData",
                  },
                  {
                    text: attendance.absence,
                    alignment: "center",
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
    return res.sendStatus(500);
  }
});

// Printing pdf employee attendances group by month
router.get("/print/monthly/:groupId", async (req, res) => {
  try {
    const [year, month, employeeId] = req.params.groupId.split("-");

    const start = `${year}-${month}-01`;
    const end = `${year}-${Number(month) + 1}-01`;

    const match = {};
    match.date = { $gte: start, $lt: end };
    match.employee = employeeId;

    const employee = await Employee.findById(employeeId).populate({
      path: "user position",
      select: "-password",
    });

    const user = employee.user || {};
    const position = employee.position || {};

    const attendances = await Attendance.find(match);

    const total = {
      present: 0,
      leave: 0,
      absence: 0,
    };

    attendances.map((attendance) => (total[attendance.status] += 1));

    const pdfName = ["attendances"];

    // let buildRecruitments = [];

    const docDef = {
      content: [
        pdfHeader("Laporan Detail Kehadiran (Bulanan)"),
        {
          style: "table",
          table: {
            widths: [120, "*"],
            body: [
              [
                {
                  text: "Tanggal Cetak",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: time.getDateString(),
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
            widths: [120, "*"],
            body: [
              [
                {
                  text: "DATA",
                  style: "tableHeader",
                  alignment: "left",
                  colSpan: 2,
                },
                {},
              ],
              [
                {
                  text: "Bulan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: time.getMonth([year, month]),
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Karyawan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: `[${user.nik}] ${user.name}`,
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
            widths: ["*", "*", "*"],
            body: [
              [
                {
                  text: "Keterangan Status",
                  style: "tableHeader",
                  alignment: "left",
                  colSpan: 3,
                },
                {},
                {},
              ],
              [
                {
                  text: "HADIR",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "IZIN/CUTI",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "TIDAK HADIR",
                  style: "tableHeader",
                  alignment: "center",
                },
              ],
              [
                {
                  text: total["present"],
                  style: "tableData",
                  alignment: "center",
                },
                {
                  text: total["leave"],
                  style: "tableData",
                  alignment: "center",
                },
                {
                  text: total["absence"],
                  style: "tableData",
                  alignment: "center",
                },
              ],
            ],
          },
        },
        {
          style: "table",
          table: {
            widths: ["auto", 150, "auto", 100, "*"],
            body: [
              [
                { text: "No.", alignment: "center", style: "tableHeader" },
                {
                  text: "Hari",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Tgl",
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
                const day = time.date(attendance.date);
                return [
                  { text: index + 1, alignment: "center" },
                  {
                    text: time.getDayName(attendance.date).toUpperCase(),
                    alignment: "center",
                    style: "tableData",
                  },
                  {
                    text: day,
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
    return res.sendStatus(500);
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
            widths: [120, "*"],
            body: [
              [
                {
                  text: "Tanggal Cetak",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: time.getDateString(),
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
            widths: [120, "*"],
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
            widths: [120, 10, "*"],
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
    const { month, ...query } = req.query;

    const filter = {
      month: "Semua",
      status: "Semua",
    };

    if (query.status) {
      filter.status = query.status.toUpperCase();
    }

    if (month) {
      const lastDate = getDatePosition(month, 0, 1).getDate();
      const start = `${month}-01`;
      const end = `${month}-${lastDate}`;

      filter.month = time.getMonth(month);
      query.date = { $gte: start, $lte: end };
    }

    const attendances = await Attendance.find({
      employee: req.params.employeeId,
      ...query,
    }).sort({ date: 1 });

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
            widths: [120, "*"],
            body: [
              [
                {
                  text: "Tanggal Cetak",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: time.getDateString(),
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
            widths: [120, "*"],
            body: [
              [
                {
                  text: "FILTER",
                  style: "tableHeader",
                  alignment: "left",
                  colSpan: 2,
                },
                {},
              ],
              [
                {
                  text: "Bulan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: filter.month,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Status",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: filter.status,
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
            widths: [120, "*"],
            body: [
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
router.patch("/:attendanceId", async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.attendanceId);

    if (req.body.employee) attendance.employee = req.body.employee;
    if (req.body.date) attendance.date = req.body.date;
    if (req.body.status) attendance.status = req.body.status;
    if (req.body.dayLeave) attendance.dayLeave = req.body.dayLeave;
    if (req.body.description) attendance.description = req.body.description;

    // save update
    const updatedAttendance = await attendance.save();

    return res.json(updatedAttendance);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

// Deleting existing attendance
router.delete("/:attendanceId", async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.attendanceId);

    await attendance.remove();

    return res.json({ message: "Attendance Deleted !" });
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

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
