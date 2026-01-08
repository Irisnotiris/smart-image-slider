/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                cream: '#FDFBF7',
                'primary-green': '#A3E635', // Lime-400 ish
                'primary-blue': '#60A5FA',
                'primary-pink': '#F472B6',
            },
            boxShadow: {
                'hard': '4px 4px 0px 0px #000000',
                'hard-hover': '6px 6px 0px 0px #000000',
                'hard-active': '2px 2px 0px 0px #000000',
                'hard-sm': '2px 2px 0px 0px #000000',
            },
            borderRadius: {
                'hand': '255px 15px 225px 15px / 15px 225px 15px 255px', // Wobbly effect? Maybe too complex for CSS, stick with large rounded.
            }
        },
    },
    plugins: [],
}
