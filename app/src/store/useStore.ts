import { create } from 'zustand';

interface AppState {
    file: File | null;
    imageUrl: string | null;
    step: 'upload' | 'editor' | 'gallery';
    grid: {
        rows: number;
        cols: number;
        inset: number;
    };
    // Outer Crop Rect (percentages: 0-100)
    crop: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    gridLines: {
        v: number[]; // Percentages 0-100 relative to the CROP box
        h: number[];
    };

    setFile: (file: File) => void;
    reset: () => void;
    setStep: (step: AppState['step']) => void;
    setGridConfig: (rows: number, cols: number) => void;
    setGridLines: (v: number[], h: number[]) => void;
    setCrop: (crop: { x: number, y: number, w: number, h: number }) => void;
}

export const useStore = create<AppState>((set) => ({
    file: null,
    imageUrl: null,
    step: 'upload',
    grid: {
        rows: 4,
        cols: 4,
        inset: 0,
    },
    crop: { x: 0, y: 0, w: 100, h: 100 },
    gridLines: {
        v: [],
        h: []
    },

    setFile: (file) => {
        const url = URL.createObjectURL(file);
        set({ file, imageUrl: url, step: 'editor' });
    },

    reset: () => set((state) => {
        if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
        return {
            file: null,
            imageUrl: null,
            step: 'upload',
            grid: { rows: 4, cols: 4, inset: 0 },
            crop: { x: 0, y: 0, w: 100, h: 100 },
            gridLines: { v: [], h: [] }
        };
    }),

    setStep: (step) => set({ step }),

    setGridConfig: (rows, cols) => set((state) => {
        const v = Array.from({ length: cols - 1 }, (_, i) => ((i + 1) / cols) * 100);
        const h = Array.from({ length: rows - 1 }, (_, i) => ((i + 1) / rows) * 100);
        return {
            grid: { ...state.grid, rows, cols },
            gridLines: { v, h }
        };
    }),

    setGridLines: (v, h) => set({
        gridLines: { v, h }
    }),

    setCrop: (crop) => set({ crop }),
}));
