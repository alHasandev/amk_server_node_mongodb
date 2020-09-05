const express = require("express");
const auth = require("../middleware/auth");
const Request = require("../models/Request");
const Employee = require("../models/Employee");
const { update } = require("../models/Employee");

const router = express.Router();

// Import for pdf make
const PdfPrinter = require("pdfmake");
const pdfStyles = require("../assets/pdf-make/styles");
const pdfHeader = require("../assets/pdf-make/header");
const fonts = require("../assets/pdf-make/fonts");

const printer = new PdfPrinter(fonts);
const fs = require("fs");
const validationPart = require("../assets/pdf-make/validationPart");

// Getting all request
router.get("/", auth, async (req, res) => {
  try {
    if (req.user.privilege === "employee") {
      const employee = await Employee.findOne({ user: req.user._id });
      req.query.from = employee._id;
    }
    // console.log(req.query);
    const requests = await Request.find({ ...req.query }).populate({
      path: "from",
      populate: {
        path: "user position",
        select: "-password",
      },
    });
    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res.sendStatus(404);
  }
});

// Getting PDF
router.get("/print", async (req, res) => {
  try {
    const requests = await Request.find({ ...req.query }).populate({
      path: "from",
      populate: {
        path: "user position",
        select: "-password",
      },
    });

    const pdfName = ["requests"];

    const docDef = {
      content: [
        pdfHeader("Laporan Daftar Permintaan Karyawaan"),
        {
          style: "table",
          table: {
            widths: ["auto", "auto", "*", "auto", "auto"],
            body: [
              [
                { text: "No.", style: "tableHeader", alignment: "center" },
                { text: "Tanggal", style: "tableHeader", alignment: "center" },
                {
                  text: "Dari",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Detail Permintaan",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Status",
                  style: "tableHeader",
                  alignment: "center",
                },
              ],
              ...requests.map((request, index) => {
                let createdAt = new Date(request.createdAt)
                  .toISOString()
                  .split("T")[0];
                return [
                  { text: index + 1, alignment: "center" },
                  { text: createdAt, alignment: "center" },
                  {
                    text: `[${request.from.position.name}] ${request.from.user.name}`,
                    alignment: "left",
                  },
                  {
                    text: request.message,
                    alignment: "left",
                  },
                  {
                    text: request.status.toUpperCase(),
                    alignment: "center",
                  },
                ];
              }),
            ],
          },
        },
        validationPart({
          nik: "63042604990001",
          username: "Mohamad Albie",
          positionName: "Admin",
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

// Getting all request bt current user
router.get("/me", auth, getEmployee, async (req, res) => {
  try {
    const requests = await Request.find({ employee: req.employee._id });
    return res.json(requests);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

// Getting request PDF by employee id
router.get("/print/employee/:employeeId", async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.employeeId).populate({
      path: "user position",
      select: "-password",
    });

    const requests = await Request.find({ ...req.query });

    const pdfName = ["requests"];

    const docDef = {
      content: [
        pdfHeader("Laporan Permintaan Karyawaan"),
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
                  text: "Jabatan",
                  style: "tableHeader",
                  alignment: "left",
                },
                {
                  text: employee.position.name,
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
            widths: ["auto", "*", "auto", "auto"],
            body: [
              [
                { text: "No.", style: "tableHeader", alignment: "center" },
                { text: "Tanggal", style: "tableHeader", alignment: "center" },
                {
                  text: "Detail Permintaan",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Status",
                  style: "tableHeader",
                  alignment: "center",
                },
              ],
              ...requests.map((request, index) => {
                let createdAt = new Date(request.createdAt)
                  .toISOString()
                  .split("T")[0];
                return [
                  { text: index + 1, alignment: "center" },
                  { text: createdAt, alignment: "center" },
                  {
                    text: request.message,
                    alignment: "left",
                  },
                  {
                    text: request.status.toUpperCase(),
                    alignment: "center",
                  },
                ];
              }),
            ],
          },
        },
        validationPart(
          {
            nik: "63042604990001",
            username: "Mohamad Albie",
            positionName: "Admin",
          },
          {
            nik: employee.user.nik,
            username: employee.user.name,
            positionName: "Karyawan",
          }
        ),
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

// Getting request by id
router.get("/:requestId", auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.requestId).populate({
      path: "from",
      populate: {
        path: "user position",
        select: "-password",
      },
    });
    return res.json(request);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

// Creating request
router.post("/", auth, async (req, res) => {
  const request = new Request({
    from: req.body.from,
    message: req.body.message,
    createdAt: new Date(),
  });

  try {
    const newRequest = await request.save();

    return res.status(201).json(newRequest);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

// Creating current user request
router.post("/me", auth, getEmployee, async (req, res) => {
  const request = new Request({
    from: req.employee._id,
    message: req.body.message,
    createdAt: new Date(),
    status: "pending",
  });

  try {
    const newRequest = await request.save();
    // console.log(req.employee._id);

    return res.status(201).json(newRequest);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

// Updating request
router.patch("/:requestId", auth, getRequest, async (req, res) => {
  if (req.body.from) res.request.from = req.body.from;
  if (req.body.message) res.request.message = req.body.message;
  if (req.body.status) res.request.status = req.body.status;
  res.request.updatedAt = new Date();

  try {
    const updatedRequest = await res.request.save();

    return res.json(updatedRequest);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

router.patch("/me/:requestId", auth, getRequest, async (req, res) => {
  if (req.body.message) res.request.message = req.body.message;
  res.request.updatedAt = new Date();

  try {
    const updatedRequest = await res.request.save();

    return res.json(updatedRequest);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
});

// Deleting request
router.delete("/:requestId", auth, getRequest, async (req, res) => {
  try {
    await res.request.remove();
    return res.json({ message: "Deleted request!" });
  } catch (err) {
    console.log(err);
    return res.sendStatus(500);
  }
});

// Middleware: get request by id or request by current user
async function getRequest(req, res, next) {
  try {
    const request = await Request.findById(req.params.requestId);

    res.request = request;
    next();
  } catch (err) {
    console.error(err);
    return res.sendStatus(404);
  }
}

// Middleware: get current employee by user id
async function getEmployee(req, res, next) {
  try {
    const employee = await Employee.findOne({ user: req.user._id });
    req.employee = employee;
    console.log("req.employee", req.employee);
    next();
  } catch (err) {
    console.error(err);
    return res.sendStatus(404);
  }
}

module.exports = router;
