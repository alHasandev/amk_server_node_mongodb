const express = require("express");

const router = express.Router();
const auth = require("../middleware/auth");
const Recruitment = require("../models/Recruitment");
const Department = require("../models/Department");
const Position = require("../models/Position");
const User = require("../models/User");
const path = require("path");
const url = require("url");
const root = require("../root");

// Import for pdfmake
const PdfPrinter = require("pdfmake");
const pdfFonts = require("../assets/pdf-make/fonts");
const pdfHeader = require("../assets/pdf-make/header");
const pdfStyles = require("../assets/pdf-make/styles");

const fonts = pdfFonts;

const printer = new PdfPrinter(fonts);
const fs = require("fs");
const { time, calculateAge } = require("../utils/time");
const Candidate = require("../models/Candidate");
const validationPart = require("../assets/pdf-make/validationPart");

// Getting all
router.get("/", async (req, res) => {
  try {
    let { dateRange, ...query } = req.query;
    let queryDate = {};

    if (dateRange) {
      let [start, end] = req.query.dateRange.split(":");

      queryDate = {
        expiredAt: { $gte: start, $lte: end },
      };
    }

    const recruitments = await Recruitment.find({
      ...query,
      ...queryDate,
    }).populate({
      path: "position department",
    });

    return res.json(recruitments);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Get PDF
router.get("/print", async (req, res) => {
  try {
    const { dateRange, ...query } = req.query;
    const filter = {
      dateRange: "Semua",
      status: "Semua",
    };

    if (query.status) filter.status = query.status;
    if (query.isActive) {
      filter.isActive = query.isActive !== "false" ? "YES" : "NO";
    }

    if (dateRange) {
      let [start, end] = req.query.dateRange.split(":");

      filter.dateRange = `${start} - ${end}`;
      query.expiredAt = { $gte: start, $lte: end };
    }

    const recruitments = await Recruitment.find({ ...query }).populate({
      path: "position department",
    });

    const pdfName = ["recruitments", "status-open", filter.dateRange];

    // let buildRecruitments = [];

    const docDef = {
      pageOrientation: "landscape",
      content: [
        pdfHeader("Daftar Penerimaan Karyawan Baru"),
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
                  text: "Batas Waktu",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: filter.dateRange,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Status Lowongan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: filter.status.toUpperCase(),
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Aktif ?",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: filter.isActive,
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
              "*",
              "auto",
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
                  text: "Posisi Diperlukan",
                  alignment: "left",
                  style: "tableHeader",
                },
                {
                  text: "Jumlah Diperlukan",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Jumlah Pelamar",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Jumlah Ditunda",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Jumlah Diterima",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Jumlah Direkrut",
                  alignment: "center",
                  style: "tableHeader",
                },
                {
                  text: "Batas Waktu",
                  alignment: "center",
                  style: "tableHeader",
                },
                { text: "Status", alignment: "center", style: "tableHeader" },
              ],
              ...recruitments.map((recruitment, index) => {
                const position = recruitment.position
                  ? recruitment.position
                  : {};
                const department = recruitment.department
                  ? recruitment.department
                  : {};

                let candidateTotal =
                  recruitment.pending +
                  recruitment.accepted +
                  recruitment.rejected +
                  recruitment.hired;

                return [
                  { text: index + 1, alignment: "center" },
                  {
                    text: position.name,
                    style: "tableData",
                    alignment: "left",
                  },
                  {
                    text: recruitment.numberRequired,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: candidateTotal,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: recruitment.pending,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: recruitment.accepted,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: recruitment.hired,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: time.getDateString(recruitment.expiredAt),
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: recruitment.status.toUpperCase(),
                    style: "tableData",
                    alignment: "center",
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
    return res.json(err);
  }
});

// Getting PDF / Recruitment Detail + List Candidate
router.get("/print/:recruitmentId", async (req, res) => {
  try {
    const recruitment = await Recruitment.findById(
      req.params.recruitmentId
    ).populate({
      path: "position department",
    });

    const candidates = await Candidate.find({
      recruitment: req.params.recruitmentId,
    }).populate({
      path: "user",
      populate: "profile",
      select: "-password",
    });

    const department = recruitment.department ? recruitment.department : {};
    const position = recruitment.position ? recruitment.position : {};

    const docDef = {
      content: [
        pdfHeader("Detail Penerimaan Karyawan Baru"),
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
                  text: "Judul Lowongan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: recruitment.title,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Posisi Diperlukan",
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
                  text: "Dari Departemen",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: `[${department.code}] ${department.name}`,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Jumlah Diperlukan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: recruitment.numberRequired + " orang",
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Jumlah Pelamar",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text:
                    recruitment.pending +
                    recruitment.rejected +
                    recruitment.accepted +
                    recruitment.hired +
                    " orang",
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Tanggal Dibuat",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: time.getDateString(recruitment.createdAt),
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Batas Waktu",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: time.getDateString(recruitment.expiredAt),
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Status Lowongan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: recruitment.status.toUpperCase(),
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
            widths: ["auto", "auto", "*", "auto", "auto", "auto", "auto"],
            headerRows: 2,
            body: [
              [
                {
                  text: "Daftar Pelamar / Calon Karyawan",
                  style: "tableHeader",
                  alignment: "center",
                  colSpan: 7,
                },
                {},
                {},
                {},
                {},
                {},
                {},
              ],
              [
                { text: "No.", style: "tableHeader", alignment: "center" },
                { text: "Foto", style: "tableHeader", alignment: "center" },
                {
                  text: "Nama Pelamar",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: "Email",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Umur",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Pendidikan Terakhir",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Status",
                  style: "tableHeader",
                  alignment: "center",
                },
              ],
              ...candidates.map((candidate, index) => {
                const user = candidate.user;
                const profile = user.profile ? user.profile : {};
                const imagePath = path.join(
                  root,
                  "public",
                  url.parse(user.image).pathname
                );

                const educationCount = profile.educations
                  ? profile.educations.length
                  : 0;

                let lastEducation = {};
                if (educationCount > 0) {
                  lastEducation = profile.educations[educationCount - 1];
                }

                return [
                  { text: index + 1, style: "tableData", alignment: "center" },
                  { image: imagePath, fit: [50, 50], alignment: "center" },
                  {
                    text: user.name,
                    style: "tableData",
                    alignment: "left",
                  },
                  {
                    text: user.email,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: calculateAge(profile.birthDate),
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: lastEducation.school,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: candidate.status.toUpperCase(),
                    style: "tableData",
                    alignment: "center",
                  },
                ];
              }),
            ],
          },
        },
        validationPart({
          positionName: "Banjarmasin, " + time.getDateString(),
          username: "ADMIN",
          nik: "",
        }),
      ],
      styles: pdfStyles,
    };

    const pdfName = ["recruitment-detail", req.params.recruitmentId];

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
    status: req.body.status,
  });

  try {
    if (req.body.requirements) {
      let requirements = req.body.requirements;
      if (Array.isArray(requirements)) {
        recruitment.requirements = requirements;
      } else {
        recruitment.requirements = requirements.split(";");
      }
    }
    const position = await Position.findById(req.body.positionId);
    console.log(position);
    const department = await Department.findById(position.department);
    recruitment.position = position._id;
    recruitment.positionName = position.name;
    recruitment.department = department._id;
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
  if (req.body.expiredAt) res.recruitment.expiredAt = req.body.expiredAt;

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
    return res.json({ message: "Department deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Soft deleting
router.delete("/soft/:id", getRecruitment, async (req, res) => {
  try {
    res.recruitment.isActive = false;
    await res.recruitment.save();

    return res.json({ message: "Department deleted" });
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
    const recruitment = await Recruitment.findById(req.params.id).populate({
      path: "position department",
    });
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
