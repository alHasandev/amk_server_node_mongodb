function currency(amount, localId, currencyCode) {
  return new Intl.NumberFormat(localId, {
    style: "currency",
    currency: currencyCode,
  })
    .format(amount)
    .replace(".00", "")
    .replace(/(\,)/g, ".")
    .replace("IDR", "Rp.");
}

const IDR = (amount) => currency(amount, "id-ID", "IDR");

const currToNumber = (currency) =>
  Number(currency.replace(/[^0-9,]/g, "").replace(/[,]/g, "."));

module.exports = {
  currency,
  IDR,
  currToNumber,
};
