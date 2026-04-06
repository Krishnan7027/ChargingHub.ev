import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eefbf3',
          100: '#d6f5e0',
          200: '#b0eac6',
          300: '#7dd9a5',
          400: '#48c280',
          500: '#26a866',
          600: '#178750',
          700: '#136c42',
          800: '#125636',
          900: '#10472e',
          950: '#08281a',
        },
        accent: {
          50: '#f0f7ff',
          100: '#e0eefe',
          200: '#b9ddfe',
          300: '#7cc3fd',
          400: '#36a5fa',
          500: '#0c89eb',
          600: '#006dc9',
          700: '#0056a3',
          800: '#054a86',
          900: '#0a3f6f',
        },
      },
    },
  },
  plugins: [],
};

export default config;
