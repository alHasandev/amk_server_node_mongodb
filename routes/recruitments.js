const express = require("express");

const router = express.Router();
const auth = require("../middleware/auth");
const Recruitment = require("../models/Recruitment");
const Department = require("../models/Department");
const Position = require("../models/Position");
const User = require("../models/User");

// Import for pdfmake
const PdfPrinter = require("pdfmake");
const pdfFonts = require("../assets/pdf-make/fonts");
const pdfHeader = require("../assets/pdf-make/header");
const pdfStyles = require("../assets/pdf-make/styles");

const fonts = pdfFonts;

const printer = new PdfPrinter(fonts);
const fs = require("fs");

// Getting all
router.get("/", async (req, res) => {
  try {
    console.log(req.query);
    const recruitments = await Recruitment.find({ ...req.query });

    return res.json(recruitments);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Get PDF
router.get("/print", async (req, res) => {
  try {
    let { date, ...query } = req.query;
    let queryDate = {};

    if (date) {
      let date1 = req.query.date.split(":")[0];
      let date2 = req.query.date.split(":")[1];
      date1 = new Date(date1).toISOString().split("T")[0];
      date2 = new Date(date2).toISOString().split("T")[0];
      date = date1 + "~" + date2;

      queryDate = {
        expiredAt: { $gte: new Date(date1), $lte: new Date(date2) },
      };
    } else {
      date = "Semua";
    }

    const recruitments = await Recruitment.find({ ...query, ...queryDate });

    const pdfName = ["recruitments", "status-open", date];

    // let buildRecruitments = [];

    const docDef = {
      content: [
        pdfHeader("Laporan Penerimaan Karyawan Baru"),
        {
          text: date,
          style: "subtitle",
          alignment: "center",
        },
        {
          style: "table",
          table: {
            widths: [
              "auto",
              "*",
              "auto",
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
                  text: "Nama Posisi",
                  alignment: "center",
                  style: "tableHeader",
                },
                { text: "Melamar", alignment: "center", style: "tableHeader" },
                { text: "Diterima", alignment: "center", style: "tableHeader" },
                { text: "Ditolak", alignment: "center", style: "tableHeader" },
                { text: "Direkrut", alignment: "center", style: "tableHeader" },
                { text: "Deadline", alignment: "center", style: "tableHeader" },
                { text: "Status", alignment: "center", style: "tableHeader" },
              ],
              ...recruitments.map((recruitment, index) => {
                let candidateTotal =
                  recruitment.pending +
                  recruitment.accepted +
                  recruitment.rejected +
                  recruitment.hired;
                return [
                  { text: index + 1, alignment: "center" },
                  { text: recruitment.positionName, alignment: "left" },
                  {
                    text: `${recruitment.pending} / ${candidateTotal}`,
                    alignment: "center",
                  },
                  {
                    text: `${recruitment.accepted} / ${candidateTotal}`,
                    alignment: "center",
                  },
                  {
                    text: `${recruitment.rejected} / ${candidateTotal}`,
                    alignment: "center",
                  },
                  {
                    text: `${recruitment.hired} / ${recruitment.numberRequired}`,
                    alignment: "center",
                  },
                  {
                    text: new Date(recruitment.expiredAt)
                      .toISOString()
                      .split("T")[0],
                    alignment: "center",
                  },
                  {
                    text: recruitment.status.toUpperCase(),
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
    return res.json(err);
  }
});

// Getting one
router.get("/:id", getRecruitment, async (req, res) => {
  console.log(req.query);
  return res.json(res.recruitment);
});

// Getting candidates
router.get("/:id/candidates", getRecruitment, async (req, res) => {
  console.log(res.recruitment);

  console.log(req.query);
  let usersId;
  if (req.query) {
    usersId = res.recruitment.candidates
      .filter((candidate) => candidate.status === req.query.status)
      .map((candidate) => candidate.user);
  } else {
    usersId = res.recruitment.candidates.map((candidate) => candidate.user);
  }
  try {
    const candidates = await User.find({
      _id: {
        $in: usersId,
      },
    })
      .populate("profile")
      .select(["name", "image", "email", "bio", "gender", "birthDate"]);

    return res.json(candidates);
  } catch (err) {
    console.error(err);
    return res.status(404).json({ error: err.message });
  }
});

// Creating one
router.post("/", async (req, res) => {
  console.log(req.body);
  const recruitment = new Recruitment({
    title: req.body.title,
    numberRequired: req.body.numberRequired,
    description: req.body.description,
    expiredAt: req.body.expiredAt,
  });

  try {
    const position = await Position.findById(req.body.positionId);
    const department = await Department.findById(position.department);
    recruitment.position = position.id;
    recruitment.positionName = position.name;
    recruitment.department = department.id;
    recruitment.departmentName = department.name;

    const newRecruitment = await recruitment.save();
    return res.status(201).json(newRecruitment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Updating one
router.patch("/:id", getRecruitment, async (req, res) => {
  res.recruitment.updatedAt = new Date();
  if (req.body.title) res.recruitment.title = req.body.title;
  if (req.body.positionName)
    res.recruitment.positionName = req.body.positionName;
  if (req.body.departmentName)
    res.recruitment.departmentName = req.body.departmentName;
  if (req.body.numberRequired)
    res.recruitment.numberRequired = req.body.numberRequired;
  if (req.body.description) res.recruitment.description = req.body.description;
  if (req.body.status) res.recruitment.status = req.body.status;

  try {
    const updatedRecruitment = await res.recruitment.save();

    return res.json(updatedRecruitment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Deleting one
router.delete("/:id", getRecruitment, async (req, res) => {
  try {
    await res.recruitment.remove();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Push new candidate
router.post("/:id/candidates", auth, getRecruitment, async (req, res) => {
  res.recruitment.updatedAt = new Date();

  if (req.user.privilege === "admin")
    return res.status(400).json({ message: "Anda adalah admin!" });

  // Check if user already applied
  const candidate = res.recruitment.candidates.find(
    (candidate) => candidate.user.toString() === req.user._id.toString()
  );
  if (candidate)
    return res.status(400).json("User already applied to this recruitment!");

  res.recruitment.candidates.push({ user: req.user._id, status: "pending" });

  try {
    const updatedRecruitment = await res.recruitment.save();

    // Change user privilege to candidate
    req.user.privilege = "candidate";
    await req.user.save();

    return res.status(201).json(updatedRecruitment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Change candidate status
router.patch("/:id/candidates/:userId", getRecruitment, async (req, res) => {
  res.recruitment.updatedAt = new Date();

  try {
    const updatedCandidate = res.recruitment.candidates.find(
      (candidate) => candidate.user.toString() === req.params.userId
    );

    updatedCandidate.status = req.body.status;
    res.recruitment.candidates = res.recruitment.candidates.map((candidate) =>
      candidate.user.toString() === req.params.userId
        ? updatedCandidate
        : candidate
    );

    const updatedRecruitment = await res.recruitment.save();
    return res.json(updatedRecruitment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

async function getRecruitment(req, res, next) {
  try {
    const recruitment = await Recruitment.findById(req.params.id);
    if (!recruitment) {
      return res.status(404).json("Recruitment not found!");
    }
    
    res.recruitment = recruitment;
    next();
  } catch (err) {
    console.error(err);
    return res.status(400).json("Not valid recruitment id");
  }
}

async function getUser(req, res, next) {
  try {
    const user = await User.findById(req.body.user);
    if (!user) {
      return res.status(404).json("User not found!");
    }

    res.user = user;
    next();
  } catch (err) {
    console.error(err);
    return res.status(400).json("Not valid user id");
  }
}

module.exports = router;
