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

// Getting all candidates
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

// Getting one
router.get("/:assessmentId", async (req, res) => {
  try {
    const assessment = await Assessment.findById(
      req.params.assessmentId
    ).populate({
      path: "employee",
    });

    return res.json(assessment);
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Getting PDF
router.get("/print", async (req, res) => {
  try {
    const candidates = await Candidate.find({ ...req.query }).populate({
      path: "user recruitment",
      select: "-password",
      populate: "profile",
    });

    const pdfName = ["candidates"];

    // let buildRecruitments = [];

    const docDef = {
      content: [
        pdfHeader("Laporan Daftar Calon Karyawan"),
        {
          style: "table",
          table: {
            widths: ["auto", "*", "auto", "auto", "auto", "auto"],
            body: [
              [
                { text: "No.", alignment: "center", style: "tableHeader" },
                {
                  text: "Nama Kandidat",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Posisi Dilamar",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Pendidikan Terakhir",
                  alignment: "center",
                  style: "tableHeader",
                },
                { text: "Status", alignment: "center", style: "tableHeader" },
                { text: "Tanggal", alignment: "center", style: "tableHeader" },
              ],
              ...candidates.map((candidate, index) => {
                let profile = candidate.user.profile;
                let education = { school: "" };
                if (profile && profile.educations.length > 0) {
                  education = profile.educations[profile.educations.length - 1];
                }
                return [
                  { text: index + 1, alignment: "center" },
                  { text: candidate.user.name, alignment: "left" },
                  {
                    text: candidate.recruitment.positionName,
                    alignment: "left",
                  },
                  { text: education.school, alignment: "left" },
                  {
                    text: candidate.status.toUpperCase(),
                    alignment: "center",
                  },
                  {
                    text: new Date(candidate.appliedAt)
                      .toISOString()
                      .split("T")[0],
                    alignment: "center",
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

// Creating new assessment
router.post("/", auth, async (req, res) => {
  const assessment = new Assessment({
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
