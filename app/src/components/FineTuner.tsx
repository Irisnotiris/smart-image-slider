import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { ZoomIn, ZoomOut, Check, X } from 'lucide-react';

interface FineTunerProps {
    rect: { x: number; y: number; w: number; h: number };
    onClose: () => void;
    onSave: (newDataUrl: string) => void;
}

export const FineTuner: React.FC<FineTunerProps> = ({ rect, onClose, onSave }) => {
    const { imageUrl } = useStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Reset state on mount
    useEffect(() => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
    }, []);

    useEffect(() => {
        renderCanvas();
    }, [imageUrl, rect, scale, offset]);

    const renderCanvas = () => {
        if (!canvasRef.current || !imageUrl) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.src = imageUrl;

        // We can't wait for onload inside render loop ideally, but since imageUrl is cached blob it should be fast.
        // Better: load image once in parent or ref.
        if (img.complete) {
            draw(ctx, img);
        } else {
            img.onload = () => draw(ctx, img);
        }
    };

    const draw = (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
        if (!canvasRef.current) return;

        // Canvas size matches the slice size
        canvasRef.current.width = rect.w;
        canvasRef.current.height = rect.h;

        // Clear
        ctx.clearRect(0, 0, rect.w, rect.h);

        // Draw image with offset and scale relative to the crop rect
        // Source: We want to take a chunk from the image.
        // The "camera" is at rect.x, rect.y. 
        // Offset moves the image relative to the camera.
        // Scale zooms the image relative to the center of the crop? Or top-left?
        // Let's implement simpler: Draw the whole image such that the crop area aligns.

        // Target Context: (0,0, w, h)
        // Source: (rect.x - offset.x, rect.y - offset.y, w / scale, h / scale)
        // Wait, simpler transform:
        ctx.save();

        // 1. Clip the drawing area to the canvas (which is the slice size)
        ctx.beginPath();
        ctx.rect(0, 0, rect.w, rect.h);
        ctx.clip();

        // 2. Translate so that (0,0) is the center of the canvas
        ctx.translate(rect.w / 2, rect.h / 2);

        // 3. Scale
        ctx.scale(scale, scale);

        // 4. Translate back
        ctx.translate(-rect.w / 2, -rect.h / 2);

        // 5. Draw the relevant part of the image
        // We want the image part at (rect.x, rect.y) to be at (0,0) plus offset
        // So we translate the "world"
        ctx.translate(-rect.x + offset.x, -rect.y + offset.y);

        ctx.drawImage(img, 0, 0);

        ctx.restore();
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleSave = () => {
        if (canvasRef.current) {
            onSave(canvasRef.current.toDataURL('image/png'));
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white border-2 border-black rounded-2xl shadow-hard max-w-4xl w-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b-2 border-black flex justify-between items-center bg-yellow-50">
                    <h3 className="font-black text-black text-xl">微调切片 🤏</h3>
                    <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors">
                        <X className="w-6 h-6 text-black" />
                    </button>
                </div>

                <div className="p-8 flex-1 bg-slate-50 relative flex justify-center items-center min-h-[400px]">
                    {/* Simplified checker background */}
                    <div className="absolute inset-0 opacity-10"
                        style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }}>
                    </div>

                    <div
                        className="relative shadow-2xl ring-2 ring-black"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                    >
                        <canvas ref={canvasRef} className="block bg-transparent" />
                    </div>
                </div>

                <div className="p-4 border-t-2 border-black bg-white flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 border-2 border-slate-300">
                            <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="p-2 hover:bg-slate-200 rounded-md transition-colors"><ZoomOut className="w-4 h-4 text-black" /></button>
                            <span className="w-12 text-center text-sm font-mono text-black font-bold">{Math.round(scale * 100)}%</span>
                            <button onClick={() => setScale(s => Math.min(5, s + 0.1))} className="p-2 hover:bg-slate-200 rounded-md transition-colors"><ZoomIn className="w-4 h-4 text-black" /></button>
                        </div>
                        <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} className="text-xs text-slate-500 hover:text-black font-bold underline">
                            重置
                        </button>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={handleSave} className="btn-hand bg-primary-blue text-white hover:bg-blue-400 py-2">
                            <Check className="w-4 h-4 mr-2 inline" /> 保存
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
