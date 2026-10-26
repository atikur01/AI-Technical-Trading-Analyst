module.exports = {
  content: ['./Features/**/*.cshtml', './Shared/**/*.cshtml', './wwwroot/js/**/*.js'],
  safelist: [{ pattern: /^badge-/ }],
  theme: {
    extend: {
      colors: {
        tv: {
          bg: '#131722',
          panel: '#1e222d',
          border: '#2a2e39',
          text: '#d1d4dc',
          muted: '#787b86',
          up: '#26a69a',
          down: '#ef5350',
          accent: '#2962ff'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Trebuchet MS', 'Roboto', 'Ubuntu', 'sans-serif']
      }
    }
  },
  plugins: []
};
