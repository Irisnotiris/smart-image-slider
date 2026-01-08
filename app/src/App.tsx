import { useStore } from './store/useStore';
import { ImageUploader } from './components/ImageUploader';
import { GridEditor } from './components/GridEditor';
import { SliceGallery } from './components/SliceGallery';

function App() {
    const step = useStore((state) => state.step);
    const reset = useStore((state) => state.reset);

    return (
        <div className="min-h-screen flex flex-col font-sans selection:bg-primary-green/50">
            <header className="px-6 py-4 border-b-2 border-black flex items-center justify-between bg-white sticky top-0 z-50 shadow-hard-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-green border-2 border-black shadow-hard-sm flex items-center justify-center font-black text-xl text-black rotate-3 hover:rotate-6 transition-transform">S</div>
                    <h1 className="text-xl font-black tracking-tight text-black">智能切图工具</h1>
                </div>

                {step !== 'upload' && (
                    <button
                        onClick={() => reset()}
                        className="text-sm font-bold text-slate-500 hover:text-black hover:underline transition-colors"
                    >
                        ⏪ 重新开始
                    </button>
                )}
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden">
                {step === 'upload' && (
                    <div className="w-full max-w-4xl flex flex-col items-center animate-in fade-in zoom-in duration-500 slide-in-from-bottom-4">
                        <div className="mb-12 text-center space-y-4">
                            <h2 className="text-4xl sm:text-6xl font-black text-black tracking-tight drop-shadow-sm">
                                咔嚓！切出<span className="text-primary-green inline-block -rotate-2 px-2">好心情</span> ✨
                            </h2>
                            <p className="text-slate-600 text-xl font-medium max-w-lg mx-auto">
                                简单、好玩、自由。释放你的无限创意。
                            </p>
                        </div>
                        <ImageUploader />
                    </div>
                )}

                {step === 'editor' && (
                    <div className="w-full h-full flex flex-col animate-in fade-in duration-300">
                        <GridEditor />
                    </div>
                )}

                {step === 'gallery' && (
                    <div className="w-full h-full flex flex-col animate-in fade-in duration-300">
                        <SliceGallery />
                    </div>
                )}
            </main>
        </div>
    )
}

export default App
