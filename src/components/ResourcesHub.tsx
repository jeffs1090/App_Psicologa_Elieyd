import React, { useState, useEffect } from "react";
import { User, EducationalContent, AuditLog } from "../types";
import { 
  Shield, 
  BookOpen, 
  AlertCircle, 
  PhoneCall, 
  Download, 
  UserMinus, 
  Sliders, 
  Lock, 
  FileCheck,
  Check,
  ChevronRight,
  TrendingUp,
  Heart
} from "lucide-react";

interface ResourcesHubProps {
  user: User;
  onUpdateUser: (updated: User) => void;
  onLogout: () => void;
}

// Screener questions
const PHQ_9_QUESTIONS = [
  "Pouco interesse ou prazer em fazer as coisas",
  "Sentir-se para baixo, deprimido(a) ou sem esperança",
  "Dificuldade para adormecer ou manter o sono, ou dormir demais",
  "Sentir-se cansado(a) ou com pouca energia",
  "Falta de apetite ou comer demais",
  "Sentir-se mal consigo mesmo(a) ou achar que é um fracasso",
  "Dificuldade para se concentrar nas coisas (ex: ler notícias ou ver TV)",
  "Lentidão para falar ou se movimentar, ou agitação/inquietação incomum",
  "Pensamentos de que seria melhor morrer ou se machucar de alguma forma"
];

const GAD_7_QUESTIONS = [
  "Sentir-se nervoso(a), ansioso(a) ou muito tenso(a)",
  "Não ser capaz de parar ou controlar as preocupações",
  "Preocupar-se muito com diversas coisas diferentes",
  "Dificuldade para relaxar",
  "Ficar tão inquieto(a) que é difícil permanecer sentado(a)",
  "Ficar facilmente irritável ou aborrecido(a)",
  "Sentir medo, como se algo terrível pudesse acontecer"
];

