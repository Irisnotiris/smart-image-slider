
export interface ProcessConfig {
    removeWhite: boolean;
    addStroke: boolean;
    strokeWidth?: number;
    strokeColor?: string;
    filter?: string | null;
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

const applyFilter = (ctx: CanvasRenderingContext2D, width: number, height: number, filter: string) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    switch (filter) {
        case 'grayscale': // 黑白
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue; // Skip transparent pixels
                const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                data[i] = data[i + 1] = data[i + 2] = gray;
            }
            break;

        case 'sepia': // 怀旧
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue; // Skip transparent pixels
                const r = data[i], g = data[i + 1], b = data[i + 2];
                data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
                data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
                data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
            }
            break;

        case 'brightness': // 增亮
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue; // Skip transparent pixels
                data[i] = Math.min(255, data[i] + 30);
                data[i + 1] = Math.min(255, data[i + 1] + 30);
                data[i + 2] = Math.min(255, data[i + 2] + 30);
            }
            break;

        case 'vibrant': // 鲜艳
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue; // Skip transparent pixels
                const r = data[i], g = data[i + 1], b = data[i + 2];

                // Calculate saturation boost
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const delta = max - min;

                if (delta > 0) {
                    const saturationBoost = 1.4; // Increase saturation by 40%
                    const avg = (r + g + b) / 3;
                    data[i] = Math.min(255, avg + (r - avg) * saturationBoost);
                    data[i + 1] = Math.min(255, avg + (g - avg) * saturationBoost);
                    data[i + 2] = Math.min(255, avg + (b - avg) * saturationBoost);
                }
            }
            break;

        case 'cinematic': // 电影感
            // Step 1: Reduce saturation
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                const gray = r * 0.299 + g * 0.587 + b * 0.114;
                data[i] = gray + (r - gray) * 0.6;
                data[i + 1] = gray + (g - gray) * 0.6;
                data[i + 2] = gray + (b - gray) * 0.6;
            }

            // Step 2: Teal/Orange color grading (shadows blue, highlights orange)
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                const luminance = r * 0.299 + g * 0.587 + b * 0.114;

                if (luminance < 128) {
                    // Shadows: add teal (cyan/blue)
                    data[i] = Math.max(0, r - 10);
                    data[i + 1] = Math.min(255, g + 5);
                    data[i + 2] = Math.min(255, b + 15);
                } else {
                    // Highlights: add orange
                    data[i] = Math.min(255, r + 15);
                    data[i + 1] = Math.min(255, g + 5);
                    data[i + 2] = Math.max(0, b - 10);
                }
            }

            // Step 3: Add vignette
            const centerX = width / 2;
            const centerY = height / 2;
            const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;
                    if (data[i + 3] === 0) continue;
                    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                    const vignette = 1 - (dist / maxDist) * 0.5;
                    data[i] *= vignette;
                    data[i + 1] *= vignette;
                    data[i + 2] *= vignette;
                }
            }
            break;

        case 'japanese': // 日系 (high exposure, low contrast, cool tone)
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue; // Skip transparent pixels
                let r = data[i], g = data[i + 1], b = data[i + 2];

                // Increase brightness (high exposure)
                r = Math.min(255, r + 40);
                g = Math.min(255, g + 40);
                b = Math.min(255, b + 40);

                // Reduce contrast (flatten)
                const avg = (r + g + b) / 3;
                r = avg + (r - avg) * 0.7;
                g = avg + (g - avg) * 0.7;
                b = avg + (b - avg) * 0.7;

                // Cool tone (add blue, reduce red)
                r = Math.max(0, r - 10);
                b = Math.min(255, b + 15);

                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
            }
            break;

        case 'warm': // 暖色调
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] === 0) continue; // Skip transparent pixels
                let r = data[i], g = data[i + 1], b = data[i + 2];

                // Add warm tones (orange/red)
                r = Math.min(255, r + 25);
                g = Math.min(255, g + 10);
                b = Math.max(0, b - 15);

                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
            }
            break;
    }

    ctx.putImageData(imageData, 0, 0);
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

    // 2. Remove White Background (Flood Fill) - BEFORE filter to ensure accuracy
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

    // 3. Apply Filter (AFTER matting to preserve transparency)
    if (config.filter) {
        applyFilter(ctx, canvas.width, canvas.height, config.filter);
    }

    // 4. Add Smooth Stroke (Shadow Method)
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

    // 4. Add Smooth Stroke (Shadow Method)
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
