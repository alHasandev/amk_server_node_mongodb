export const printScreen = async () => {
  return new Promise((resolve) => {
    window.print();
    setTimeout(() => {
      resolve(window.close);
    }, 1000);
  });
};
