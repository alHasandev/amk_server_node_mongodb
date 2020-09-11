const express = require("express");

const auth = require("../middleware/auth");
const Recruitment = require("../models/Recruitment");
const User = require("../models/User");
const Candidate = require("../models/Candidate");
const Profile = require("../models/Profile");

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
    const { dateRange, ...query } = req.query;

    if (dateRange) {
      let [start, end] = req.query.dateRange.split(":");

      query.appliedAt = { $gte: start, $lte: end };
    }

    const candidates = await Candidate.find({ ...query }).populate({
      path: "user recruitment",
      select: "-password",
      populate: "profile position department",
    });
    return res.json(candidates);
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

// Getting current user candidate
router.get("/me", auth, async (req, res) => {
  try {
    const candidate = await Candidate.findOne({ user: req.user._id }).populate({
      path: "recruitment",
      populate: "position department",
    });

    return res.json(candidate);
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Getting candidate by id
router.get("/:candidateId", async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.candidateId).populate(
      {
        path: "user recruitment",
        select: "-password",
        populate: "profile position department",
      }
    );

    return res.json(candidate);
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Register current user to recruitment
router.post("/", auth, async (req, res) => {
  const candidate = new Candidate({
    user: req.user._id,
    recruitment: req.body.recruitment,
    status: "pending",
  });

  try {
    // Add new candidate
    if (req.user.privilege !== "user") {
      if (req.user.privilege === "candidate") {
        const candidate = await Candidate.findOne({
          user: req.user._id,
          recruitment: req.body.recruitment,
        });
        if (candidate)
          return res
            .status(403)
            .json({ message: "Anda sudah terdaftar pada lowongan ini !!" });
      } else {
        return res
          .status(403)
          .json({ message: "Anda sudah menjadi karyawan !!" });
      }
    }

    const newCandidate = await candidate.save();

    // Update recruitment candidate status
    const recruitment = await Recruitment.findById(req.body.recruitment);
    const user = await User.findById(req.user._id);
    recruitment.pending = recruitment.pending + 1;
    user.privilege = "candidate";
    await recruitment.save();
    await user.save();

    return res.status(201).json(newCandidate);
  } catch (error) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Updating candidate
router.patch("/:candidateId", async (req, res) => {
  try {
    // Update candidate status
    const candidate = await Candidate.findById(req.params.candidateId);
    const prevStatus = candidate.status;
    if (req.body.status) candidate.status = req.body.status;
    if (req.body.comment) candidate.comment = req.body.comment;

    if (req.body.status === "rejected") {
      const user = await User.findById(candidate.user);
      user.isActive = false;
    }

    const updatedCandidate = await candidate.save();

    // Update recruitment candidate status
    const recruitment = await Recruitment.findById(candidate.recruitment);
    // kurangi status sebelumnya + tambah status yg baru
    recruitment[prevStatus] = recruitment[prevStatus] - 1;
    recruitment[req.body.status] = recruitment[req.body.status] + 1;
    await recruitment.save();

    return res.json(updatedCandidate);
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Deleting candidate
router.delete("/:candidateId", async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.candidateId);
    await candidate.remove();
    return res.json({ message: "Candidate is deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Middleware: get candidate by user id
async function getCandidate(req, res, next) {
  try {
    const recruitment = await Recruitment.findOne({
      "candidates.user": req.user._id.toString(),
    });

    res.candidate = recruitment.candidates.find(
      (candidate) => candidate.user.toString() === req.user._id.toString()
    );
    next();
  } catch (err) {
    console.error(err);
    return res.sendStatus(404);
  }
}

module.exports = router;
