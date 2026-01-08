import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import Draggable from 'react-draggable';
import { cn } from '../utils/cn';

// Helper component for resize handles
const ResizeHandle: React.FC<{
    cursor: string;
    positionClass: string;
    onResizeStart: (e: React.MouseEvent) => void;
}> = ({ cursor, positionClass, onResizeStart }) => (
    <div
        className={cn(
            "absolute w-5 h-5 bg-white border-2 border-black rounded-full z-50 hover:scale-125 transition-transform shadow-hard-sm cursor-pointer",
            cursor,
            positionClass,
            // Offset to center the handle on the line
            positionClass.includes("top-0") ? "-mt-2" : "",
            positionClass.includes("bottom-0") ? "-mb-2" : "",
            positionClass.includes("left-0") ? "-ml-2" : "",
            positionClass.includes("right-0") ? "-mr-2" : "",
            // Center middle handles
            (positionClass.includes("top-1/2") || positionClass.includes("bottom-1/2")) ? "-translate-y-1/2" : "",
            (positionClass.includes("left-1/2") || positionClass.includes("right-1/2")) ? "-translate-x-1/2" : ""
        )}
        onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onResizeStart(e);
        }}
    />
);

export const GridEditor: React.FC = () => {
    const { imageUrl, grid, gridLines, crop, setGridConfig, setGridLines, setCrop, setStep } = useStore();
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (gridLines.v.length === 0 && gridLines.h.length === 0) {
            setGridConfig(grid.rows, grid.cols);
        }
    }, []);

    const updateSize = () => {
        if (imageRef.current) {
            setContainerSize({
                width: imageRef.current.clientWidth,
                height: imageRef.current.clientHeight
            });
        }
    };

    useEffect(() => {
        window.addEventListener('resize', updateSize);
        setTimeout(updateSize, 100);
        return () => window.removeEventListener('resize', updateSize);
    }, [imageUrl]);

    if (!imageUrl) return null;

    const cropX = (crop.x / 100) * containerSize.width;
    const cropY = (crop.y / 100) * containerSize.height;
    const cropW = (crop.w / 100) * containerSize.width;
    const cropH = (crop.h / 100) * containerSize.height;

    // Generic Resize Handler
    const handleResize = (dir: string) => (e: React.MouseEvent) => {
        const startX = e.clientX;
        const startY = e.clientY;
        const startCX = cropX;
        const startCY = cropY;
        const startCW = cropW;
        const startCH = cropH;

        const onMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            let newX = startCX;
            let newY = startCY;
            let newW = startCW;
            let newH = startCH;

            // Apply delta based on direction
            if (dir.includes('e')) newW = Math.max(20, startCW + dx);
            if (dir.includes('s')) newH = Math.max(20, startCH + dy);
            if (dir.includes('w')) {
                const maxD = startCW - 20; // limit so we don't invert
                const rdx = Math.min(dx, maxD);
                newX = startCX + rdx;
                newW = startCW - rdx;
            }
            if (dir.includes('n')) {
                const maxD = startCH - 20;
                const rdy = Math.min(dy, maxD);
                newY = startCY + rdy;
                newH = startCH - rdy;
            }

            // Convert to percentages and clamp
            // Safety Check for Out of Bounds
            // X/Y cannot be < 0. X+W cannot be > width
            if (newX < 0) { newW += newX; newX = 0; } // Push back
            if (newY < 0) { newH += newY; newY = 0; }

            // Width check
            const maxW = containerSize.width - newX;
            if (newW > maxW) newW = maxW;

            const maxH = containerSize.height - newY;
            if (newH > maxH) newH = maxH;

            // Commit
            setCrop({
                x: (newX / containerSize.width) * 100,
                y: (newY / containerSize.height) * 100,
                w: (newW / containerSize.width) * 100,
                h: (newH / containerSize.height) * 100,
            });
        };

        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    return (
        <div className="flex flex-col lg:flex-row h-full gap-8 w-full max-w-7xl mx-auto p-4">
            <div className="flex-1 card-hand flex items-center justify-center p-8 relative overflow-hidden group select-none bg-slate-100">
                <div className="relative shadow-2xl shadow-black/50" ref={containerRef}>
                    <img
                        ref={imageRef}
                        src={imageUrl}
                        alt="Workplace"
                        className="max-h-[70vh] w-auto block pointer-events-none"
                        onLoad={updateSize}
                    />

                    <div
                        className="absolute inset-0"
                        style={{ width: containerSize.width, height: containerSize.height }}
                    >
                        {/* Dimmed Areas */}
                        <div className="absolute top-0 left-0 right-0 bg-black/60" style={{ height: cropY }}></div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60" style={{ height: containerSize.height - (cropY + cropH) }}></div>
                        <div className="absolute left-0 bg-black/60" style={{ top: cropY, height: cropH, width: cropX }}></div>
                        <div className="absolute right-0 bg-black/60" style={{ top: cropY, height: cropH, width: containerSize.width - (cropX + cropW) }}></div>

                        {/* CROP BOX */}
                        <Draggable
                            position={{ x: cropX, y: cropY }}
                            bounds="parent"
                            onDrag={(_e, data) => {
                                const nx = (data.x / containerSize.width) * 100;
                                const ny = (data.y / containerSize.height) * 100;
                                setCrop({ ...crop, x: nx, y: ny });
                            }}
                            handle=".crop-box-move"
                        >
                            {/* High Contrast Border - Black Dashed for Sketch style */}
                            <div
                                className="absolute box-border z-20 group/crop border-2 border-dashed border-white shadow-[0_0_0_2px_black]"
                                style={{ width: cropW, height: cropH }}
                            >
                                {/* Move Area (Central) */}
                                <div className="absolute inset-4 cursor-move crop-box-move z-10 hover:bg-white/10 transition-colors"></div>

                                {/* RESIZE HANDLES (8 Directions) */}
                                {/* Corners */}
                                <ResizeHandle cursor="cursor-nw-resize" positionClass="top-0 left-0" onResizeStart={handleResize('nw')} />
                                <ResizeHandle cursor="cursor-ne-resize" positionClass="top-0 right-0" onResizeStart={handleResize('ne')} />
                                <ResizeHandle cursor="cursor-sw-resize" positionClass="bottom-0 left-0" onResizeStart={handleResize('sw')} />
                                <ResizeHandle cursor="cursor-se-resize" positionClass="bottom-0 right-0" onResizeStart={handleResize('se')} />

                                {/* Sides */}
                                <ResizeHandle cursor="cursor-n-resize" positionClass="top-0 left-1/2" onResizeStart={handleResize('n')} />
                                <ResizeHandle cursor="cursor-s-resize" positionClass="bottom-0 left-1/2" onResizeStart={handleResize('s')} />
                                <ResizeHandle cursor="cursor-w-resize" positionClass="left-0 top-1/2" onResizeStart={handleResize('w')} />
                                <ResizeHandle cursor="cursor-e-resize" positionClass="right-0 top-1/2" onResizeStart={handleResize('e')} />


                                {/* GRID LINES (Inside Crop Box) 
                               Note: We put them at z-30 (above move area but below handles)
                           */}
                                <div className="absolute inset-0 overflow-hidden pointer-events-none z-30">
                                    {gridLines.v.map((pos, i) => (
                                        <Draggable
                                            key={`v-${i}`}
                                            axis="x"
                                            bounds="parent"
                                            position={{ x: (pos / 100) * cropW, y: 0 }}
                                            onDrag={(_e, data) => {
                                                const newPos = (data.x / cropW) * 100;
                                                const newLines = [...gridLines.v];
                                                newLines[i] = newPos;
                                                setGridLines(newLines, gridLines.h);
                                            }}
                                            onStart={(e) => e.stopPropagation()}
                                        >
                                            <div className="absolute top-0 bottom-0 w-1 bg-primary-blue hover:bg-blue-400 cursor-col-resize pointer-events-auto transition-colors flex flex-col justify-center items-center group/line">
                                                <div className="h-6 w-3 bg-white border-2 border-black rounded-full shadow-sm"></div>
                                            </div>
                                        </Draggable>
                                    ))}

                                    {gridLines.h.map((pos, i) => (
                                        <Draggable
                                            key={`h-${i}`}
                                            axis="y"
                                            bounds="parent"
                                            position={{ x: 0, y: (pos / 100) * cropH }}
                                            onDrag={(_e, data) => {
                                                const newPos = (data.y / cropH) * 100;
                                                const newLines = [...gridLines.h];
                                                newLines[i] = newPos;
                                                setGridLines(gridLines.v, newLines);
                                            }}
                                            onStart={(e) => e.stopPropagation()}
                                        >
                                            <div className="absolute left-0 right-0 h-1 bg-primary-blue hover:bg-blue-400 cursor-row-resize pointer-events-auto transition-colors flex flex-row justify-center items-center group/line">
                                                <div className="w-6 h-3 bg-white border-2 border-black rounded-full shadow-sm"></div>
                                            </div>
                                        </Draggable>
                                    ))}
                                </div>

                            </div>
                        </Draggable>
                    </div>
                </div>
            </div>

            <div className="w-full lg:w-80 card-hand p-6 flex flex-col gap-6 h-fit bg-white relative">
                {/* Decorative tape */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-yellow-200/80 rotate-1 border border-black/10"></div>
                <h3 className="text-2xl font-black text-black">网格与裁剪</h3>
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl text-sm font-bold text-blue-800">
                    💡 拖拽 <b>白框</b> 移动选区。拖拽 <b>蓝点</b> 缩放。
                </div>

                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm font-bold text-slate-700">行数</label>
                            <span className="text-lg font-black text-primary-purple">{grid.rows}</span>
                        </div>
                        <input
                            type="range" min="1" max="10"
                            value={grid.rows}
                            onChange={(e) => setGridConfig(parseInt(e.target.value), grid.cols)}
                            className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-black border-2 border-black"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm font-bold text-slate-700">列数</label>
                            <span className="text-lg font-black text-primary-purple">{grid.cols}</span>
                        </div>
                        <input
                            type="range" min="1" max="10"
                            value={grid.cols}
                            onChange={(e) => setGridConfig(grid.rows, parseInt(e.target.value))}
                            className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-black border-2 border-black"
                        />
                    </div>
                </div>
                <button
                    onClick={() => setStep('gallery')}
                    className="btn-hand bg-primary-green w-full text-lg hover:bg-green-400"
                >
                    开始切图！ ✂️
                </button>
            </div>
        </div>
    );
};
