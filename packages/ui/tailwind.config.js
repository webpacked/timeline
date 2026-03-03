/**
 * Tailwind CSS Preset for @timeline/ui
 * 
 * This preset includes the color palette and utilities used by
 * the timeline UI components.
 * 
 * Usage in your tailwind.config.js:
 * 
 * ```js
 * module.exports = {
 *   presets: [
 *     require('@timeline/ui/tailwind.config.js')
 *   ],
 *   content: [
 *     './node_modules/@timeline/ui/dist/**\/*.{js,ts,jsx,tsx}',
 *     // ... your content paths
 *   ],
 * }
 * ```
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Timeline UI uses the zinc color palette extensively
        // These are already part of Tailwind's default theme,
        // but we document them here for clarity
        zinc: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
      },
      // Timeline-specific utilities can be added here
      spacing: {
        // Any custom spacing values used by timeline components
      },
    },
  },
  plugins: [],
};
