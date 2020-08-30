const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");
const Profile = require("../models/Profile");
const Employee = require("../models/Employee");

// Import for pdf make
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
    const users = await User.find().select("-password");

    return res.json(users);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Getting current user
router.get("/me", auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ _id: req.user.profile });
    req.user.profile = profile;
    // console.log(profile);
    return res.json(req.user);
  } catch (err) {}
});

// Getting PDF
router.get("/print", async (req, res) => {
  try {
    const users = await User.find({ ...req.query }).select("-password");

    const pdfName = ["users"];

    const docDef = {
      content: [
        {
          text: "Laporan Daftar Pengguna",
          style: "title",
          alignment: "center",
        },
        {
          style: "table",
          table: {
            widths: ["auto", "auto", "*", "auto", "auto"],
            body: [
              [
                { text: "No.", style: "tableHeader", alignment: "center" },
                { text: "Gambar", style: "tableHeader", alignment: "center" },
                {
                  text: "Nama User",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Email",
                  style: "tableHeader",
                  alignment: "center",
                },
                {
                  text: "Hak Akses",
                  style: "tableHeader",
                  alignment: "center",
                },
              ],
              ...users.map((user, index) => {
                let imgPath = `${appPath}/assets/images/profile/${user.image}`;
                return [
                  { text: index + 1, alignment: "center" },
                  { image: imgPath, fit: [50, 50], alignment: "center" },
                  { text: user.name, alignment: "left" },
                  {
                    text: user.email,
                    alignment: "left",
                  },
                  {
                    text: user.privilege.toUpperCase(),
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

// Getting one
router.get("/:id", getUser, (req, res) => {
  return res.json(res.user);
});

// Getting user with profile
router.get("/:id/profile", auth, getUser, async (req, res) => {
  try {
    const profile = await Profile.findById(res.user.profile);
    res.user.profile = profile;

    return res.json(res.user);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: err.message });
  }
});

// Creating one
router.post("/", isUniqueUser(true), async (req, res) => {
  const user = new User({
    nik: req.body.nik,
    name: req.body.name,
    email: req.body.email,
  });

  try {
    // Bcrypt setup
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // Push hashed password to user
    user.password = hashedPassword;

    const newUser = await user.save();
    return res.status(201).json(newUser);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
});

// Updating one
router.patch("/me", auth, async (req, res) => {
  if (req.body.nik) req.user.nik = req.body.nik;
  if (req.body.name) req.user.name = req.body.name;
  if (req.body.email) req.user.email = req.body.email;
  if (req.body.image) req.user.image = req.body.image;

  // set updated at date
  req.user.updatedAt = new Date();

  try {
    if (req.body.password) {
      // Bcrypt setup
      const hashedPassword = await bcrypt.hash(res.body.password, 10);

      // Push hashed password to user
      req.user.password = hashedPassword;
    }

    const updatedUser = await req.user.save();
    return res.json(updatedUser);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
});

// Updating one
router.patch("/:id", getUser, async (req, res) => {
  if (req.body.nik) res.user.nik = req.body.nik;
  if (req.body.name) res.user.name = req.body.name;
  if (req.body.email) res.user.email = req.body.email;
  if (req.body.privilege) res.user.privilege = req.body.privilege;

  // set updated at date
  res.user.updatedAt = new Date();

  try {
    if (req.body.password) {
      // Bcrypt setup
      const hashedPassword = await bcrypt.hash(req.body.password, 10);

      // Push hashed password to user
      res.user.password = hashedPassword;
    }

    const updatedUser = await res.user.save();
    return res.json(updatedUser);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
});

router.delete("/reset", async (req, res) => {
  try {
    await User.deleteMany({});

    return res.status(205).json({ message: "User data is reseted!" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Deleting One
router.delete("/:id", getUser, async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: res.user._id });
    await employee.remove();
    await res.user.remove();
    res.json({ message: "Deleted user" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Function: get user by id
async function getUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (user == null) {
      return res.status(404).json({ message: "User not found!" });
    }

    res.user = user;
    next();
  } catch (err) {
    console.error(err);
    return res.status(400).json({ message: "Not valid user id!" });
  }
}

// Function: check if nik and email is exist
function isUniqueUser(bool = true) {
  return async (req, res, next) => {
    try {
      const users = await User.find({
        $or: [{ nik: req.body.nik }, { email: req.body.email }],
      });
      if (users.length > 0 === bool) {
        return res
          .status(400)
          .json({ message: bool ? "Not unique user!" : "Is unique user" });
      }
      next();
    } catch (err) {
      console.error(err);
      return res
        .status(400)
        .json({ message: "Please specify valid Email or NIK number!" });
    }
  };
}

module.exports = router;
