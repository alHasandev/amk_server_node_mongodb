const express = require("express");

const auth = require("../middleware/auth");
const Recruitment = require("../models/Recruitment");
const User = require("../models/User");
const Candidate = require("../models/Candidate");
const Profile = require("../models/Profile");
const path = require("path");
const url = require("url");

const router = express.Router();

// Import for pdfmake
const PdfPrinter = require("pdfmake");
const pdfFonts = require("../assets/pdf-make/fonts");
const pdfHeader = require("../assets/pdf-make/header");
const pdfStyles = require("../assets/pdf-make/styles");

const fonts = pdfFonts;

const printer = new PdfPrinter(fonts);
const fs = require("fs");
const { time } = require("../utils/time");
const validationPart = require("../assets/pdf-make/validationPart");
const root = require("../root");

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
      query.appliedAt = { $gte: start, $lte: end };
    }

    const candidates = await Candidate.find({ ...query }).populate({
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
                  text: "Tanggal Melamar",
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
                  text: "Status Lamaran",
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
                  { text: index + 1, style: "tableData", alignment: "center" },
                  {
                    text: candidate.user.name,
                    style: "tableData",
                    alignment: "left",
                  },
                  {
                    text: candidate.recruitment.positionName,
                    style: "tableData",
                    alignment: "left",
                  },
                  {
                    text: education.school,
                    style: "tableData",
                    alignment: "left",
                  },
                  {
                    text: candidate.status.toUpperCase(),
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: new Date(candidate.appliedAt)
                      .toISOString()
                      .split("T")[0],
                    style: "tableData",
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

// Printing detail candidate profile
router.get("/print/:candidateId", async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.candidateId).populate(
      {
        path: "user recruitment",
        select: "-password",
        populate: "profile position department",
      }
    );

    const user = candidate.user;
    const recruitment = candidate.recruitment;
    const profile = user.profile ? user.profile : {};
    const department = recruitment.department ? recruitment.department : {};
    const position = recruitment.position ? recruitment.position : {};

    const imagePath = path.join(root, "public", url.parse(user.image).pathname);

    const docDef = {
      content: [
        pdfHeader("PROFIL CALON KARYAWAN"),
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
                  text: "FORM LAMARAN",
                  style: "tableHeader",
                  alignment: "left",
                  colSpan: 2,
                },
                {},
              ],
              [
                {
                  text: "Posisi Dilamar",
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
                  text: "Tanggal Melamar",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: time.getDateString(candidate.appliedAt),
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Status Lamaran",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: candidate.status.toUpperCase(),
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Komentar",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: candidate.comment,
                  style: "tableData",
                  alignment: "left",
                },
              ],
            ],
          },
        },
        {
          margin: [0, 10, 0, 4],
          columns: [
            {
              width: "*",
              style: "table",
              margin: [0, 0, 0, 0],
              table: {
                widths: [120, "*"],
                body: [
                  [
                    {
                      text: "DATA PROFIL",
                      style: "tableHeader",
                      alignment: "left",
                      colSpan: 2,
                    },
                    {},
                  ],
                  [
                    {
                      text: "NIK",
                      style: "tableHeader",
                      alignment: "left",
                    },
                    {
                      text: user.nik,
                      style: "tableData",
                      alignment: "left",
                    },
                  ],
                  [
                    {
                      text: "Nama Pelamar",
                      style: "tableHeader",
                      alignment: "left",
                    },
                    {
                      text: user.name,
                      style: "tableData",
                      alignment: "left",
                    },
                  ],
                  [
                    {
                      text: "No Kontak",
                      style: "tableHeader",
                      alignment: "left",
                    },
                    {
                      text: profile.contact,
                      style: "tableData",
                      alignment: "left",
                    },
                  ],
                  [
                    {
                      text: "Email",
                      style: "tableHeader",
                      alignment: "left",
                    },
                    {
                      text: user.email,
                      style: "tableData",
                      alignment: "left",
                    },
                  ],
                ],
              },
            },
            {
              width: 120,
              style: "table",
              margin: [0, 0, 0, 0],
              table: {
                widths: ["*"],
                body: [
                  [
                    {
                      margin: [2, 4, 2, 4],
                      image: imagePath,
                      fit: [100, 100],
                      alignment: "center",
                    },
                  ],
                ],
              },
            },
          ],
        },
        {
          style: "table",
          table: {
            widths: ["auto", "auto", "*", "auto", "*"],
            headerRows: 2,
            body: [
              [
                {
                  text: "Riwayat Pendidikan",
                  style: "tableHeader",
                  alignment: "left",
                  colSpan: 5,
                },
                {},
                {},
                {},
                {},
              ],
              [
                { text: "No.", style: "tableHeader", alignment: "center" },
                { text: "Tahun", style: "tableHeader", alignment: "center" },
                {
                  text: "Nama Instansi",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: "Jurusan",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Keterangan",
                  style: "tableHeader",
                  alignment: "left",
                },
              ],
              ...profile.educations.map((education, index) => {
                return [
                  { text: index + 1, style: "tableData", alignment: "center" },
                  {
                    text: `${time.year(education.from)}-${
                      education.isCurrently
                        ? "Sekarang"
                        : time.year(education.to)
                    }`,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: education.school,
                    style: "tableData",
                    alignment: "left",
                  },
                  {
                    text: education.major,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: education.description,
                    style: "tableData",
                    alignment: "left",
                  },
                ];
              }),
            ],
          },
        },
        {
          style: "table",
          table: {
            widths: ["auto", "auto", "*", "auto", "*"],
            headerRows: 2,
            body: [
              [
                {
                  text: "Riwayat Pengalaman",
                  style: "tableHeader",
                  alignment: "left",
                  colSpan: 5,
                },
                {},
                {},
                {},
                {},
              ],
              [
                { text: "No.", style: "tableHeader", alignment: "center" },
                { text: "Tahun", style: "tableHeader", alignment: "center" },
                {
                  text: "Nama Perusahaan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: "Jabatan",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Keterangan",
                  style: "tableHeader",
                  alignment: "left",
                },
              ],
              ...profile.experiences.map((experience, index) => {
                return [
                  { text: index + 1, style: "tableData", alignment: "center" },
                  {
                    text: `${time.year(experience.from)}-${
                      experience.isCurrently
                        ? "Sekarang"
                        : time.year(experience.to)
                    }`,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: experience.company,
                    style: "tableData",
                    alignment: "left",
                  },
                  {
                    text: experience.job,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: experience.description,
                    style: "tableData",
                    alignment: "left",
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
      defaultStyle: {
        columnGap: 10,
      },
    };

    const pdfName = ["candidate-detail", req.params.candidateId];

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
