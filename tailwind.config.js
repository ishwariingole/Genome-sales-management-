/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: {
          canvas: '#0B1120',
          card: '#131D33',
          cardLight: '#18243F',
          well: '#0A0F1D',
          subtle: '#1C2844',
          hover: '#223255',
          border: '#233252',
          borderLight: '#32456E',
        },
        vibrant: {
          blue: '#387BFF',
          cyan: '#06B6D4',
          sky: '#38BDF8',
          purple: '#8B5CF6',
          violet: '#7C3AED',
          magenta: '#D946EF',
          pink: '#EC4899',
          rose: '#F43F5E',
          mint: '#10E599',
          emerald: '#10B981',
          amber: '#F59E0B',
        },
        brand: {
          dark: '#0B1120',
          surface: '#131D33',
          border: '#233252',
          accent: '#387BFF',
          purple: '#8B5CF6',
          pink: '#EC4899',
          mint: '#10E599',
          success: '#10B981',
          danger: '#F43F5E'
        }
      }
    },
  },
  plugins: [],
}
