/* eslint-disable no-undef */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    fontFamily: {
      caslon: "'Libre Caslon Text', serif",
      raleway: ["Raleway", "sans-serif"],
      oswald: "Oswald, sans-serif",
    },
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light", "dark", "retro", "bumblebee"],
  },
};
