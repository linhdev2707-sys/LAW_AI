import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // shadcn tokens (kept for app pages)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // Landing page brand palette — extracted from logo.jpg
        // Logo: deep navy background + electric blue/cyan shield + white scales + gold dots
        brand: {
          // Background scale (deep → mid navy)
          background: '#001233',
          surface: '#001233',
          'surface-dim': '#000d27',
          'surface-container': '#001a40',
          'surface-container-low': '#00173a',
          'surface-container-lowest': '#00091f',
          'surface-container-high': '#002553',
          'surface-container-highest': '#00306b',
          'surface-bright': '#0a3373',
          'surface-variant': '#0e2a5c',
          'surface-tint': '#7dd3fc',

          // Primary — electric sky blue (matches shield's bright highlight)
          primary: '#0ea5e9',
          'primary-container': '#0c4a6e',
          'on-primary': '#ffffff',
          'on-primary-container': '#bae6fd',
          'on-primary-fixed': '#0c1a2b',
          'on-primary-fixed-variant': '#075985',
          'primary-fixed': '#e0f2fe',
          'primary-fixed-dim': '#7dd3fc',

          // Secondary — gold (matches the three dots in the chat bubble)
          secondary: '#fbbf24',
          'secondary-container': '#78350f',
          'on-secondary': '#1f1500',
          'on-secondary-container': '#fde68a',
          'secondary-fixed': '#fef3c7',
          'secondary-fixed-dim': '#fbbf24',
          'on-secondary-fixed': '#1a1100',
          'on-secondary-fixed-variant': '#92400e',

          // Tertiary — cyan glow (logo's brightest highlight)
          tertiary: '#22d3ee',
          'tertiary-container': '#083344',
          'on-tertiary': '#001a20',
          'on-tertiary-container': '#67e8f9',
          'tertiary-fixed': '#cffafe',
          'tertiary-fixed-dim': '#22d3ee',
          'on-tertiary-fixed': '#001014',
          'on-tertiary-fixed-variant': '#155e75',

          error: '#fca5a5',
          'error-container': '#7f1d1d',
          'on-error': '#450a0a',
          'on-error-container': '#fecaca',

          outline: '#7dd3fc',
          'outline-variant': 'rgba(125, 211, 252, 0.18)',

          // "on-X" — readable colors on dark navy surfaces
          'on-surface': '#e0f2fe',
          'on-surface-variant': '#94a3b8',
          'on-background': '#e0f2fe',
          'inverse-primary': '#0c4a6e',
          'inverse-surface': '#e0f2fe',
          'inverse-on-surface': '#001233',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        headline: ['var(--font-playfair)', 'Georgia', 'serif'],
        'material-symbols': ['"Material Symbols Outlined"'],
      },
      fontSize: {
        'display-lg-mobile': ['40px', { lineHeight: '1.2', fontWeight: '700' }],
        'display-lg': ['64px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['32px', { lineHeight: '1.3', fontWeight: '600' }],
        'headline-lg': ['48px', { lineHeight: '1.2', fontWeight: '600' }],
        'body-md': ['16px', { lineHeight: '1.6', fontWeight: '400' }],
        'body-lg': ['18px', { lineHeight: '1.6', fontWeight: '400' }],
        'label-sm': ['12px', { lineHeight: '1.0', fontWeight: '500' }],
        'label-md': ['14px', { lineHeight: '1.0', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      spacing: {
        'section-padding': '120px',
        'container-max': '1280px',
        'stack-lg': '64px',
        'stack-md': '32px',
        'stack-sm': '16px',
        unit: '8px',
        'margin-mobile': '20px',
        'margin-desktop': '80px',
        gutter: '24px',
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.5rem',
        full: '0.75rem',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        // Slides content from right (0%) to left (-50%). Use with a
        // doubled track so the loop is seamless.
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        marquee: 'marquee 20s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
