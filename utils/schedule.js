const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");

const checkAttendance = async (date) => {
  try {
    const attendances = await Attendance.find({ date: date });
    const employeeIds = attendances.map((attendance) => attendance.employee);
    const absenceEmployees = await Employee.find({
      _id: {
        $nin: employeeIds,
      },
    });
    return absenceEmployees;
  } catch (err) {
    console.log(err);
    return err;
  }
};

const forceAbsence = async (date) => {
  try {
    const employees = await checkAttendance(date);

    const newAttendances = employees.map((employee) => {
      return {
        employee: employee._id,
        date: date,
        status: "absence",
        description: "tanpa keterangan",
      };
    });

    const result = await Attendance.insertMany(newAttendances);
    return result;
  } catch (err) {
    console.log(err);
    return err;
  }
};

module.exports = forceAbsence;
