const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");
const Profile = require("../models/Profile");
const Employee = require("../models/Employee");
const formidable = require("formidable");

// Import for pdf make
const PdfPrinter = require("pdfmake");
const pdfHeader = require("../assets/pdf-make/header");
const pdfStyles = require("../assets/pdf-make/styles");
const fonts = require("../assets/pdf-make/fonts");

const printer = new PdfPrinter(fonts);
const fs = require("fs");
const root = require("../root");
const path = require("path");

const url = require("url");
const Candidate = require("../models/Candidate");

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
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
});

// Getting PDF
router.get("/print", async (req, res) => {
  try {
    const users = await User.find({ ...req.query }).select("-password");

    const pdfName = ["users"];

    const docDef = {
      content: [
        pdfHeader("Laporan Daftar User"),
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
                const imagePath = path.join(
                  root,
                  "public",
                  url.parse(user.image).pathname
                );
                return [
                  { text: index + 1, alignment: "center" },
                  { image: imagePath, fit: [50, 50], alignment: "center" },
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
router.post("/", isUniqueUser(true), uploadImage, async (req, res) => {
  const user = new User({
    nik: req.body.nik,
    name: req.body.name,
    email: req.body.email,
  });

  try {
    // check if privilege is set
    if (req.body.image) {
      user.image = req.body.image;
    } else {
      user.image = `${req.protocol}://${req.headers.host}/images/profile/default.png`;
    }
    if (req.body.privilege) user.privilege = req.body.privilege;

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

// Upload user image
router.post("/upload/:userId", async (req, res) => {});

// Updating one
router.patch("/me", auth, async (req, res) => {
  if (req.body.nik) req.user.nik = req.body.nik;
  if (req.body.name) req.user.name = req.body.name;
  if (req.body.email) req.user.email = req.body.email;

  // set updated at date
  req.user.updatedAt = new Date();

  try {
    if (req.body.image) {
      // delete prev image file
      const imagePath = path.join(
        root,
        "public",
        url.parse(req.user.image).pathname
      );

      if (
        url.parse(req.user.image).pathname !== "/images/profile/default.png"
      ) {
        fs.unlink(imagePath, (err) => {
          if (err) {
            console.error(err);
            return res.status(400).json(err);
          }
        });
      }

      req.user.image = req.body.image;
    }
    if (req.body.password) {
      // Bcrypt setup
      const hashedPassword = await bcrypt.hash(req.body.password, 10);

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
router.patch("/:id", getUser, uploadImage, async (req, res) => {
  if (req.body.nik) res.user.nik = req.body.nik;
  if (req.body.name) res.user.name = req.body.name;
  if (req.body.email) res.user.email = req.body.email;
  if (req.body.privilege) res.user.privilege = req.body.privilege;

  // set updated at date
  res.user.updatedAt = new Date();

  try {
    if (req.body.image) {
      // delete prev image file
      const imagePath = path.join(
        root,
        "public",
        url.parse(res.user.image).pathname
      );

      if (
        url.parse(res.user.image).pathname !== "/images/profile/default.png"
      ) {
        fs.unlink(imagePath, (err) => {
          if (err) {
            console.error(err);
            return res.status(400).json(err);
          }
        });
      }
      // console.log(url.parse(res.user.image));

      res.user.image = req.body.image;
    }

    if (req.body.password) {
      // Bcrypt setup
      const hashedPassword = await bcrypt.hash(req.body.password, 10);

      // Push hashed password to user
      res.user.password = hashedPassword;
    }

    // console.log(res.user);
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
    // Delete employee data
    const candidate = await Candidate.findOne({ user: res.user._id });
    const employee = await Employee.findOne({ user: res.user._id });
    if (!!employee) await employee.remove();
    if (!!candidate) await candidate.remove();

    // Delete image file
    const imagePath = path.join(
      root,
      "public",
      url.parse(res.user.image).pathname
    );

    if (url.parse(res.user.image).pathname !== "/images/profile/default.png") {
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error(err);
          return res.status(400).json(err);
        }
      });
    }

    await res.user.remove();
    res.json({ message: "Deleted user" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// SoftDeleting One
router.delete("/soft/:id", getUser, async (req, res) => {
  try {
    res.user.isActive = false;
    await res.user.save();

    res.json({ message: "Deleted user" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// Function: get user by id
async function getUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    res.user = user;
    console.log(res.user);
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

// Function: upload user image
function uploadImage(req, res, next) {
  const form = new formidable.IncomingForm();

  try {
    form.parse(req, (err, fields, files) => {
      if (err) throw err;
      console.log("Fields", fields);
      console.log("Files", files);

      req.body = fields;
      if (files.image) {
        let extension;
        switch (files.image.type) {
          case "image/png":
            extension = ".png";
            break;
          case "image/jpeg":
          case "image/jpg":
            extension = ".jpg";
            break;

          default:
            return res.status(403).json({ message: "Incorect image type!" });
        }

        const oldpath = files.image.path;
        const newpath =
          root + "/public/images/profile/" + fields.nik + extension;

        fs.rename(oldpath, newpath, (err) => {
          if (err) throw err;
          req.body.image = `${req.protocol}://${
            req.headers.host
          }/images/profile/${fields.nik + extension}`;
          next();
        });
      } else {
        req.body.image = "";
        next();
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json(err);
  }
}

module.exports = router;
