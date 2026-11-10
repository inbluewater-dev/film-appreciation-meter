/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Pretendard', '"Noto Sans KR"', '"Noto Sans CJK KR"', '"Malgun Gothic"', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
