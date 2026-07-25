/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0F62FE',
          light: '#4589FF',
          dark: '#0043CE',
        },
        customer: '#0F62FE',
        driver: '#12805C',
        surface: '#FFFFFF',
        'surface-dark': '#111318',
        muted: '#6B7280',
        danger: '#DC2626',
        success: '#12805C',
        warning: '#D97706',
        textPrimary: '#111318',
        textSecondary: '#6B7280',
        border: '#E5E7EB',
      },
    },
  },
  plugins: [],
};
