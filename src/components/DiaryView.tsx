import React, { useState } from "react";
import { JournalEntry, User } from "../types";
import { BookOpen, ShieldCheck, Plus, Check, Trash } from "lucide-react";

interface DiaryProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  entries: JournalEntry[];
  onSubmitEntry: (text: string, mood: string) => Promise<void>;
  loading: boolean;
}

export default function DiaryView({ user, onUpdateUser, entries, onSubmitEntry, loading }: DiaryProps) {
  const [text, setText] = useState("");
  const [selectedMood, setSelectedMood] = useState("Calmo");
  const [success, setSuccess] = useState(false);

  const moodSelects = [
    { name: "Calmo", emoji: "🌸", color: "bg-pink-50 border-pink-100 text-pink-700 font-medium" },
    { name: "Ansioso", emoji: "🌊", color: "bg-sky-50 border-sky-100 text-sky-700 font-medium" },
    { name: "Esperançoso", emoji: "✨", color: "bg-amber-50 border-amber-100 text-amber-700 font-medium" },
    { name: "Triste", emoji: "🍁", color: "bg-indigo-50 border-indigo-100 text-indigo-700 font-medium" },
    { name: "Estressado", emoji: "🌪️", color: "bg-rose-50 border-rose-100 text-rose-700 font-medium" },
    { name: "Cansado", emoji: "💤", color: "bg-slate-100 border-slate-200 text-slate-700 font-medium font-mono" }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    await onSubmitEntry(text, selectedMood);
    setText("");
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleToggleAuth = async () => {
    const updatedVal = !user.authorizedForDiary;
    try {
      const response = await fetch(`/api/patients/${user.id}/diary-authorization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorized: updatedVal })
      });
      if (response.ok) {
        onUpdateUser({ ...user, authorizedForDiary: updatedVal });
      }
    } catch (err) {
      console.error("Failed to update journal sharing consent:", err);
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto pb-16">
      {/* Privacy Notice Card */}
      <div className="bg-gradient-to-r from-emerald-50/50 to-teal-50/50 rounded-2xl p-4 border border-emerald-100/40 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-emerald-900 tracking-tight">Privacidade e Termos (LGPD)</h4>
          <p className="text-[10px] text-emerald-800 leading-relaxed font-sans">
            Seus registros do diário são confidenciais e protegidos. Você escolhe se deseja compartilhar estes sentimentos com a psicóloga Elieyd Barreto para direcionar os rumos da sua terapia.
          </p>

          <button
            onClick={handleToggleAuth}
            className={`w-full py-2 px-3 rounded-lg border text-left flex items-center justify-between text-[11px] font-medium transition-all ${
              user.authorizedForDiary
                ? "bg-emerald-600/10 border-emerald-500/30 text-emerald-800"
                : "bg-white border-zinc-100 text-zinc-500"
            }`}
          >
            <span>
              {user.authorizedForDiary
                ? "✓ Psicóloga autorizada a acompanhar meu diário"
                : "🔒 Diário privado apenas para meu controle pessoal"}
            </span>
            <div className={`w-6 h-3.5 rounded-full relative transition-colors ${user.authorizedForDiary ? "bg-emerald-600" : "bg-zinc-300"}`}>
              <div
                className={`w-2.5 h-2.5 bg-white rounded-full absolute top-0.5 transition-all ${
                  user.authorizedForDiary ? "right-0.5" : "left-0.5"
                }`}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Write Entry Area */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-100/85">
        <h3 className="text-sm font-semibold text-zinc-800 tracking-tight flex items-center gap-1.5 mb-4 font-sans">
          <BookOpen className="w-4 h-4 text-emerald-600" />
          Como você está neste momento?
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mood Selector Row */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono block mb-2 font-medium">
              Sintonize seu humor dominante:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {moodSelects.map((m) => (
                <button
                  type="button"
                  key={m.name}
                  onClick={() => setSelectedMood(m.name)}
                  className={`py-2 px-1 text-center rounded-xl border text-[11px] flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    selectedMood === m.name
                      ? `${m.color} ring-1 ring-emerald-500/20 shadow-xs scale-102`
                      : "bg-white border-zinc-100 text-zinc-600 hover:bg-zinc-50/50"
                  }`}
                >
                  <span className="text-lg">{m.emoji}</span>
                  <span className="truncate max-w-full font-sans">{m.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Text Area Input */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono block mb-1.5 font-medium">
              Escreva livremente sobre pensamentos e sensações:
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Sinto-me um pouco apreensivo com as tarefas de hoje, mas..."
              rows={4}
              maxLength={1500}
              className="w-full text-xs text-zinc-800 bg-zinc-50 focus:bg-white rounded-xl p-3.5 border border-zinc-100 focus:border-emerald-300 focus:outline-none transition-colors leading-relaxed placeholder:text-zinc-400"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : success ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                Anotado no Diário!
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Salvar Sentimento
              </>
            )}
          </button>
        </form>
      </div>

      {/* History Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs uppercase tracking-wider text-zinc-400 font-mono font-semibold">
            Seus registros anteriores ({entries.length})
          </h4>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-10 bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200/60 p-6">
            <span className="text-2xl text-zinc-300 block mb-2">🌸</span>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans max-w-[240px] mx-auto">
              Nenhuma anotação ainda. Escreva seu primeiro sentimento no formulário acima para iniciar seu histórico terapêutico.
            </p>
          </div>
        ) : (
          <div className="relative border-l border-zinc-100/80 ml-5 pl-5 space-y-5">
            {entries.map((entry) => {
              const matchedMood = moodSelects.find((m) => m.name === entry.mood);
              const emojiDisplay = matchedMood?.emoji || "📝";
              const parsedDate = new Date(entry.date + "T00:00:00").toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "short",
                year: "numeric"
              });

              return (
                <div key={entry.id} className="relative group">
                  {/* Bullet indicator on the timeline */}
                  <span className="absolute -left-[29px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-emerald-500 shadow-sm flex items-center justify-center text-[10px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  </span>

                  <div className="bg-white rounded-xl p-4 shadow-xs border border-zinc-100 hover:border-zinc-200 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{emojiDisplay}</span>
                        <span className="text-xs font-semibold text-zinc-800">{entry.mood}</span>
                      </div>
                      <span className="text-[9px] font-mono text-zinc-400">
                        {parsedDate} às {entry.time}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-600 leading-relaxed font-sans">
                      {entry.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
