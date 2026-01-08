import React, { useCallback, useState } from 'react';
import { useStore } from '../store/useStore';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { cn } from '../utils/cn';

export const ImageUploader: React.FC = () => {
    const setFile = useStore((state) => state.setFile);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                setFile(file);
            }
        },
        [setFile]
    );

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                setFile(file);
            }
        },
        [setFile]
    );

    return (
        <div
            className={cn(
                "relative rounded-3xl border-4 border-dashed transition-all duration-300 w-full max-w-2xl aspect-video flex flex-col items-center justify-center p-8 cursor-pointer group bg-white",
                isDragOver ? "border-primary-green bg-green-50 scale-[1.02] shadow-hard" : "border-slate-300 hover:border-black hover:shadow-hard"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
        >
            <input
                id="file-upload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleChange}
            />

            <div className="relative z-10 flex flex-col items-center gap-6 text-center">
                <div className="p-6 rounded-full bg-primary-blue border-2 border-black shadow-hard group-hover:scale-110 transition-transform duration-300 group-hover:rotate-12">
                    <Upload className="w-12 h-12 text-white" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-3xl font-black text-black tracking-tight">
                        将图片拖拽到这里
                    </h3>
                    <p className="text-slate-500 font-bold">
                        或点击选择图片 📂
                    </p>
                </div>
                <div className="flex gap-2 mt-4 text-xs text-black font-bold font-mono bg-yellow-200 px-4 py-2 rounded-full border-2 border-black shadow-hard-sm -rotate-2">
                    <ImageIcon className="w-4 h-4" />
                    <span>支持 PNG, JPG, WEBP</span>
                </div>
            </div>

            {/* Remove old grid pattern, use simple white bg above */}
        </div>
    );
};
