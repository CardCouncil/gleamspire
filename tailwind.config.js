/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ivory: {
          DEFAULT: '#FDFDEF',
          100: '#57570b',
          200: '#aeae16',
          300: '#e7e73f',
          400: '#f2f296',
          500: '#fdfdef',
          600: '#fdfdf0',
          700: '#fefef4',
          800: '#fefef8',
          900: '#fffffb'
        },
        'peach-yellow': {
          DEFAULT: '#FCDDA3',
          100: '#503502',
          200: '#a06a05',
          300: '#f09f07',
          400: '#fabf51',
          500: '#fcdda3',
          600: '#fde3b4',
          700: '#fdeac7',
          800: '#fef1d9',
          900: '#fef8ec'
        },
        kobicha: {
          DEFAULT: '#78502A',
          100: '#181008',
          200: '#302011',
          300: '#483019',
          400: '#614022',
          500: '#78502a',
          600: '#ac723c',
          700: '#c99565',
          800: '#dbb998',
          900: '#eddccc'
        },
        xanthous: {
          DEFAULT: '#EBB229',
          100: '#322505',
          200: '#654909',
          300: '#976e0e',
          400: '#ca9313',
          500: '#ebb229',
          600: '#efc053',
          700: '#f3d07e',
          800: '#f7e0a9',
          900: '#fbefd4'
        }
      }
    },
  },
  plugins: [
    function({ addUtilities, theme }) {
      // Add text-stroke-width utilities
      const strokeWidthUtilities = {
        '.text-stroke-1': {
          '-webkit-text-stroke-width': '1px',
        },
        '.text-stroke-2': {
          '-webkit-text-stroke-width': '2px',
        },
        '.text-stroke-3': {
          '-webkit-text-stroke-width': '3px',
        },
        '.text-stroke-4': {
          '-webkit-text-stroke-width': '4px',
        },
        '.text-stroke-5': {
          '-webkit-text-stroke-width': '5px',
        },
      };
      
      addUtilities(strokeWidthUtilities);
      
      // Add text-stroke-color utilities based on the theme colors
      const colors = theme('colors');
      const strokeColorUtilities = {};
      
      // Process the color object
      Object.entries(colors).forEach(([colorName, colorValue]) => {
        if (typeof colorValue === 'object') {
          // Handle color objects (with variants like 100, 200, etc.)
          Object.entries(colorValue).forEach(([shade, shadeValue]) => {
            if (shade === 'DEFAULT') {
              strokeColorUtilities[`.text-stroke-${colorName}`] = {
                '-webkit-text-stroke-color': shadeValue,
              };
            } else {
              strokeColorUtilities[`.text-stroke-${colorName}-${shade}`] = {
                '-webkit-text-stroke-color': shadeValue,
              };
            }
          });
        } else {
          // Handle simple color strings
          strokeColorUtilities[`.text-stroke-${colorName}`] = {
            '-webkit-text-stroke-color': colorValue,
          };
        }
      });
      
      addUtilities(strokeColorUtilities);
    },
  ],
}