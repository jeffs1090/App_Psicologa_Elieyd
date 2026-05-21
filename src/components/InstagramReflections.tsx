import { useState } from "react";
import { ReflectiveMessage } from "../types";
import { BookOpen, X, ChevronRight, Sparkles, Heart } from "lucide-react";

interface StoriesProps {
  reflections: ReflectiveMessage[];
  onGenerateAI: (mood: string) => Promise<void>;
  loadingAI: boolean;
}

export default function InstagramReflections({ reflections, onGenerateAI, loadingAI }: StoriesProps) {
  const [activeStory, setActiveStory] = useState<ReflectiveMessage | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState("Ansioso");

  const moodOptions = [
    { name: "Ansioso", icon: "🌊", desc: "Sentindo mente inquieta ou aperto no peito" },
    { name: "Estressado", icon: "🌪️", desc: "Sobrecarga física ou mental recente" },
    { name: "Triste", icon: "🍁", desc: "Desânimo ou necessidade de acolhimento" },
    { name: "Cansado", icon: "💤", desc: "Falta de energia ou estafa emocional" },
    { name: "Inseguro", icon: "🔍", desc: "Dúvidas sobre o futuro ou decisões" }
  ];

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-emerald-50/50 mb-6">
      {/* Disclaimer */}
      <p className="text-[10px] text-zinc-400 font-mono text-center leading-relaxed tracking-tight border-b border-zinc-100 pb-2 mb-4">
        ⚠️ Atenção: As mensagens reflexivas diárias possuem caráter informativo e de autocuidado, não substituindo o processo terapêutico profissional.
      </p>

      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-medium text-zinc-800 tracking-tight flex items-center gap-1.5 font-sans">
          <BookOpen className="w-4 h-4 text-emerald-600" />
          Pílulas de Autocuidado
        </h3>
        <button
          onClick={() => setShowAiModal(true)}
          className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors px-2.5 py-1 rounded-full flex items-center gap-1 cursor-pointer"
        >
          <Sparkles className="w-3 h-3" />
          Gerar com IA
        </button>
      </div>

      {/* Grid of story circular previews */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
        {/* Magic IA circle */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setShowAiModal(true)}
            className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 p-[3px] shadow-sm transform active:scale-95 transition-transform"
          >
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white">
              <Sparkles className="w-6 h-6 text-emerald-300 animate-pulse" />
            </div>
          </button>
          <span className="text-[10px] font-medium text-slate-700 max-w-[70px] truncate">Reflexão IA</span>
        </div>

        {reflections.map((ref, idx) => (
          <div key={ref.id} className="flex flex-col items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setActiveStory(ref)}
              className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-400 via-teal-300 to-amber-200 p-[3px] hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            >
              <div className="w-full h-full rounded-full bg-white overflow-hidden border border-white">
                <img
                  src={
                    ref.imageUrl ||
                    "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=150&q=80"
                  }
                  alt={ref.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </button>
            <span className="text-[10px] font-medium text-zinc-600 max-w-[70px] truncate text-center">
              {ref.category}
            </span>
          </div>
        ))}
      </div>

      {/* Story Immersive Fullscreen Modal */}
      {activeStory && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-md h-[90vh] bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-emerald-900/40">
            {/* Header / Top Progress Bar */}
            <div className="absolute top-4 left-4 right-4 z-20 flex flex-col gap-2">
              <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 animate-[pulse_1.5s_infinite]" style={{ width: "60%" }}></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="text-[11px] uppercase tracking-widest text-emerald-300 font-mono">
                    Elieyd Barreto • {activeStory.category}
                  </span>
                </div>
                <button
                  onClick={() => setActiveStory(null)}
                  className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Support Media Image if available */}
            <div className="relative h-[40%] w-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 to-transparent z-10" />
              <img
                src={
                  activeStory.imageUrl ||
                  "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=600&q=80"
                }
                alt={activeStory.title}
                className="w-full h-full object-cover scale-105"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Story Text Area */}
            <div className="flex-1 p-6 flex flex-col justify-between text-white overflow-y-auto pb-8">
              <div>
                <h2 className="text-xl font-semibold text-emerald-200 tracking-tight mb-3">
                  {activeStory.title}
                </h2>
                <div className="text-zinc-200 text-sm leading-relaxed space-y-3 font-sans">
                  {activeStory.text.split("\n").map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </div>

              {/* Practice Instruction Container */}
              <div className="mt-6 bg-slate-900/60 backdrop-blur-sm border border-emerald-800/40 p-4 rounded-xl">
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-mono font-medium block mb-1">
                  💡 Como praticar hoje:
                </span>
                <p className="text-xs text-emerald-100 font-medium leading-relaxed">
                  {activeStory.instruction}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Message Generation Setup Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-zinc-100 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-semibold text-zinc-900 tracking-tight flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                Sintonizar meu Momento
              </h3>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-zinc-400 hover:text-zinc-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-500 leading-relaxed mb-4">
              Como você está se sentindo agora? Nossa Inteligência Artificial gerará uma mensagem reflexiva e uma prática personalizada guiada pela metodologia acolhedora da Dra. Elieyd.
            </p>

            {/* Select mood list */}
            <div className="space-y-2 mb-6">
              {moodOptions.map((opt) => (
                <button
                  key={opt.name}
                  onClick={() => setSelectedMood(opt.name)}
                  className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                    selectedMood === opt.name
                      ? "border-emerald-500 bg-emerald-50/50 shadow-sm"
                      : "border-zinc-100 bg-zinc-50 hover:bg-zinc-100/50"
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <div>
                    <h5 className="text-xs font-semibold text-zinc-800">{opt.name}</h5>
                    <p className="text-[10px] text-zinc-500">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={async () => {
                setShowAiModal(false);
                await onGenerateAI(selectedMood);
              }}
              disabled={loadingAI}
              className="w-full py-3 bg-emerald-700 text-white font-medium rounded-xl hover:bg-emerald-800 transition-colors text-xs flex items-center justify-center gap-2 shadow-sm shadow-emerald-700/20 cursor-pointer disabled:opacity-50"
            >
              {loadingAI ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sintonizando reflexão...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar Reflexão de Paz
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
