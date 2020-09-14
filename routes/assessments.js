const express = require("express");

const auth = require("../middleware/auth");
const Recruitment = require("../models/Recruitment");
const User = require("../models/User");
const Candidate = require("../models/Candidate");
const Profile = require("../models/Profile");
const Assessment = require("../models/Assessment");

const router = express.Router();

// Import for pdfmake
const PdfPrinter = require("pdfmake");
const pdfFonts = require("../assets/pdf-make/fonts");
const pdfHeader = require("../assets/pdf-make/header");
const pdfStyles = require("../assets/pdf-make/styles");

const fonts = pdfFonts;

const printer = new PdfPrinter(fonts);
const fs = require("fs");
const Employee = require("../models/Employee");
const { time } = require("../utils/time");
const validationPart = require("../assets/pdf-make/validationPart");

// Getting all assessments
router.get("/", async (req, res) => {
  try {
    const assessments = await Assessment.find({ ...req.query }).populate({
      path: "employee",
      populate: {
        path: "user",
        select: "-password",
      },
    });
    return res.json(assessments);
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Getting all candidates
router.get("/me", auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id });
    const assessments = await Assessment.find({
      employee: employee._id,
      ...req.query,
    });

    return res.json(assessments);
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Getting PDF
router.get("/print", async (req, res) => {
  try {
    const filter = {
      user: {
        nik: "ALL",
        name: "Semua",
      },
      month: "Semua",
    };

    if (req.query.month) filter.month = req.query.month;
    if (req.query.employee) {
      const employee = await Employee.findById(req.query.employee).populate({
        path: "user",
        select: "-password",
      });

      if (req.query.month) filter.month = time.getMonth(req.query.month);

      if (employee.user) {
        filter.user = employee.user;
      } else {
        filter.user = {
          nik: "ERR",
          name: "Tidak Ditemukan",
        };
      }
    }

    const assessments = await Assessment.find({ ...req.query }).populate({
      path: "employee",
      populate: {
        path: "user",
        select: "-password",
      },
    });

    const pdfName = ["assessments"];

    // let buildRecruitments = [];

    const docDef = {
      pageOrientation: "landscape",
      content: [
        pdfHeader("Laporan Daftar Penilaian Karyawan"),
        {
          style: "table",
          table: {
            widths: [150, "*"],
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
            widths: [150, "*"],
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
                  text: `[${filter.user.nik}] ${filter.user.name}`,
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
                  text: "Sikap",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Keahlian",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Kerajinan",
                  alignment: "center",
                  style: "tableHeader",
                },
                { text: "Kerapian", alignment: "center", style: "tableHeader" },
                { text: "Komentar", alignment: "left", style: "tableHeader" },
              ],
              ...assessments.map((assessment, index) => {
                const employee = assessment.employee;
                const user = employee.user;

                return [
                  { text: index + 1, style: "tableData", alignment: "center" },
                  {
                    text: time.getMonth(assessment.month),
                    style: "tableData",
                    alignment: "center",
                  },
                  { text: user.nik, style: "tableData", alignment: "center" },
                  { text: user.name, style: "tableData", alignment: "left" },
                  {
                    text: assessment.manner,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: assessment.expertness,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: assessment.diligence,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: assessment.tidiness,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: assessment.comment,
                    style: "tableData",
                    alignment: "left",
                  },
                ];
              }),
            ],
          },
        },
        validationPart({
          positionName: "Banjarmasin, " + time.getMonth(),
          username: "Admin",
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

// Printing by assessment id
router.get("/print/:assessmentId", async (req, res) => {
  try {
    const assessment = await Assessment.findById(
      req.params.assessmentId
    ).populate({
      path: "employee",
      populate: {
        path: "user department position",
        select: "-password",
      },
    });

    const employee = assessment.employee;
    const department = employee.department ? employee.department : {};
    const position = employee.position ? employee.position : {};

    const pdfName = ["assessment-detail", req.params.assessmentId];

    // let buildRecruitments = [];

    const docDef = {
      pageOrientation: "portrait",
      content: [
        pdfHeader("Detail Penilaian Karyawan"),
        {
          style: "table",
          table: {
            widths: [150, "*"],
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
            widths: [150, "*"],
            body: [
              [
                {
                  text: "Bulan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: time.getMonth(assessment.month),
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
                  text: `[${position.code}] ${position.name}`,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Departemen",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: `[${department.code}] ${department.name}`,
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
            widths: [150, "*", "*", "*", "*"],
            body: [
              [
                {
                  text: "NILAI",
                  style: "tableHeader",
                  alignment: "left",
                  rowSpan: 2,
                },
                {
                  text: "Sikap",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Keahlian",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Kerajinan",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Kerapian",
                  style: "tableHeader",
                  alignment: "center",
                },
              ],
              [
                {},
                {
                  text: assessment.manner,
                  style: "tableData",
                  alignment: "center",
                },
                {
                  text: assessment.expertness,
                  style: "tableData",
                  alignment: "center",
                },
                {
                  text: assessment.diligence,
                  style: "tableData",
                  alignment: "center",
                },
                {
                  text: assessment.tidiness,
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
            widths: ["*"],
            body: [
              [
                {
                  text: "Komentar",
                  style: "tableHeader",
                  alignment: "left",
                },
              ],
              [
                {
                  text: assessment.comment,
                  style: "tableData",
                  alignment: "left",
                },
              ],
            ],
          },
        },
        validationPart({
          positionName: "Banjarmasin, " + time.getMonth(),
          username: "Admin",
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

// Getting one
router.get("/:assessmentId", async (req, res) => {
  try {
    let populate = {};
    if (req.query.populate) {
      populate = JSON.parse(req.query.populate);
    }

    const assessment = await Assessment.findById(
      req.params.assessmentId
    ).populate({
      path: "employee",
      ...populate,
    });

    return res.json(assessment);
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Creating new assessment
router.post("/", auth, async (req, res) => {
  const assessment = new Assessment({
    month: req.body.month,
    employee: req.body.employee,
    manner: req.body.manner,
    expertness: req.body.expertness,
    diligence: req.body.diligence,
    tidiness: req.body.tidiness,
    comment: req.body.comment,
  });

  try {
    const newAssessment = await assessment.save();

    return res.status(201).json(newAssessment);
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Updating one
router.patch("/:assessmentId", async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.assessmentId);
    if (req.body.month) assessment.month = req.body.month;
    if (req.body.employee) assessment.employee = req.body.employee;
    if (req.body.manner) assessment.manner = req.body.manner;
    if (req.body.expertness) assessment.expertness = req.body.expertness;
    if (req.body.diligence) assessment.diligence = req.body.diligence;
    if (req.body.tidiness) assessment.tidiness = req.body.tidiness;
    if (req.body.comment) assessment.comment = req.body.comment;

    const updatedAssessment = await assessment.save();

    return res.json(updatedAssessment);
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Deleting one
router.delete("/:assessmentId", async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.assessmentId);
    await assessment.remove();

    return res.json({ message: "Penilian terhapus!" });
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

module.exports = router;
