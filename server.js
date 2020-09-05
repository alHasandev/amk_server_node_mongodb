if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// Init express app
const app = express();
app.use(cors());

// Init mongoose
mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
});

const db = mongoose.connection;
db.on("error", (err) => console.error(err));
db.once("open", () => console.log("Connected to mongodb database!"));

// Use express middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Import routers
const authRouter = require("./routes/auth");
const userRouter = require("./routes/users");
const recruitmentRouter = require("./routes/recruitments");
const departmentRouter = require("./routes/departments");
const positionRouter = require("./routes/positions");
const profileRouter = require("./routes/profiles");
const employeeRouter = require("./routes/employees");
const attendanceRouter = require("./routes/attendances");
const requestRouter = require("./routes/requests");
const candidateRouter = require("./routes/candidates");
const assessmentRouter = require("./routes/assessments");
const payloadRouter = require("./routes/payloads");

app.get("/", (req, res) => {
  return res.json({
    message: "NodeServer served successfully!!",
  });
});

// Use routers
app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/recruitments", recruitmentRouter);
app.use("/departments", departmentRouter);
app.use("/positions", positionRouter);
app.use("/profiles", profileRouter);
app.use("/employees", employeeRouter);
app.use("/attendances", attendanceRouter);
app.use("/requests", requestRouter);
app.use("/candidates", candidateRouter);
app.use("/assessments", assessmentRouter);
app.use("/payloads", payloadRouter);

app.listen(process.env.PORT || 5000, () =>
  console.log(`Server is running on port: ${process.env.PORT || 5000}`)
);
