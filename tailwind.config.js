/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
  ],
  safelist: [
    {
      pattern: /w-(4|5|7|10)/,
      variants: ['sm', 'md'],
    },
    {
      pattern: /bg-(gray|red|orange|yellow|green|cyan|blue|indigo|purple|violet|fuchsia|pink)-(500|600|700|800)/,
      variants: ['hover', 'dark'],
    },
  ],
  theme: {
    extend: {
    },
  },
  plugins: [
    'gatsby-plugin-postcss',
  ],
}