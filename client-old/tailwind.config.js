/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    fontFamily: {
      railway: "'Raleway', sans-serif",
      // kabel: "'Kabel Black', sans-serif",
      roboto: "'Roboto', sans-serif",
      montserrat: "'Montserrat', sans-serif",
      baskerville: '"Libre Baskerville", serif',
      workSans: '"Work Sans", sans-serif',
    },
    extend: {},
  },
  plugins: [require("daisyui")],
};
