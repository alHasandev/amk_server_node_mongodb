const root = require("../../root");

const header = (title) => {
  return {
    style: "table",
    table: {
      widths: ["auto", "*"],
      headerRows: 1,
      body: [
        [
          {
            image: root + "/assets/images/logo/logo-frontweb.png",
            width: 80,
            alignment: "center",
            border: [false, false, false, true],
          },
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text:
                      "Aplikasi Manajemen Karyawan Hotel Pyramid Banjarmasin",
                    style: "header",
                    alignment: "center",
                  },
                ],
                [
                  {
                    text:
                      "Pyramid Suites Hotel Banjarmasin. Alamat, Jl. Skip Lama No. 8, Banjarmasin, Banjarmasin Tengah, Kalimantan Selatan, Indonesia.",
                    style: "subheader",
                    alignment: "center",
                  },
                ],
                [
                  {
                    text: title,
                    style: "title",
                    alignment: "center",
                  },
                ],
              ],
            },
            layout: { defaultBorder: false },
            border: [false, false, false, true],
          },
        ],
      ],
    },
    layout: {
      defaultBorder: false,
    },
  };
};

module.exports = header;
