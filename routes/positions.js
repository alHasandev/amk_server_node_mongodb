const express = require("express");
const Position = require("../models/Position");
const Department = require("../models/Department");

const router = express.Router();

const path = require("path");
const PdfPrinter = require("pdfmake");

const appPath = path.dirname(__dirname);
const pdfHeader = require("../assets/pdf-make/header");

const fonts = {
  Roboto: {
    normal: appPath + "/fonts/Roboto/Roboto-Regular.ttf",
    bold: appPath + "/fonts/Roboto/Roboto-Medium.ttf",
    italics: appPath + "/fonts/Roboto/Roboto-Italic.ttf",
    bolditalics: appPath + "/fonts/Roboto/Roboto-MediumItalic.ttf",
  },
};

const pdfStyles = require("../assets/pdf-make/styles");

const printer = new PdfPrinter(fonts);
const fs = require("fs");
const { time } = require("../utils/time");
const { IDR } = require("../utils/currency");
const validationPart = require("../assets/pdf-make/validationPart");

// Getting all
router.get("/", async (req, res) => {
  try {
    const positions = await Position.find({ ...req.query });

    return res.json(positions);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Get PDF
router.get("/print", async (req, res) => {
  try {
    const positions = await Position.find({ ...req.query });
    let department = {
      code: "ALL",
      name: "Semua",
    };

    const filter = {
      isActive: "Semua",
      department: {
        code: "ALL",
        name: "Semua",
      },
    };

    if (req.query.isActive) {
      filter.isActive = req.query.isActive !== "false" ? "YES" : "NO";
    }

    if (req.query.department) {
      filter.department = await Department.findById(req.query.department);
    }

    const pdfName = ["positions", "department-" + department.code];

    const docDef = {
      content: [
        pdfHeader("Laporan Daftar Posisi/Jabatan"),
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
            widths: ["auto", "auto", "*", "auto"],
            body: [
              [
                { text: "No.", style: "tableHeader", alignment: "center" },
                { text: "Code", style: "tableHeader", alignment: "center" },
                {
                  text: "Nama Posisi",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: "Gajih Pokok",
                  style: "tableHeader",
                  alignment: "center",
                },
              ],
              ...positions.map((position, index) => {
                return [
                  { text: index + 1, style: "tableData", alignment: "center" },
                  {
                    text: position.code,
                    style: "tableData",
                    alignment: "center",
                  },
                  {
                    text: position.name,
                    style: "tableData",
                    alignment: "left",
                  },
                  {
                    text: IDR(position.salary),
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
    return res.status(500).json(err.responseData);
  }
});

// Getting one
router.get("/:id", getPosition, async (req, res) => {
  return res.json(res.position);
});

// Creating one + Push new position to department's position list
router.post("/", getDepartment, async (req, res) => {
  const position = new Position({
    department: res.department._id,
    code: req.body.code,
    name: req.body.name,
    level: req.body.level,
    salary: req.body.salary,
  });

  try {
    // Save new position
    const newPosition = await position.save();

    // Push new position to department's position list
    res.department.positions.push(newPosition._id);
    await res.department.save();

    return res.status(201).json(newPosition);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Updating one
router.patch("/:id", getPosition, async (req, res) => {
  if (req.body.code) res.position.code = req.body.code;
  if (req.body.name) res.position.name = req.body.name;
  if (req.body.salary) res.position.salary = req.body.salary;
  if (req.body.level) res.position.level = req.body.level;
  if (req.body.isActive) res.position.isActive = req.body.isActive;

  try {
    const updatedPosition = await res.position.save();

    return res.json(updatedPosition);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Deleting one
router.delete("/:id", getPosition, async (req, res) => {
  try {
    await res.position.remove();

    // Delete position in department
    const department = await Department.findById(res.position.department);
    department.positions = department.positions.filter(
      (position) => position.toString() !== req.params.id
    );
    console.log(department.positions);
    await department.save();

    return res.json({ message: "Deleted position" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Deleting one
router.delete("/soft/:id", getPosition, async (req, res) => {
  try {
    res.position.isActive = false;
    const updatedPosition = await res.position.save();

    return res.json(updatedPosition);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Function: get position by request params id
async function getPosition(req, res, next) {
  try {
    const position = await Position.findById(req.params.id);
    if (!position)
      return res.status(404).json({ error: "Position not found!" });

    res.position = position;
    next();
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: "Not valid position id" });
  }
}

// Function: get department by request body department
async function getDepartment(req, res, next) {
  try {
    const department = await Department.findById(req.body.department);
    if (!department)
      return res.status(404).json({ error: "Deparment not found!" });

    res.department = department;
    next();
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: "Invalid department id" });
  }
}

module.exports = router;
