const express = require("express");
const Employee = require("../models/Employee");
const auth = require("../middleware/auth");
const User = require("../models/User");
const path = require("path");
const url = require("url");
const root = require("../root");

const router = express.Router();

// Import for pdf make
const PdfPrinter = require("pdfmake");
const pdfStyles = require("../assets/pdf-make/styles");
const pdfHeader = require("../assets/pdf-make/header");
const fonts = require("../assets/pdf-make/fonts");

const printer = new PdfPrinter(fonts);
const fs = require("fs");
const { IDR } = require("../utils/currency");
const { localDate, normalDate, calculateAge } = require("../utils/time");
const Department = require("../models/Department");
const Position = require("../models/Position");
const { time } = require("../utils/time");
const validationPart = require("../assets/pdf-make/validationPart");

// Getting all
router.get("/", async (req, res) => {
  try {
    const { dateRange, ...query } = req.query;

    if (dateRange) {
      let [start, end] = req.query.dateRange.split(":");

      query.joinDate = { $gte: start, $lte: end };
    }

    console.log(query);

    const employees = await Employee.find({ ...query }).populate({
      path: "user position department",
      select: "-password",
      populate: "profile",
    });

    return res.json(employees);
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
      department: {
        code: "ALL",
        name: "Semua",
      },
      position: {
        code: "ALL",
        name: "Semua",
      },
    };

    if (query.department) {
      filter.department = await Department.findById(query.department);
    }

    if (query.position) {
      filter.position = await Position.findById(query.position);
    }

    if (dateRange) {
      let [start, end] = req.query.dateRange.split(":");

      filter.dateRange = `${start} - ${end}`;
      query.joinDate = { $gte: start, $lte: end };
    }

    const employees = await Employee.find({ ...query }).populate({
      path: "user position department",
      select: "-password",
      populate: "profile",
    });

    // console.log(employees);

    const pdfName = ["employees"];

    const docDef = {
      pageOrientation: "landscape",
      content: [
        pdfHeader("Laporan Daftar Karyawan Baru"),
        {
          style: "table",
          table: {
            widths: ["auto", "*"],
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
              [
                {
                  text: "Departemen",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: `[${filter.department.code}] ${filter.department.name}`,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Posisi/Jabatan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: `[${filter.position.code}] ${filter.position.name}`,
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Tanggal Bergabung",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: filter.dateRange,
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
                  text: "Umur",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Tanggal Bergabung",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Posisi/Jabatan",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Departemen",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Gaji Pokok",
                  style: "tableHeader",
                  alignment: "center",
                },
              ],
              ...employees.map((employee, index) => {
                let profile = employee.user.profile;
                let joinDate = normalDate(employee.joinDate);
                let age = calculateAge(profile.birthDate);

                // console.log(profile);
                return [
                  { text: index + 1, alignment: "center" },
                  { text: employee.user.nik, alignment: "center" },
                  employee.user.name,
                  {
                    text: age,
                    alignment: "center",
                  },
                  {
                    text: joinDate,
                    alignment: "center",
                  },
                  {
                    text: `[${employee.position.code}] ${employee.position.name}`,
                    alignment: "center",
                  },
                  {
                    text: `[${employee.department.code}] ${employee.department.name}`,
                    alignment: "center",
                  },
                  { text: IDR(employee.position.salary), alignment: "center" },
                ];
              }),
            ],
          },
        },
        validationPart({
          positionName: "Banjarmasin, " + time.getDateString(),
          username: "Admin",
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

// Printing employee profile by employee id
router.get("/print/:employeeId", async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.employeeId).populate({
      path: "user position department",
      select: "-password",
      populate: "profile",
    });

    const user = employee.user;
    const department = employee.department ? employee.department : {};
    const position = employee.position ? employee.position : {};
    const profile = user.profile ? user.profile : {};

    const imagePath = path.join(root, "public", url.parse(user.image).pathname);

    const docDef = {
      content: [
        pdfHeader("PROFIL KARYAWAN"),
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
                  text: "FORM KARYAWAN",
                  style: "tableHeader",
                  alignment: "left",
                  colSpan: 2,
                },
                {},
              ],
              [
                {
                  text: "Posisi / Jabatan",
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
              [
                {
                  text: "Tanggal Direkrut",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: time.getDateString(employee.joinDate),
                  style: "tableData",
                  alignment: "left",
                },
              ],
              [
                {
                  text: "Gaji Pokok",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: IDR(position.salary),
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

    const pdfName = ["employee-detail", req.params.employeeId];

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

// Get current user employee data
router.get("/me", auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id }).populate({
      path: "position department",
    });

    if (req.query.populate) {
      employee[req.query.populate] = req.user;
    }

    // console.log(employee);
    return res.json(employee);
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Getting one
router.get("/:employeeId", auth, async (req, res) => {
  try {
    if (
      req.user.privilege === "admin" ||
      req.user._id === req.params.employeeId
    ) {
      let populate = {};
      if (req.query.populate) {
        populate = JSON.parse(req.query.populate);
      }

      const employee = await Employee.findById(req.params.employeeId).populate({
        path: "user department position",
        select: "-password",
        ...populate,
      });

      return res.json(employee);
    }

    return res.sendStatus(403);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Creating one
router.post("/", auth, async (req, res) => {
  console.log(req.body);
  const employee = new Employee({
    user: req.body.user,
    position: req.body.position,
    department: req.body.department,
    joinDate: new Date(),
  });

  try {
    if (req.user.privilege !== "admin") return res.sendStatus(403);
    const newEmployee = await employee.save();

    // Change user privilege to employee
    const user = await User.findById(req.body.user);
    if (user.privilege !== "admin") {
      user.privilege = "employee";
      await user.save();
    }

    return res.status(201).json(newEmployee);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Updating one
router.patch("/:employeeId", auth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.employeeId);
    if (req.body.position) employee.position = req.body.position;
    if (req.body.department) employee.department = req.body.department;
    if (req.body.isActive) employee.isActive = req.body.isActive;

    if (req.user.privilege !== "admin") return res.sendStatus(403);

    const updatedEmployee = await employee.save();
    return res.json(updatedEmployee);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Deleting one
router.delete("/:userId", auth, getEmployeeByUserId, async (req, res) => {
  try {
    await Employee.remove();

    return res.json({ message: "Deleted employee!" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Function: get employee by user id
async function getEmployeeByUserId(req, res, next) {
  try {
    const employee = await Employee.findOne({ user: req.params.userId });

    res.employee = employee;
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = router;
