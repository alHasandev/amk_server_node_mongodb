const express = require("express");

const Department = require("../models/Department");
const Position = require("../models/Position");

const router = express.Router();

const path = require("path");
const PdfPrinter = require("pdfmake");

const appPath = path.dirname(__dirname);

const pdfStyles = require("../assets/pdf-make/styles");

const fonts = {
  Roboto: {
    normal: appPath + "/fonts/Roboto/Roboto-Regular.ttf",
    bold: appPath + "/fonts/Roboto/Roboto-Medium.ttf",
    italics: appPath + "/fonts/Roboto/Roboto-Italic.ttf",
    bolditalics: appPath + "/fonts/Roboto/Roboto-MediumItalic.ttf",
  },
};

const printer = new PdfPrinter(fonts);
const fs = require("fs");

// Getting all
router.get("/", async (req, res) => {
  try {
    const departments = await Department.find({ ...req.query });

    return res.json(departments);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Get PDF
router.get("/print", async (req, res) => {
  try {
    const departments = await Department.find({ ...req.query });

    const pdfName = ["departments"];

    const docDef = {
      content: [
        {
          text: "Laporan Daftar Department",
          style: "title",
          alignment: "center",
        },
        {
          style: "table",
          table: {
            widths: ["auto", "auto", "*", "auto"],
            body: [
              [
                { text: "No.", style: "tableHeader", alignment: "center" },
                { text: "CODE", style: "tableHeader", alignment: "center" },
                {
                  text: "Nama Department",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Jumlah Posisi",
                  style: "tableHeader",
                  alignment: "center",
                },
              ],
              ...departments.map((department, index) => {
                return [
                  { text: index + 1, alignment: "center" },
                  { text: department.code, alignment: "center" },
                  department.name,
                  { text: department.positions.length, alignment: "center" },
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
    console.error(err.responseData);
    return res.json(err);
  }
});

// Gettting one
router.get("/:id", getDepartment, async (req, res) => {
  return res.json(res.department);
});

// Getting position on that department
router.get("/:id/positions", async (req, res) => {
  try {
    const positions = await Position.find({ department: req.params.id });

    return res.json(positions);
  } catch (err) {
    console.error(err);
    return res.status(404).json({ error: "Position not found!" });
  }
});

// Creating one
router.post("/", async (req, res) => {
  const department = new Department({
    code: req.body.code,
    name: req.body.name,
  });

  try {
    const newDepartment = await department.save();

    return res.status(201).json(newDepartment);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
});

// Updating one
router.patch("/:id", getDepartment, async (req, res) => {
  if (req.body.code) res.department.code = req.body.code;
  if (req.body.name) res.department.name = req.body.name;

  try {
    const updatedDepartment = await res.department.save();

    return res.json(updatedDepartment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Deleting one
router.delete("/:id", getDepartment, async (req, res) => {
  try {
    await res.department.remove();

    return res.json({ message: "Deleted department!" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Push new position
router.post("/:id/position", getDepartment, async (req, res) => {
  const position = new Position({
    department: res.department._id,
    code: req.body.code,
    name: req.body.name,
    salary: req.body.salary,
  });

  try {
    // Save new position
    const newPosition = await position.save();

    // Push new position to department's position list
    res.department.positions.push(newPosition._id);
    const updatedDepartment = await res.department.save();

    return res.status(201).json(updatedDepartment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Function: get department by request id
async function getDepartment(req, res, next) {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json("Department not found!");

    res.department = department;
    next();
  } catch (err) {
    console.error(err);
    return res.status(400).json("Not valid department id");
  }
}

module.exports = router;
