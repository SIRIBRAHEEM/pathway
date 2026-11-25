/** @type {import('tailwindcss').Config} */
// Pathway design system tokens (shadcn-style): one palette built around
// ink navy, one type scale, one radius and shadow scale, used everywhere.
// Palette method: Coolors-style expansion of a single base colour
// (ink navy #1b2a4a) into background, card, border and accent tokens.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#f4f6f9',
        foreground: '#16233d',
        card: '#ffffff',
        muted: '#eef1f6',
        'muted-foreground': '#5c6a82',
        border: '#dde3ec',
        'border-strong': '#c6cfdd',
        primary: '#1b2a4a',
        'primary-hover': '#24355c',
        'primary-soft': '#e8edf5',
        accent: '#d97706',
        'accent-strong': '#b45309',
        'accent-soft': '#fdf0dc',
        'accent-border': '#f0d5a3',
        teal: '#0e7c86',
        'teal-soft': '#e2f2f4',
        success: '#1f7a4d',
        'success-soft': '#e6f4ec',
        'success-border': '#bfe0cd',
        danger: '#b3261e',
        'danger-soft': '#fdecea',
        'danger-border': '#f0c4c0',
        inkdeep: '#101a30',
        'inkdeep-soft': '#8fa3c4',
        'inkdeep-border': '#2a3c61',
      },
      fontFamily: {
        display: ['Archivo', '"Public Sans"', 'system-ui', 'sans-serif'],
        body: ['"Public Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '14px',
        control: '9px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(22,35,61,0.05), 0 1px 3px rgba(22,35,61,0.06)',
        md: '0 4px 14px rgba(22,35,61,0.08), 0 2px 4px rgba(22,35,61,0.05)',
        lg: '0 14px 34px rgba(22,35,61,0.13), 0 4px 10px rgba(22,35,61,0.06)',
        node: '0 1px 3px rgba(22,35,61,0.10), 0 4px 10px rgba(22,35,61,0.06)',
      },
    },
  },
  plugins: [],
};
