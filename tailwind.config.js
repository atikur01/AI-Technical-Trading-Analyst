module.exports = {
  content: ['./Features/**/*.cshtml', './Shared/**/*.cshtml', './wwwroot/js/**/*.js'],
  safelist: [{ pattern: /^badge-/ }],
  theme: {
    extend: {
      colors: {
        tv: {
          bg: '#0b0e14',
          panel: '#11151d',
          raised: '#171c27',
          border: '#1f2633',
          text: '#e6e9f0',
          muted: '#7d8699',
          up: '#22c997',
          down: '#f6465d',
          accent: '#4f7cff',
          violet: '#8b5cf6'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(79, 124, 255, 0.55)',
        float: '0 12px 32px -8px rgba(0, 0, 0, 0.6)'
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(-4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' }
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.7)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'slide-in': 'slide-in 0.3s ease-out both',
        pop: 'pop 0.15s ease-out both',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        scan: 'scan 2.4s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
