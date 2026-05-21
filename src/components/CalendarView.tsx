import { useState } from "react";
import { Appointment, AvailabilityDay, User } from "../types";
import { Calendar as CalendarIcon, Clock, CheckCircle, AlertTriangle, HelpCircle, XCircle } from "lucide-react";

interface CalendarProps {
  user: User;
  availabilities: AvailabilityDay[];
  myAppointments: Appointment[];
  onRequestAppointment: (date: string, time: string) => Promise<{ success: boolean; error?: string; limitExceeded?: boolean }>;
  loading: boolean;
}

export default function CalendarView({ user, availabilities, myAppointments, onRequestAppointment, loading }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [errorText, setErrorText] = useState("");
  const [limitExceeded, setLimitExceeded] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const getGoogleCalendarLink = (date: string, time: string) => {
    const dateParts = date.split("-");
    const timeParts = time.split(":");
    if (dateParts.length === 3 && timeParts.length >= 2) {
      const year = dateParts[0];
      const month = dateParts[1];
      const day = dateParts[2];
      const hour = timeParts[0];
      const minute = timeParts[1];

      const startLocal = `${year}${month}${day}T${hour}${minute}00`;

      // 50 minutes psychotherapy session standard duration
      const startObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10));
      const endObj = new Date(startObj.getTime() + 50 * 60 * 1000);

      const endYear = String(endObj.getFullYear());
      const endMonth = String(endObj.getMonth() + 1).padStart(2, "0");
      const endDay = String(endObj.getDate()).padStart(2, "0");
      const endHour = String(endObj.getHours()).padStart(2, "0");
      const endMinute = String(endObj.getMinutes()).padStart(2, "0");

      const endLocal = `${endYear}${endMonth}${endDay}T${endHour}${endMinute}00`;

      const title = encodeURIComponent("Sessão de Psicoterapia - Dra. Elieyd Barreto");
      const details = encodeURIComponent("Sua sessão de psicoterapia individual com a Dra. Elieyd Barreto. Prepare um local calmo e acolhedor.");
      const ctz = "America/Sao_Paulo";
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startLocal}/${endLocal}&details=${details}&ctz=${ctz}`;
    }
    return "";
  };

  // Filter out any past or empty availabilities
  const activeAvailabilities = availabilities.filter((av) => {
    return av.slots && av.slots.length > 0;
  });

  const handleBook = async () => {
    if (!selectedDate || !selectedTime) return;
    setErrorText("");
    setLimitExceeded(false);

    const res = await onRequestAppointment(selectedDate, selectedTime);
    if (res.success) {
      setBookingSuccess(true);
      setSelectedTime("");
      setTimeout(() => setBookingSuccess(false), 4000);
    } else {
      setErrorText(res.error || "Ocorreu um erro ao processar o agendamento.");
      if (res.limitExceeded) {
        setLimitExceeded(true);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="text-[9px] font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-100/60 inline-flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Aguardando aprovação
          </span>
        );
      case "confirmed":
        return (
          <span className="text-[9px] font-medium bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-100/60 inline-flex items-center gap-1.5">
            <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
            Confirmado
          </span>
        );
      case "rescheduled":
        return (
          <span className="text-[9px] font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100/60 inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Reagendado
          </span>
        );
      case "canceled":
        return (
          <span className="text-[9px] font-medium bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full border border-rose-100/60 inline-flex items-center gap-1.5">
            <XCircle className="w-2.5 h-2.5 text-rose-600" />
            Cancelado
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-md mx-auto pb-16">
      {/* Appointment limit disclaimer banner */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-100/90 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-800 tracking-tight flex items-center gap-1.5 font-sans">
          <CalendarIcon className="w-4 h-4 text-emerald-600" />
          Solicitar Agendamento
        </h3>

        <div className="bg-slate-50 rounded-xl p-3 border border-zinc-100">
          <p className="text-[10px] text-zinc-500 leading-relaxed font-sans">
            📌 <b>Políticas da Clínica:</b><br />
            Você pode solicitar no máximo <b>1 horário por dia</b> e <b>2 horários por semana</b>. O horário selecionado será pré-bloqueado e encaminhado para validação e aprovação da psicóloga Elieyd Barreto bot/email.
          </p>
        </div>

        {activeAvailabilities.length === 0 ? (
          <div className="text-center py-6 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
            <span className="text-2xl block mb-1">📅</span>
            <p className="text-xs text-zinc-400">Nenhum dia disponível na agenda pública no momento. Por favor, contate a psicóloga para saber as vagas extras.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1: Select available date */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono block mb-1.5 font-medium">
                1. Escolha o dia da sessão:
              </label>
              <select
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedTime("");
                  setErrorText("");
                  setLimitExceeded(false);
                }}
                className="w-full text-xs text-zinc-700 bg-zinc-50 border border-zinc-100 p-3 rounded-xl focus:border-emerald-300 focus:outline-none transition-colors"
                title="Selecione o Dia"
              >
                <option value="">-- Selecione um dia disponível --</option>
                {activeAvailabilities.map((av) => (
                  <option key={av.date} value={av.date}>
                    {new Date(av.date + "T00:00:00").toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long"
                    })}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Select timeslots */}
            {selectedDate && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono block mb-1.5 font-medium">
                  2. Horários disponíveis (1 em 1 hora):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(activeAvailabilities.find((av) => av.date === selectedDate)?.slots || []).map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => {
                        setSelectedTime(time);
                        setErrorText("");
                        setLimitExceeded(false);
                      }}
                      className={`py-2 px-1 text-center rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                        selectedTime === time
                          ? "bg-emerald-700 border-emerald-700 text-white font-medium"
                          : "bg-white border-zinc-100 hover:bg-zinc-50 text-zinc-700"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Error notifications & Rules warning */}
            {errorText && (
              <div className="bg-red-50 text-red-800 p-3.5 rounded-xl border border-red-100 flex items-start gap-2.5">
                {limitExceeded ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 animate-bounce" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-xs font-semibold">{limitExceeded ? "Limite Semanal Excedido" : "Não foi possível agendar"}</h4>
                  <p className="text-[10px] leading-relaxed mt-1">{errorText}</p>
                </div>
              </div>
            )}

            {/* Success Booking notification */}
            {bookingSuccess && (
              <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 p-3.5 rounded-xl flex items-start gap-2.5">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold">Solicitação Enviada!</h4>
                  <p className="text-[10px] leading-relaxed mt-1">
                    Seu horário foi reservado. A Dra. Elieyd foi notificada via e-mail & Telegram e avaliará sua consulta. Você receberá uma confirmação assim que for validado!
                  </p>
                </div>
              </div>
            )}

            {/* Request Button */}
            <button
              onClick={handleBook}
              disabled={loading || !selectedDate || !selectedTime}
              className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-40"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  Agendar Sessão
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Patient's Appointments History */}
      <div className="space-y-4">
        <h4 className="text-xs uppercase tracking-wider text-zinc-400 font-mono font-semibold px-1">
          Minhas Sessões ({myAppointments.length})
        </h4>

        {myAppointments.length === 0 ? (
          <div className="text-center py-8 bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200/60 p-6">
            <span className="text-2xl text-zinc-300 block mb-1">📅</span>
            <p className="text-xs text-zinc-400 font-sans max-w-[220px] mx-auto">Você não possui nenhuma consulta em andamento ou histórico registrado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myAppointments.map((appt) => {
              const formattedDate = new Date(appt.date + "T00:00:00").toLocaleDateString("pt-BR", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric"
              });

              return (
                <div key={appt.id} className="bg-white rounded-xl p-4 shadow-xs border border-zinc-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-mono text-zinc-400 text-[10px]">
                      <CalendarIcon className="w-3 h-3 text-emerald-500" />
                      <span>{formattedDate}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-700 text-xs font-semibold">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span>{appt.time}h</span>
                    </div>
                    {appt.notes && (
                      <p className="text-[10px] text-zinc-500 bg-slate-50 p-1.5 rounded-lg border border-zinc-100">
                        💬 Obs: {appt.notes}
                      </p>
                    )}
                  </div>

                  <div className="text-right flex flex-col items-end gap-1.5">
                    {getStatusBadge(appt.status)}
                    {(appt.status === "confirmed" || appt.status === "rescheduled") && (
                      <a
                        href={getGoogleCalendarLink(appt.date, appt.time)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[9px] font-bold text-[#2F4738] bg-[#D9B8A7]/20 hover:bg-[#D9B8A7]/35 px-2.5 py-1 rounded-full transition-all border border-[#D9B8A7]/25 cursor-pointer shadow-2xs hover:scale-102"
                      >
                        <CalendarIcon className="w-2.5 h-2.5 text-[#2F4738]" /> Add Agenda
                      </a>
                    )}
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
