const express = require("express");
const Employee = require("../models/Employee");
const auth = require("../middleware/auth");
const User = require("../models/User");

const router = express.Router();

// Import for pdf make
const PdfPrinter = require("pdfmake");
const pdfStyles = require("../assets/pdf-make/styles");
const pdfHeader = require("../assets/pdf-make/header");
const fonts = require("../assets/pdf-make/fonts");

const printer = new PdfPrinter(fonts);
const fs = require("fs");
const Payload = require("../models/Payload");
const { IDR } = require("../utils/currency");
const Department = require("../models/Department");
const { time } = require("../utils/time");
const validationPart = require("../assets/pdf-make/validationPart");

// Getting all
router.get("/", async (req, res) => {
  try {
    // if (req.user.privilege !== "admin") return res.sendStatus(403);
    const { dateRange = {}, ...query } = req.query;

    const payloads = await Payload.find({ ...query }).populate({
      path: "employee",
      populate: {
        path: "user position",
        select: "-password",
      },
    });

    return res.json(payloads);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Getting all
router.get("/me", auth, async (req, res) => {
  try {
    // if (req.user.privilege !== "admin") return res.sendStatus(403);
    const { dateRange = "", ...query } = req.query;

    const employee = await Employee.findOne({ user: req.user._id });

    let payloads = await Payload.find({ employee: employee._id, ...query });

    if (dateRange) {
      payloads = payloads.filter((payload) => {
        let [start, end] = dateRange.split(":");
        start = new Date(start).getTime();
        end = new Date(end).getTime();
        let month = new Date(payload.month).getTime();
        return month >= start && month <= end;
      });
    }

    return res.json(payloads);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Get PDF
router.get("/print", async (req, res) => {
  try {
    const payloads = await Payload.find({ ...req.query }).populate({
      path: "employee",
      populate: {
        path: "user position",
        select: "-password",
      },
    });

    const monthString = req.query.month
      ? time.getMonth(req.query.month)
      : "Semua";
    let departmentString = "Semua";
    if (req.query.department) {
      const department = await Department.findById(req.query.department);
      departmentString = `[${department.code}] ${department.name}`;
    }

    // console.log(employees);

    const pdfName = ["payloads"];

    const docDef = {
      content: [
        pdfHeader("Laporan Peprhitungan Gaji Karyawan"),
        {
          style: "table",
          table: {
            widths: ["auto", "*"],
            body: [
              [
                {
                  text: "Bulan/Tahun",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: monthString,
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
                  text: departmentString,
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
            widths: [
              "auto",
              "auto",
              "*",
              "auto",
              "auto",
              "auto",
              "auto",
              "auto",
            ],
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
                  text: "Jabatan/Posisi",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Gaji Pokok",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Bonus",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Potongan",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Total Gaji",
                  style: "tableHeader",
                  alignment: "center",
                },
              ],
              ...payloads.map((payload, index) => {
                const employee = payload.employee;
                const salaryTotal =
                  payload.salary + payload.bonus - payload.reduction;
                // console.log(profile);
                return [
                  { text: index + 1, alignment: "center" },
                  { text: employee.user.nik, alignment: "center" },
                  { text: employee.user.name, alignment: "left" },
                  {
                    text: employee.position.code.toUpperCase(),
                    alignment: "center",
                  },
                  {
                    text: IDR(payload.salary),
                    alignment: "center",
                  },
                  { text: IDR(payload.bonus), alignment: "center" },
                  { text: IDR(payload.reduction), alignment: "center" },
                  { text: IDR(salaryTotal), alignment: "center" },
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

// Get PDF by id
router.get("/print/:payloadId", async (req, res) => {
  try {
    const payload = await Payload.findById(req.params.payloadId).populate({
      path: "employee",
      populate: {
        path: "user position department",
        select: "-password",
      },
    });

    const monthString = time.getMonth(payload.month);

    // console.log(employees);

    const pdfName = [
      "salary",
      payload.employee.user.nik,
      payload.employee.user.name,
      monthString,
    ];

    const docDef = {
      content: [
        pdfHeader("Slip Gaji Karyawan"),
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
                  text: monthString,
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
                  text: payload.employee.user.nik,
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
                  text: payload.employee.user.name,
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
                  text: payload.employee.position.name,
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
                  text: payload.employee.department.name,
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
            widths: [150, "*"],
            body: [
              [
                {
                  text: "Gaji Pokok",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: IDR(payload.salary),
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Bonus",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: IDR(payload.bonus),
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Potongan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: IDR(payload.reduction),
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Penerimaan Total Gaji",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: IDR(payload.salary + payload.bonus - payload.reduction),
                  style: "tableData",
                  alignment: "left",
                },
              ],
            ],
          },
        },
        validationPart({
          positionName: "Banjarmasin, " + time.getMonth(),
          username: "Bagian Keuangan",
          nik: "",
        }),
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

// Getting all
router.get("/me/print", async (req, res) => {
  try {
    // if (req.user.privilege !== "admin") return res.sendStatus(403);
    const { dateRange = "", ...query } = req.query;
    const employee = await Employee.findById(req.query.employee).populate({
      path: "user position",
      select: "-password",
    });

    let payloads = await Payload.find({ ...query });

    let [start, end] = dateRange.split(":");
    if (dateRange) {
      payloads = payloads.filter((payload) => {
        let timeStart = new Date(start).getTime();
        let timeEnd = new Date(end).getTime();
        let month = new Date(payload.month).getTime();
        return month >= timeStart && month <= timeEnd;
      });
    }
    console.log("start", start);
    console.log("end", end);

    const monthString = dateRange
      ? `${time.getMonth(start)} ~ ${time.getMonth(end)}`
      : "Semua";

    const pdfName = ["employee-salaries", employee._id, monthString];

    const docDef = {
      content: [
        pdfHeader("Laporan Slip Gaji Karyawan"),
        {
          style: "table",
          table: {
            widths: ["auto", "*"],
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
                  text: "Nama Karyawan",
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
                  text: `[${employee.position.code}] ${employee.position.name}`,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Bulan/Tahun",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: monthString,
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
            widths: ["auto", "auto", "*", "*", "*", "*"],
            body: [
              [
                { text: "No.", style: "tableHeader", alignment: "center" },
                {
                  text: "Bulan/Tahun",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Gaji Pokok",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Bonus",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Potongan",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Total Gaji",
                  style: "tableHeader",
                  alignment: "center",
                },
              ],
              ...payloads.map((payload, index) => {
                const salaryTotal =
                  payload.salary + payload.bonus - payload.reduction;
                // console.log(profile);
                return [
                  { text: index + 1, alignment: "center" },
                  { text: time.getMonth(payload.month), alignment: "center" },
                  {
                    text: IDR(payload.salary),
                    alignment: "center",
                  },
                  { text: IDR(payload.bonus), alignment: "center" },
                  { text: IDR(payload.reduction), alignment: "center" },
                  { text: IDR(salaryTotal), alignment: "center" },
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
    return res.status(500).json({ error: err.message });
  }
});

// Getting one
router.get("/:payloadId", auth, async (req, res) => {
  try {
    const payload = await Payload.findById(req.params.payloadId).populate({
      path: "employee",
      populate: {
        path: "position user",
        seelect: "-password",
      },
    });

    return res.json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Creating one
router.post("/", auth, async (req, res) => {
  console.log(req.body);
  const payload = new Payload({
    month: req.body.month,
    employee: req.body.employee,
    salary: req.body.salary,
    bonus: req.body.bonus,
    reduction: req.body.reduction,
  });

  try {
    // Set Department
    if (req.body.department) {
      payload.department = req.body.department;
    } else {
      const employee = await Employee.findById(req.body.employee);
      payload.department = employee.department;
    }

    // Save payload
    const newPayload = await payload.save();

    return res.status(201).json(newPayload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Updating one
router.patch("/:userId", auth, async (req, res) => {});

// Deleting one
router.delete("/:payloadId", auth, async (req, res) => {
  try {
    await Payload.findByIdAndDelete(req.params.payloadId);

    return res.json({ message: "Deleted employee!" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
