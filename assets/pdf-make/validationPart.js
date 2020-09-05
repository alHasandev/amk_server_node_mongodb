module.exports = function (validation1, validation2) {
  let widths = ["*", 150];
  let body;

  if (validation2) {
    widths = ["*", 100, "*"];
    body = [
      [
        {
          text: validation1.positionName,
          style: "tableHeader",
          alignment: "center",
        },
        "",
        {
          text: validation2.positionName,
          style: "tableHeader",
          alignment: "center",
        },
      ],
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
      [
        {
          text: validation1.username,
          alignment: "center",
        },
        "",
        {
          text: validation2.username,
          alignment: "center",
        },
      ],
      [
        {
          text: validation1.nik,
          style: "subtitle",
          alignment: "center",
        },
        "",
        {
          text: validation2.nik,
          style: "subtitle",
          alignment: "center",
        },
      ],
    ];
  } else {
    body = [
      [
        "",
        {
          text: validation1.positionName,
          style: "tableHeader",
          alignment: "center",
        },
      ],
      ["", ""],
      ["", ""],
      ["", ""],
      ["", ""],
      ["", ""],
      ["", ""],
      [
        "",
        {
          text: validation1.username,
          alignment: "center",
        },
      ],
      [
        "",
        {
          text: validation1.nik,
          style: "subtitle",
          alignment: "center",
        },
      ],
    ];
  }

  return {
    style: "table",
    table: {
      widths: widths,
      body: body,
    },
    layout: {
      defaultBorder: false,
    },
  };
};
