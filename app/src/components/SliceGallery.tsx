import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Download, Wand2, PenTool, Loader2, Clock, X, Edit2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { FineTuner } from './FineTuner';
import { cn } from '../utils/cn';
import { processImage } from '../utils/canvasProcessor';

type SliceStatus = 'idle' | 'pending' | 'processing' | 'done';

interface SliceItem {
    id: string;
    originalSrc: string; // Base64 or BlobURL of raw crop
    rect: { x: number, y: number, w: number, h: number };
    processedSrc?: string;
    status: SliceStatus;
}

export const SliceGallery: React.FC = () => {
    const { imageUrl, gridLines, crop, setStep } = useStore();

    // Data
    const [slices, setSlices] = useState<SliceItem[]>([]);

    // Config
    const [enableMatting, setEnableMatting] = useState(false);
    const [enableStroke, setEnableStroke] = useState(false);
    const [strokeWidth, setStrokeWidth] = useState(6);
    const [filter, setFilter] = useState<string | null>(null);

    // UI
    const [isExporting, setIsExporting] = useState(false);
    const [selectedSliceIndex, setSelectedSliceIndex] = useState<number | null>(null); // For FineTuner
    const [previewSliceIndex, setPreviewSliceIndex] = useState<number | null>(null); // For Lightbox

    // Queue State: We track WHICH index is currently processing.
    // Using an explicit state pointer avoids complex loop conditions.
    const [processingIndex, setProcessingIndex] = useState<number | null>(null);

    // Stats
    const pendingCount = slices.filter(s => s.status === 'pending').length;
    const doneCount = slices.filter(s => s.status === 'done').length;
    const totalCount = slices.length;

    // 1. Initial Generation
    useEffect(() => {
        if (!imageUrl) return;
        const timeout = setTimeout(() => {
            const generateSlices = async () => {
                const img = new Image();
                img.src = imageUrl;
                await new Promise((resolve) => { img.onload = resolve; });

                const width = img.naturalWidth;
                const height = img.naturalHeight;
                const cx = (crop.x / 100) * width;
                const cy = (crop.y / 100) * height;
                const cw = (crop.w / 100) * width;
                const ch = (crop.h / 100) * height;

                const xPos = [0, ...gridLines.v.map(p => (p / 100) * cw), cw].sort((a, b) => a - b);
                const yPos = [0, ...gridLines.h.map(p => (p / 100) * ch), ch].sort((a, b) => a - b);

                const newSlices: SliceItem[] = [];
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                let count = 0;
                for (let r = 0; r < yPos.length - 1; r++) {
                    for (let c = 0; c < xPos.length - 1; c++) {
                        const rx = xPos[c];
                        const ry = yPos[r];
                        const rw = xPos[c + 1] - rx;
                        const rh = yPos[r + 1] - ry;

                        if (rw <= 0 || rh <= 0) continue;

                        const sourceX = cx + rx;
                        const sourceY = cy + ry;

                        // Snap to integer pixels to avoid sub-pixel blurring
                        const canvasW = Math.round(rw);
                        const canvasH = Math.round(rh);

                        canvas.width = canvasW;
                        canvas.height = canvasH;
                        ctx.clearRect(0, 0, canvasW, canvasH);
                        ctx.drawImage(img, sourceX, sourceY, rw, rh, 0, 0, canvasW, canvasH);

                        newSlices.push({
                            id: `slice-${count++}-${Date.now()}`,
                            originalSrc: canvas.toDataURL('image/png'),
                            rect: { x: sourceX, y: sourceY, w: rw, h: rh },
                            status: 'idle'
                        });
                    }
                }
                setSlices(newSlices);
                setProcessingIndex(null);
            };
            generateSlices();
        }, 100);
        return () => clearTimeout(timeout);
    }, [imageUrl, gridLines, crop]);


    // 2. Queue Manager: Assign tasks
    useEffect(() => {
        // If Config Disabled: clear processed
        if (!enableMatting && !enableStroke) {
            setSlices(prev => prev.map(s => ({ ...s, status: 'idle', processedSrc: undefined })));
            setProcessingIndex(null);
            return;
        }

        // Config Changed: Reset all to pending
        // Debouncing logic could go here, but since operations are fast, we just reset.
        setSlices(prev => prev.map(s => ({ ...s, status: 'pending' })));
        setProcessingIndex(null); // Stop current

    }, [enableMatting, enableStroke, strokeWidth, filter]);

    // 3. Queue Loop: Finder
    useEffect(() => {
        // Only look for work if NOT currently processing
        if (processingIndex !== null) return;
        if (!enableMatting && !enableStroke) return;

        const nextIndex = slices.findIndex(s => s.status === 'pending');
        if (nextIndex !== -1) {
            setProcessingIndex(nextIndex);
        }
    }, [slices, processingIndex, enableMatting, enableStroke, strokeWidth]);

    // 4. Queue Loop: Processor
    // We separate Finder and Processor to ensure state updates propagate.
    useEffect(() => {
        if (processingIndex === null) return;

        let isMounted = true;

        const execute = async () => {
            // 1. Mark as Processing in UI
            setSlices(prev => {
                const next = [...prev];
                next[processingIndex] = { ...next[processingIndex], status: 'processing' };
                return next;
            });

            try {
                // 2. Do the work
                // Important: Read from 'slices[processingIndex]' is risky inside async ref if slices changed?
                // Ideally we pass the data needed.
                // We can get the latest slice from the setter callback or just trust the index if list is stable.
                // Since we don't delete slices, index is stable. The 'originalSrc' is stable.

                // However, 'slices' in this scope is from render.
                // Let's use functional update to be safe, or just grab the item from current 'slices' deps.
                const currentSlice = slices[processingIndex];
                if (!currentSlice) {
                    setProcessingIndex(null); // abort
                    return;
                }

                const result = await processSingleSlice(currentSlice.originalSrc, enableMatting, enableStroke);

                if (isMounted) {
                    setSlices(prev => {
                        const next = [...prev];
                        next[processingIndex] = { ...next[processingIndex], status: 'done', processedSrc: result };
                        return next;
                    });
                }
            } catch (e) {
                console.error("Slice failed", e);
                if (isMounted) {
                    setSlices(prev => {
                        const next = [...prev];
                        next[processingIndex] = { ...next[processingIndex], status: 'idle' }; // Error state?
                        return next;
                    });
                }
            } finally {
                // 3. Complete -> Release lock
                if (isMounted) {
                    setProcessingIndex(null);
                }
            }
        };

        execute();

        return () => { isMounted = false; };
    }, [processingIndex]); // Only re-run when index changes. NOT when slices changes (avoids loop).


    const processSingleSlice = async (src: string, matting: boolean, stroke: boolean) => {
        // Use the new Canvas Processor (Instant & Organic Stroke)
        return await processImage(src, {
            removeWhite: matting,
            addStroke: stroke,
            strokeWidth: strokeWidth,
            strokeColor: '#FFFFFF',
            filter: filter
        });
    };

    const handleUpdateSlice = (newSrc: string) => {
        if (selectedSliceIndex !== null) {
            setSlices(prev => {
                const updated = [...prev];
                updated[selectedSliceIndex] = {
                    ...updated[selectedSliceIndex],
                    originalSrc: newSrc,
                    status: (enableMatting || enableStroke) ? 'pending' : 'idle'
                };
                return updated;
            });
            setSelectedSliceIndex(null);
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        const zip = new JSZip();

        await Promise.all(slices.map(async (slice, i) => {
            const src = slice.processedSrc || slice.originalSrc;
            const fileName = `slice_${i + 1}.png`;
            try {
                const r = await fetch(src);
                const b = await r.blob();
                zip.file(fileName, b);
            } catch (e) {
                console.error("Export fail", e);
            }
        }));

        const blob = await zip.generateAsync({ type: 'blob' });
        saveAs(blob, 'smart_slices.zip');
        setIsExporting(false);
    };

    return (
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 h-full flex-1 min-h-0 p-4">
            <div className="flex flex-wrap items-center justify-between card-hand bg-white p-4 shrink-0 gap-4">
                {/* Left Controls */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setStep('editor')}
                        className="text-slate-500 hover:text-black hover:underline transition-colors font-bold px-4"
                    >
                        ← 返回
                    </button>
                </div>

                {/* Center Config */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setEnableMatting(!enableMatting)}
                        className={cn(
                            "btn-hand py-2 px-4 shadow-hard-sm",
                            enableMatting ? "bg-primary-pink text-white" : "bg-white text-slate-700"
                        )}
                    >
                        <Wand2 className="w-4 h-4 mr-2 inline" />
                        智能抠图
                    </button>
                    <button
                        onClick={() => setEnableStroke(!enableStroke)}
                        className={cn(
                            "btn-hand py-2 px-4 shadow-hard-sm",
                            enableStroke ? "bg-primary-blue text-white" : "bg-white text-slate-700"
                        )}
                    >
                        <PenTool className="w-4 h-4 mr-2 inline" />
                        描边
                    </button>

                    {enableStroke && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl border-2 border-black animate-in fade-in slide-in-from-left-2">
                            <span className="text-xs text-black font-bold w-12">宽度: {strokeWidth}</span>
                            <input
                                type="range"
                                min="1" max="20"
                                value={strokeWidth}
                                onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                                className="w-20 h-2 bg-slate-300 rounded-full appearance-none cursor-pointer accent-black border border-black"
                            />
                        </div>
                    )}

                    {/* Filter Dropdown */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl border-2 border-black">
                        <span className="text-xs text-black font-bold">滤镜:</span>
                        <select
                            value={filter || ''}
                            onChange={(e) => setFilter(e.target.value || null)}
                            className="px-3 py-1 rounded-lg border-2 border-black bg-white text-sm font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-black"
                        >
                            <option value="">无</option>
                            <option value="grayscale">🖤 黑白</option>
                            <option value="sepia">📸 怀旧</option>
                            <option value="brightness">☀️ 增亮</option>
                            <option value="vibrant">🌈 鲜艳</option>
                            <option value="cinematic">🎬 电影感</option>
                            <option value="japanese">🌸 日系</option>
                            <option value="warm">🔥 暖色调</option>
                        </select>
                    </div>
                </div>

                {/* Right / Progress */}
                <div className="flex items-center gap-4 ml-auto">
                    {(pendingCount > 0 || processingIndex !== null) && (
                        <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-100 px-4 py-2 rounded-lg border-2 border-blue-200 font-bold">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>处理中 {doneCount} / {totalCount}</span>
                        </div>
                    )}

                    <button
                        onClick={handleExport}
                        disabled={isExporting || pendingCount > 0 || processingIndex !== null}
                        className="btn-hand bg-primary-green hover:bg-green-400 text-black disabled:opacity-50 disabled:shadow-none"
                    >
                        <Download className="w-5 h-5 mr-2 inline" />
                        {isExporting ? '打包中...' : '导出 ZIP'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 p-6 bg-white/50 border-2 border-black/10 rounded-2xl overflow-y-auto custom-scrollbar flex-1 min-h-0">
                {slices.map((slice, i) => (
                    <div
                        key={slice.id}
                        className="group relative aspect-square bg-slate-300 rounded-xl overflow-hidden border-2 border-black transition-all cursor-pointer shadow-hard hover:shadow-hard-hover hover:-translate-y-1 p-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ib3BhY2l0eSI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjY2NjY2NjIiAvPjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjY2NjY2NjIiAvPjwvc3ZnPg==')] bg-repeat"
                        onClick={() => {
                            // Default: Open Lightbox Preview
                            if (slice.status !== 'processing') setPreviewSliceIndex(i);
                        }}
                    >
                        {/* Hover Overlay for Edit */}
                        <div className="absolute inset-0 z-20 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2 pointer-events-none">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSliceIndex(i);
                                }}
                                className="pointer-events-auto p-2 bg-white/10 hover:bg-white/20 rounded-lg backdrop-blur text-white transition-colors"
                                title="Edit Crop"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                        </div>
                        {/* Image Layer */}
                        <img
                            src={slice.processedSrc || slice.originalSrc}
                            className={cn(
                                "w-full h-full object-contain transition-all duration-300",
                                // Subtle pending state, not DEAD.
                                slice.status === 'pending' ? "opacity-60" : "opacity-100"
                            )}
                        />

                        {/* Processing - Center */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            {slice.status === 'processing' && (
                                <div className="bg-white/80 p-3 rounded-full border-2 border-black shadow-hard">
                                    <Loader2 className="w-8 h-8 text-black animate-spin" />
                                </div>
                            )}
                        </div>

                        {/* Pending Status Badge (Top Right) */}
                        {slice.status === 'pending' && (
                            <div className="absolute top-2 right-2 bg-yellow-200 p-1.5 rounded-full border-2 border-black shadow-sm z-10">
                                <Clock className="w-3 h-3 text-black" />
                            </div>
                        )}

                        <div className="absolute top-2 left-2 bg-black text-white text-[12px] font-black px-2 py-0.5 rounded border border-white z-10">
                            #{i + 1}
                        </div>
                    </div>
                ))}
            </div>

            {previewSliceIndex !== null && slices[previewSliceIndex] && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
                    onClick={() => setPreviewSliceIndex(null)}
                >
                    <button
                        className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors"
                        onClick={() => setPreviewSliceIndex(null)}
                    >
                        <X className="w-8 h-8" />
                    </button>

                    <img
                        src={slices[previewSliceIndex].processedSrc || slices[previewSliceIndex].originalSrc}
                        className="max-w-full max-h-[90vh] object-contain drop-shadow-2xl"
                        onClick={(e) => e.stopPropagation()} // Prevent close on image click
                    />

                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white border-2 border-black shadow-hard px-6 py-3 rounded-full">
                        <span className="text-black font-black">#{previewSliceIndex + 1}</span>
                        <div className="w-0.5 h-4 bg-black/20" />
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setPreviewSliceIndex(null);
                                setSelectedSliceIndex(previewSliceIndex);
                            }}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-black hover:underline transition-colors font-bold"
                        >
                            <Edit2 className="w-4 h-4 px" /> 编辑裁剪
                        </button>
                    </div>
                </div>
            )}

            {selectedSliceIndex !== null && (
                <FineTuner
                    rect={slices[selectedSliceIndex].rect}
                    onClose={() => setSelectedSliceIndex(null)}
                    onSave={handleUpdateSlice}
                />
            )}
        </div>
    );
};
