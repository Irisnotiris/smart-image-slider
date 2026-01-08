
export interface ProcessConfig {
    removeWhite: boolean;
    addStroke: boolean;
    strokeWidth?: number;
    strokeColor?: string;
}

const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
};

export const processImage = async (src: string, config: ProcessConfig): Promise<string> => {
    const img = await loadImage(src);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error("No Context");

    let finalW = img.naturalWidth;
    let finalH = img.naturalHeight;

    // Add padding if stroke is enabled to prevent clipping
    // Shadow Blur extends a bit more than strict width, so add extra buffer.
    const rawStrokeW = config.strokeWidth || 6;
    // Boost the visual weight: 2x multiplier so "10" feels like "20"
    const strokeW = rawStrokeW * 2;
    const padding = config.addStroke ? strokeW + 4 : 0;

    canvas.width = finalW + padding * 2;
    canvas.height = finalH + padding * 2;

    const drawX = padding;
    const drawY = padding;

    // 1. Draw Original
    ctx.drawImage(img, drawX, drawY);

    // 2. Remove White Background (Flood Fill)
    if (config.removeWhite) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        // BFS Queue for Flood Fill
        // We'll store indices (y * width + x)
        const queue: number[] = [];
        const visited = new Uint8Array(width * height); // 0 = unvisited, 1 = visited

        // Check if pixel at (x,y) is white-ish OR transparent (traversable)
        const shouldVisit = (idx: number) => {
            const r = data[idx * 4];
            const g = data[idx * 4 + 1];
            const b = data[idx * 4 + 2];
            const a = data[idx * 4 + 3];

            // IF it's transparent, we can swim through it (it's background)
            if (a < 20) return true;

            // IF it's solid, it must be white to be considered background
            return r > 240 && g > 240 && b > 240;
        };

        // Seed with border pixels
        // Top & Bottom rows
        for (let x = 0; x < width; x++) {
            const idxTop = x;
            const idxBottom = (height - 1) * width + x;
            if (shouldVisit(idxTop)) { queue.push(idxTop); visited[idxTop] = 1; }
            if (shouldVisit(idxBottom)) { queue.push(idxBottom); visited[idxBottom] = 1; }
        }
        // Left & Right cols
        for (let y = 0; y < height; y++) {
            const idxLeft = y * width;
            const idxRight = y * width + (width - 1);
            if (visited[idxLeft] === 0 && shouldVisit(idxLeft)) { queue.push(idxLeft); visited[idxLeft] = 1; }
            if (visited[idxRight] === 0 && shouldVisit(idxRight)) { queue.push(idxRight); visited[idxRight] = 1; }
        }

        // Process Queue
        let head = 0;
        while (head < queue.length) {
            const idx = queue[head++];

            // "Remove" pixel (set alpha to 0)
            data[idx * 4 + 3] = 0;

            const cx = idx % width;
            // Unused: const cy = Math.floor(idx / width);

            // Neighbors (Up, Down, Left, Right)
            const neighbors = [
                idx - width, // Up
                idx + width, // Down
                (cx > 0) ? idx - 1 : -1, // Left
                (cx < width - 1) ? idx + 1 : -1 // Right
            ];

            for (const nIdx of neighbors) {
                if (nIdx >= 0 && nIdx < visited.length && visited[nIdx] === 0) {
                    // Check if neighbor is background (white or transparent)
                    if (shouldVisit(nIdx)) {
                        visited[nIdx] = 1;
                        queue.push(nIdx);
                    }
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }

    // 3. Add Smooth Stroke (Shadow Method)
    if (config.addStroke) {
        // Create a silhouette canvas (mask of non-transparent pixels)
        const sCanvas = document.createElement('canvas');
        sCanvas.width = canvas.width;
        sCanvas.height = canvas.height;
        const sCtx = sCanvas.getContext('2d');
        if (!sCtx) throw new Error("No Context");

        // Prepare silhouette
        // Draw the matted image
        sCtx.drawImage(canvas, 0, 0);

        // Composite 'source-in' with color -> This makes the content solid color
        sCtx.globalCompositeOperation = 'source-in';
        sCtx.fillStyle = config.strokeColor || '#FFFFFF';
        sCtx.fillRect(0, 0, sCanvas.width, sCanvas.height);

        // Create Final Canvas
        const fCanvas = document.createElement('canvas');
        fCanvas.width = canvas.width;
        fCanvas.height = canvas.height;
        const fCtx = fCanvas.getContext('2d');
        if (!fCtx) throw new Error("No Context");

        // Enable shadow
        fCtx.shadowColor = config.strokeColor || '#FFFFFF';
        fCtx.shadowBlur = strokeW; // Removed dampener for thicker stroke

        // Stack shadows to make it solid
        // Draw the SILHOUETTE with shadow
        // Stacking too many times causes lag, 5-8 is usually enough for a hard edge look
        const passes = 12; // Increase passes slightly to ensure opacity with tighter blur
        for (let i = 0; i < passes; i++) {
            fCtx.drawImage(sCanvas, 0, 0);
        }

        // Disable shadow to draw original image on top
        fCtx.shadowColor = 'transparent';
        fCtx.shadowBlur = 0;

        // Composite original image on top
        fCtx.drawImage(canvas, 0, 0);

        return fCanvas.toDataURL('image/png');
    }

    return canvas.toDataURL('image/png');
};