export default function ResourcesHub({ user, onUpdateUser, onLogout }: ResourcesHubProps) {
  const [activeSubTab, setActiveSubTab] = useState<"screenings" | "library" | "crisis" | "lgpd">("screenings");
  
  // Library State
  const [materials, setMaterials] = useState<EducationalContent[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  
  // Screener State
  const [selectedScreener, setSelectedScreener] = useState<"phq9" | "gad7" | null>(null);
  const [screenerAnswers, setScreenerAnswers] = useState<Record<number, number>>({});
  const [submittingScreen, setSubmittingScreen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  
  // Personal Data State
  const [phone, setPhone] = useState(user.phone || "");
  const [gender, setGender] = useState(user.gender || "");
  const [socialName, setSocialName] = useState(user.socialName || "");
  const [pronouns, setPronouns] = useState(user.pronouns || "");
  const [birthDate, setBirthDate] = useState(user.birthDate || "");
  const [cpf, setCpf] = useState(user.cpf || "");
  const [emergencyContact, setEmergencyContact] = useState(
    user.emergencyContact || { name: "", relation: "", phone: "" }
  );
  const [mfaEnabled, setMfaEnabled] = useState(!!user.mfaEnabled);
  const [savingData, setSavingData] = useState(false);
  const [anonymizing, setAnonymizing] = useState(false);
  
  // Safety Plan state
  const [safetyPlan, setSafetyPlan] = useState(
    user.safetyPlan || { warningSigns: "", copingStrategies: "", supportPeople: "" }
  );

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    try {
      const res = await fetch("/api/educational-contents");
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      }
    } catch (e) {
      console.error("Erro ao carregar acervo educativo:", e);
    }
  };

  // Submit screening values
  const handleScreenerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScreener) return;
    
    const questionsLength = selectedScreener === "phq9" ? PHQ_9_QUESTIONS.length : GAD_7_QUESTIONS.length;
    
    // Check if answered all
    for (let i = 0; i < questionsLength; i++) {
      if (screenerAnswers[i] === undefined) {
        alert("Por favor, responda a todas as perguntas antes de enviar o questionário.");
        return;
      }
    }
    
    setSubmittingScreen(true);
    const score = Object.values(screenerAnswers).reduce<number>((a, b) => Number(a) + Number(b), 0);
    
    // Classification according to clinical standard
    let classification = "";
    if (selectedScreener === "phq9") {
      if (score <= 4) classification = "Sintomatologia Mínima";
      else if (score <= 9) classification = "Sintomatologia Leve";
      else if (score <= 14) classification = "Sintomatologia Moderada";
      else if (score <= 19) classification = "Sintomatologia Moderadamente Grave";
      else classification = "Sintomatologia Grave";
    } else {
      if (score <= 4) classification = "Ansiedade Mínima";
      else if (score <= 9) classification = "Ansiedade Leve";
      else if (score <= 14) classification = "Ansiedade Moderada";
      else classification = "Ansiedade Grave";
    }
    
    try {
      const res = await fetch(`/api/patients/${user.id}/screenings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument: selectedScreener === "phq9" ? "PHQ-9 (Depressão)" : "GAD-7 (Ansiedade)",
          score,
          classification
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        onUpdateUser(data.user);
        setSuccessMsg(`Questionário enviado com sucesso à Dra. Elieyd! Escore obtido: ${score} (${classification})`);
        setScreenerAnswers({});
        setSelectedScreener(null);
        setTimeout(() => setSuccessMsg(""), 6000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingScreen(false);
    }
  };

  // Save personal details / safety plan
  const handleSaveContactAndPlan = async () => {
    setSavingData(true);
    try {
      const res = await fetch(`/api/patients/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          gender,
          socialName,
          pronouns,
          birthDate,
          cpf,
          emergencyContact,
          safetyPlan
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        onUpdateUser(data.user);
        setSuccessMsg("Dados pessoais e de prevenção atualizados com sucesso!");
        setTimeout(() => setSuccessMsg(""), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingData(false);
    }
  };

  // Toggle MFA Setting
  const handleToggleMFA = async (checked: boolean) => {
    setMfaEnabled(checked);
    try {
      const res = await fetch("/api/auth/mfa/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, mfaEnabled: checked })
      });
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Autenticação de Dois Fatores (MFA) ${checked ? "ativada" : "desativada"}!`);
        setTimeout(() => setSuccessMsg(""), 4000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger Data Portability Export
  const handleExportData = () => {
    window.open(`/api/patients/${user.id}/export`, "_blank");
  };

  // Trigger Anonymize Account
  const handleAnonymize = async () => {
    const confirmation = window.confirm(
      "ATENÇÃO: Deseja realmente solicitar a anonimização total dos seus dados de atendimento? " +
      "Esta ação é irreversível e apagará do sistema todos os seus identificadores clínicos e pessoais em estrita conformidade com a LGPD e o Artigo 16 da legislação de proteção de dados. Sua conta será revogada imediatamente."
    );
    if (!confirmation) return;
    
    setAnonymizing(true);
    try {
      const res = await fetch(`/api/patients/${user.id}/anonymize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        alert("Seus dados foram completamente anonimizados com sucesso. Conexão encerrada.");
        onLogout();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAnonymizing(false);
    }
  };

  const categories = ["Todos", ...new Set(materials.map(m => m.category))];
  const filteredMaterials = selectedCategory === "Todos"
    ? materials
    : materials.filter(m => m.category === selectedCategory);

  return (
    <div id="resources-hub" className="space-y-4 animate-fade-in pb-12 font-sans">
      {/* Sub-Tab Navigation Header */}
      <div className="bg-white/80 backdrop-blur-md sticky top-[72px] z-20 py-2 border-b border-stone-200/50 -mx-4 px-4 flex gap-1 overflow-x-auto scrollbar-none">
        <button
          onClick={() => { setActiveSubTab("screenings"); setSelectedScreener(null); }}
          className={`px-3 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer whitespace-nowrap transition-all ${
            activeSubTab === "screenings"
              ? "bg-[#2F4738] text-white"
              : "bg-[#D9B8A7]/10 text-[#4E5B52] hover:bg-[#D9B8A7]/20"
          }`}
        >
          🩺 Rastreios Clínicos
        </button>
        <button
          onClick={() => setActiveSubTab("library")}
          className={`px-3 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer whitespace-nowrap transition-all ${
            activeSubTab === "library"
              ? "bg-[#2F4738] text-white"
              : "bg-[#D9B8A7]/10 text-[#4E5B52] hover:bg-[#D9B8A7]/20"
          }`}
        >
          📚 Acervo Educativo
        </button>
        <button
          onClick={() => setActiveSubTab("crisis")}
          className={`px-3 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer whitespace-nowrap transition-all ${
            activeSubTab === "crisis"
              ? "bg-[#2F4738] text-white"
              : "bg-[#D9B8A7]/10 text-[#4E5B52] hover:bg-[#D9B8A7]/20"
          }`}
        >
          🚨 Prevenção e Apoio
        </button>
        <button
          onClick={() => setActiveSubTab("lgpd")}
          className={`px-3 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer whitespace-nowrap transition-all ${
            activeSubTab === "lgpd"
              ? "bg-[#2F4738] text-white"
              : "bg-[#D9B8A7]/10 text-[#4E5B52] hover:bg-[#D9B8A7]/20"
          }`}
        >
          🛡️ Privacidade (LGPD)
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] p-3 rounded-xl animate-fade-in flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* --- SUBTAB 1: CLINICAL SCREENINGS --- */}
      {activeSubTab === "screenings" && (
        <div className="space-y-4">
          <div className="bg-[#FAF8F6] border border-[#D9B8A7]/20 rounded-2xl p-4 space-y-2">
            <h2 className="text-sm font-serif font-semibold text-[#2F4738] flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-[#D9B8A7]" />
              Autoavaliações Clínicas Periódicas
            </h2>
            <p className="text-[11px] text-stone-600 leading-relaxed font-sans">
              Responda a questionários padronizados para apoiar sua psicóloga no acompanhamento do seu quadro. Os resultados geram relatórios consolidados diretamente no prontuário.
            </p>
          </div>

          {!selectedScreener ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedScreener("phq9")}
                  className="bg-white hover:border-[#2F4738]/40 border border-stone-200/60 p-4 rounded-xl text-left transition-all hover:scale-[1.01] flex flex-col justify-between cursor-pointer space-y-4 shadow-2xs"
                >
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-mono">
                      Depressão
                    </span>
                    <h3 className="text-xs font-bold text-stone-800 font-serif pt-1">Escala PHQ-9</h3>
                  </div>
                  <p className="text-[10px] text-stone-500 leading-normal font-sans">
                    Foco na avaliação de humor negativo, energia, fadiga e anedonia nas últimas duas semanas.
                  </p>
                  <div className="text-[10px] text-[#2F4738] font-bold inline-flex items-center gap-0.5 pt-2">
                    Iniciar teste <ChevronRight className="w-3 h-3" />
                  </div>
                </button>

                <button
                  onClick={() => setSelectedScreener("gad7")}
                  className="bg-white hover:border-[#2F4738]/40 border border-stone-200/60 p-4 rounded-xl text-left transition-all hover:scale-[1.01] flex flex-col justify-between cursor-pointer space-y-4 shadow-2xs"
                >
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-mono">
                      Ansiedade
                    </span>
                    <h3 className="text-xs font-bold text-stone-800 font-serif pt-1">Escala GAD-7</h3>
                  </div>
                  <p className="text-[10px] text-stone-500 leading-normal font-sans">
                    Foco em sintomas de preocupação excessiva, tensão física, desassossego e irritabilidade diária.
                  </p>
                  <div className="text-[10px] text-[#2F4738] font-bold inline-flex items-center gap-0.5 pt-2">
                    Iniciar teste <ChevronRight className="w-3 h-3" />
                  </div>
                </button>
              </div>

              {/* History area of screenings */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200/60 space-y-3">
                <h3 className="text-[11px] uppercase font-mono font-bold text-stone-500 tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[#2F4738]" />
                  Histórico de Rastreio Emocional
                </h3>
                
                {user.screeningHistory && user.screeningHistory.length > 0 ? (
                  <div className="space-y-2">
                    {user.screeningHistory.slice().reverse().map((sc, index) => (
                      <div key={index} className="bg-stone-50/70 p-3 rounded-lg flex items-center justify-between border border-stone-100">
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-bold text-stone-800">{sc.instrument}</p>
                          <span className="text-[9px] text-stone-500 block">
                            Realizado em: {new Date(sc.takenAt).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-[#2F4738] block bg-[#2F4738]/10 px-2 py-0.5 rounded-full">
                            Escore: {sc.score}
                          </span>
                          <span className="text-[9px] text-stone-500 font-medium block mt-0.5">
                            {sc.classification}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10.5px] text-stone-400 font-sans italic text-center py-4">
                    Nenhum rastreamento clínico respondido ainda. Inicie um dos testes acima!
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* ACTIVE QUESTIONNAIRE INTERACTIVE FLOW */
            <form onSubmit={handleScreenerSubmit} className="bg-white rounded-2xl p-5 border border-stone-200/60 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-stone-100">
                <div>
                  <h3 className="text-xs font-bold text-[#2F4738] font-serif uppercase tracking-tight">
                    Preenchendo: {selectedScreener === "phq9" ? "Escala PHQ-9" : "Escala GAD-7"}
                  </h3>
                  <span className="text-[10px] text-stone-500 leading-normal font-sans">
                    Nas últimas 2 semanas, com que frequência você foi incomodado pelos problemas abaixo?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedScreener(null)}
                  className="text-[10px] text-[#A45A52] hover:underline font-mono"
                >
                  CANCELAR
                </button>
              </div>

              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                {(selectedScreener === "phq9" ? PHQ_9_QUESTIONS : GAD_7_QUESTIONS).map((q, idx) => (
                  <div key={idx} className="space-y-2 border-b border-stone-50 pb-3">
                    <p className="text-[11px] font-medium text-stone-800 leading-relaxed">
                      {idx + 1}. {q}
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: "Nenhuma", val: 0 },
                        { label: "Vários dias", val: 1 },
                        { label: "Mais da metade", val: 2 },
                        { label: "Quase todos os dias", val: 3 }
                      ].map((opt) => (
                        <label
                          key={opt.val}
                          className={`flex flex-col items-center text-center p-1.5 rounded-lg border cursor-pointer transition-all ${
                            screenerAnswers[idx] === opt.val
                              ? "bg-[#2F4738]/10 border-[#2F4738] text-[#2F4738]"
                              : "bg-stone-50 border-stone-200 hover:bg-stone-100 text-stone-600"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q-${idx}`}
                            required
                            checked={screenerAnswers[idx] === opt.val}
                            onChange={() => setScreenerAnswers({ ...screenerAnswers, [idx]: opt.val })}
                            className="sr-only"
                          />
                          <span className="text-[8px] font-bold font-mono tracking-tight">{opt.label}</span>
                          <span className="text-[10px] font-bold font-mono mt-0.5">{opt.val}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={submittingScreen}
                className="w-full bg-[#2F4738] hover:bg-[#1E2E24] text-white text-[11px] font-bold py-3 px-4 rounded-xl cursor-pointer transition-all focus:outline-none"
              >
                {submittingScreen ? "Enviando resultados..." : "Calcular e Enviar à Elieyd"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* --- SUBTAB 2: EDUCATIONAL CONTENTS --- */}
      {activeSubTab === "library" && (
        <div className="space-y-4">
          <div className="bg-[#2F4738]/5 border border-[#2F4738]/10 rounded-2xl p-4 space-y-1">
            <span className="text-[9px] uppercase tracking-wider font-bold text-[#2F4738] font-mono">
              Acervo de Apoio Terapêutico
            </span>
            <p className="text-[11px] text-[#4E5B52] leading-relaxed">
              Materiais complementares curados com carinho pela Dra. Elieyd Barreto para leitura de intervalo de sessões.
            </p>
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 text-[10px] font-bold rounded-full cursor-pointer whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? "bg-[#2F4738] text-white"
                    : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredMaterials.map((item) => (
              <a
                href={item.url}
                target="_blank"
                rel="no-referrer"
                key={item.id}
                className="bg-white hover:border-[#2F4738]/30 border border-stone-200/60 p-4 rounded-xl text-left block transition-all shadow-2xs space-y-2 hover:scale-[1.005]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[8px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded font-mono bg-stone-100 text-stone-600 border border-stone-200/50">
                    {item.type} • {item.duration}
                  </span>
                  <span className="text-[9px] text-[#2F4738] font-mono font-bold tracking-tight bg-[#2F4738]/5 px-2 py-0.5 rounded-full">
                    {item.category}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-stone-800 leading-tight">{item.title}</h3>
                <p className="text-[10px] text-stone-500 leading-normal font-sans pt-0.5">
                  {item.summary}
                </p>
                <div className="text-[9px] text-[#2F4738] font-semibold text-right block pt-1">
                  Ler material completo &gt;
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* --- SUBTAB 3: PREVENTION & CRISIS (CFP COMPLIANCE) --- */}
      {activeSubTab === "crisis" && (
        <div className="space-y-4">
          <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-rose-800 font-serif font-bold text-xs uppercase">
              <AlertCircle className="w-4 h-4 text-[#A45A52] shrink-0" />
              Aviso Importante: Resolução CFP 09/2024
            </div>
            <p className="text-[10px] text-rose-700 leading-relaxed font-sans font-medium">
              Este aplicativo é exclusivamente focado no agendamento e apoio terapêutico preventivo regular. 
              <b> Este app NÃO presta atendimento a urgências, situações de violência, crises graves de humor ou pensamentos de autoextermínio iminente.</b>
            </p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-stone-200/60 space-y-4">
            <h3 className="text-xs font-bold font-serif text-[#2F4738]">Canais de Ajuda Imediata</h3>
            <p className="text-[10.5px] text-stone-500 font-sans">
              Se você ou alguém que você conhece está vivenciando uma crise aguda de sofrimento mental ou se encontra em perigo físico, acione de imediato os canais públicos gratuitos de emergência nacional:
            </p>

            <div className="grid grid-cols-2 gap-3">
              <a
                href="tel:188"
                className="bg-stone-50 hover:bg-stone-100 border border-stone-200/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-stone-800"
              >
                <PhoneCall className="w-4 h-4 text-emerald-700 shrink-0" />
                <div>
                  <h4 className="text-[11px] font-bold">Ligue CVV (188)</h4>
                  <span className="text-[9px] text-stone-500 block">Prevenção / sigilo absoluto</span>
                </div>
              </a>

              <a
                href="tel:192"
                className="bg-stone-50 hover:bg-stone-100 border border-stone-200/50 p-3 rounded-xl flex items-center gap-2.5 transition-all text-stone-800"
              >
                <PhoneCall className="w-4 h-4 text-[#A45A52] shrink-0" />
                <div>
                  <h4 className="text-[11px] font-bold">Ligue SAMU (192)</h4>
                  <span className="text-[9px] text-stone-500 block">Atendimento médico móvel</span>
                </div>
              </a>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-stone-200/60 space-y-4">
            <div className="border-b pb-2">
              <h3 className="text-xs font-bold font-serif text-[#2F4738] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#D9B8A7]" />
                Meu Plano de Segurança de Crise
              </h3>
              <p className="text-[10px] text-stone-500 leading-normal pt-1">
                Construa uma lista de sintonização preventiva para rever em momentos em que você se sentir no limite de suas forças.
              </p>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-bold text-stone-400 font-mono block">
                  Sinais de Alerta Pessoais (Ex: pensamentos repetitivos, insônia profunda)
                </label>
                <textarea
                  value={safetyPlan.warningSigns}
                  onChange={(e) => setSafetyPlan({ ...safetyPlan, warningSigns: e.target.value })}
                  placeholder="Escreva os comportamentos que você percebe quando não está bem..."
                  rows={2}
                  className="w-full text-xs text-stone-800 bg-stone-50/50 border border-zinc-200 p-2.5 rounded-xl focus:border-[#2F4738] focus:outline-none focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-bold text-stone-400 font-mono block">
                  Estratégias de Regulação Saudáveis (Ex: caminhar, respirar, ouvir música calma)
                </label>
                <textarea
                  value={safetyPlan.copingStrategies}
                  onChange={(e) => setSafetyPlan({ ...safetyPlan, copingStrategies: e.target.value })}
                  placeholder="Quais ações te decompressam no momento de maior desassossego?"
                  rows={2}
                  className="w-full text-xs text-stone-800 bg-stone-50/50 border border-zinc-200 p-2.5 rounded-xl focus:border-[#2F4738] focus:outline-none focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-bold text-stone-400 font-mono block">
                  Pessoas de Confiança ou Apoio Emocional (Nomes e Telefones)
                </label>
                <textarea
                  value={safetyPlan.supportPeople}
                  onChange={(e) => setSafetyPlan({ ...safetyPlan, supportPeople: e.target.value })}
                  placeholder="Citar contato de amigo, parceiro ou familiar que possa te amparar se precisar..."
                  rows={2}
                  className="w-full text-xs text-stone-800 bg-stone-50/50 border border-zinc-200 p-2.5 rounded-xl focus:border-[#2F4738] focus:outline-none focus:bg-white"
                />
              </div>

              <div className="space-y-1 border-t pt-3 mt-4">
                <label className="text-[9px] uppercase tracking-wider font-bold text-[#A45A52] font-mono block">
                  📞 Contato Urgente do Paciente em caso de Risco (Contato de Emergência)
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <input
                    type="text"
                    value={emergencyContact.name}
                    onChange={(e) => setEmergencyContact({ ...emergencyContact, name: e.target.value })}
                    placeholder="Nome do responsável"
                    className="text-xs text-stone-800 bg-stone-50/50 border border-[#D9B8A7]/30 p-2 rounded-xl focus:border-[#2F4738] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={emergencyContact.phone}
                    onChange={(e) => setEmergencyContact({ ...emergencyContact, phone: e.target.value })}
                    placeholder="Celular do responsável"
                    className="text-xs text-stone-800 bg-stone-50/50 border border-[#D9B8A7]/30 p-2 rounded-xl focus:border-[#2F4738] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveContactAndPlan}
                disabled={savingData}
                className="w-full mt-3 bg-[#2F4738] hover:bg-[#1E2E24] text-white text-[10.5px] font-bold py-2.5 px-4 rounded-lg cursor-pointer transition-colors"
              >
                {savingData ? "Atualizando prontuário..." : "Salvar Plano de Segurança e Emergência"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUBTAB 4: PRIVACY (LGPD MEUS DADOS) --- */}
      {activeSubTab === "lgpd" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200/60 space-y-4">
            <h3 className="text-xs font-bold font-serif text-[#2F4738] border-b pb-2 border-stone-100 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#D9B8A7]" />
              Edição do Perfil de Saúde (Criptografada)
            </h3>

            <div className="space-y-3 font-sans text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-stone-400 font-mono font-bold block">
                    Nome Social (Se houver)
                  </label>
                  <input
                    type="text"
                    value={socialName}
                    onChange={(e) => setSocialName(e.target.value)}
                    placeholder="Como prefere ser chamado"
                    className="w-full text-xs text-[#1E2822] bg-stone-50/50 border border-zinc-200 p-2.5 rounded-xl focus:border-[#2F4738] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-stone-400 font-mono font-bold block">
                    Pronomes (Se houver)
                  </label>
                  <input
                    type="text"
                    value={pronouns}
                    onChange={(e) => setPronouns(e.target.value)}
                    placeholder="Ela/Dela, Ele/Dele"
                    className="w-full text-xs text-[#1E2822] bg-stone-50/50 border border-zinc-200 p-2.5 rounded-xl focus:border-[#2F4738] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-stone-400 font-mono font-bold block">
                    Gênero
                  </label>
                  <input
                    type="text"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    placeholder="Ex: Feminino"
                    className="w-full text-xs text-[#1E2822] bg-stone-50/50 border border-zinc-200 p-2.5 rounded-xl focus:border-[#2F4738] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-stone-400 font-mono font-bold block">
                    Data de Nascimento
                  </label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full text-xs text-[#1E2822] bg-stone-50/50 border border-zinc-200 p-2.5 rounded-xl focus:border-[#2F4738] focus:outline-none animate-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-stone-400 font-mono font-bold block">
                    Número do CPF (GCM Encrypted)
                  </label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full text-xs text-[#1E2822] bg-stone-50/50 border border-zinc-200 p-2.5 rounded-xl focus:border-[#2F4738] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-stone-400 font-mono font-bold block">
                    Celular de Contato
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full text-xs text-[#1E2822] bg-stone-50/50 border border-zinc-200 p-2.5 rounded-xl focus:border-[#2F4738] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveContactAndPlan}
                disabled={savingData}
                className="w-full bg-[#2F4738] hover:bg-[#1E2E24] text-white text-[11px] font-bold py-3 px-4 rounded-xl cursor-pointer transition-transform"
              >
                {savingData ? "Salvando prontuário criptografado..." : "Gravar Informações com Segurança Estrita"}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-stone-200/60 space-y-4">
            <h3 className="text-xs font-bold font-serif text-[#2F4738] border-b pb-2 border-stone-100">
              Autenticação Multi-Fator (MFA)
            </h3>
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <p className="text-[11px] font-bold text-stone-800">Ativar 2FA na conta</p>
                <p className="text-[9.5px] text-zinc-500 leading-normal font-sans">
                  Adiciona uma camada extra de segurança aos seus dados de saúde limitando acessos paralelos e validando tentativas de logins suspiciosos.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={mfaEnabled}
                  onChange={(e) => handleToggleMFA(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2F4738]"></div>
              </label>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-stone-200/60 space-y-4 font-sans">
            <div className="border-b pb-2 border-stone-100">
              <h3 className="text-xs font-bold font-serif text-[#2F4738]">Portabilidade & Exclusão de Prontuário</h3>
              <p className="text-[9.5px] text-zinc-500">
                Seus direitos fundamentais declarados na Lei Geral de Proteção de Dados (Artigo 18 da Lei 13.709/18):
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={handleExportData}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <h4 className="text-[11px] font-bold text-stone-800">Exportação Direta de Prontuário</h4>
                    <span className="text-[9px] text-stone-500 block">Backup estruturado (JSON de portabilidade legítima)</span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              <button
                onClick={handleAnonymize}
                disabled={anonymizing}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-rose-100 hover:bg-rose-50/50 transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <UserMinus className="w-4 h-4 text-[#A45A52] shrink-0" />
                  <div>
                    <h4 className="text-[11px] font-bold text-[#A45A52]">Revogar Conta (Direito ao Esquecimento)</h4>
                    <span className="text-[9px] text-rose-700/60 block">Exclui/anonimiza todos os diários e PII do consultório</span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#A45A52]/40" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
