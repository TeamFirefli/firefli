/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: 'class',
	content: [
	  "./pages/**/*.{js,ts,jsx,tsx}",
	  "./components/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
	  extend: {
		colors: {
		  tovybg: "#3498db",
		  orbit: "#3498db",
		  primary: 'rgb(var(--group-theme) / <alpha-value>)',
		},
	  },
	},
	plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
  };
  