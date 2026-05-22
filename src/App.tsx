import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { User, JournalEntry, Appointment, AvailabilityDay, ReflectiveMessage, SystemNotification, EmailTemplate, EducationalContent } from "./types";
import InstagramReflections from "./components/InstagramReflections";
import DiaryView from "./components/DiaryView";
import CalendarView from "./components/CalendarView";
import ResourcesHub from "./components/ResourcesHub";
import {
  Heart,
  Calendar,
  BookOpen,
  Settings,
  Users,
  User as UserIcon,
  LogOut,
  Sparkles,
  Inbox,
  AlertCircle,
  Clock,
  Check,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Smartphone,
  Info,
  Sliders,
  Save,
  CheckCircle,
  MessageCircle,
  ArrowRight,
  FileText,
  Brain,
  Mic,
  Volume2,
  Play,
  StopCircle,
  UploadCloud,
  CreditCard,
  Printer,
  Download,
  TrendingUp,
  Plus,
  Copy,
  ShieldCheck
} from "lucide-react";

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPatientStatus(user: User, appointments: Appointment[]): { id: string; label: string; color: string; bgClass: string; textClass: string; borderClass: string } {
  if (user.manualStatus) {
    if (user.manualStatus === 'desistiu') {
      return { id: 'desistiu', label: 'Desistiu', color: 'gray', bgClass: 'bg-zinc-100', textClass: 'text-zinc-650', borderClass: 'border-zinc-200' };
    }
    if (user.manualStatus === 'ativo') {
      return { id: 'ativo', label: 'Ativo Assíduo', color: 'emerald', bgClass: 'bg-emerald-50', textClass: 'text-emerald-800', borderClass: 'border-emerald-250' };
    }
    if (user.manualStatus === 'sem_sessao') {
      return { id: 'sem_sessao', label: 'Sem sessão agendada', color: 'amber', bgClass: 'bg-amber-50/60', textClass: 'text-amber-850', borderClass: 'border-amber-200' };
    }
    if (user.manualStatus === 'agendado') {
      return { id: 'agendado', label: 'Agendado', color: 'sky', bgClass: 'bg-sky-50', textClass: 'text-sky-850', borderClass: 'border-sky-300' };
    }
    if (user.manualStatus === 'ausente') {
      return { id: 'ausente', label: 'Ausente (>15d)', color: 'rose', bgClass: 'bg-rose-50', textClass: 'text-rose-850', borderClass: 'border-rose-300' };
    }
  }

  const userAppts = appointments.filter(a => a.userId === user.id);
  
  if (userAppts.length === 0) {
    return { id: 'sem_sessao', label: 'Sem sessão agendada', color: 'amber', bgClass: 'bg-amber-50/50', textClass: 'text-[#9A735C]', borderClass: 'border-[#D9B8A7]/30' };
  }

  const todayStr = getTodayString();

  const hasUpcoming = userAppts.some(a => {
    const isFuture = a.date >= todayStr;
    const isActive = a.status === 'pending' || a.status === 'confirmed' || a.status === 'rescheduled';
    return isFuture && isActive;
  });

  const hasCompleted = userAppts.some(a => a.status === 'completed');

  if (hasUpcoming) {
    return { id: 'agendado', label: 'Agendado', color: 'sky', bgClass: 'bg-sky-55', textClass: 'text-sky-800', borderClass: 'border-sky-200' };
  }

  if (hasCompleted) {
    const completedAppts = userAppts.filter(a => a.status === 'completed').sort((a, b) => b.date.localeCompare(a.date));
    const lastCompleted = completedAppts[0];
    
    const lastDate = new Date(`${lastCompleted.date}T00:00:00`);
    const todayDate = new Date(`${todayStr}T00:00:00`);
    const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 15) {
      return { id: 'ausente', label: `Ausente (${diffDays} dias sem agendamento)`, color: 'rose', bgClass: 'bg-rose-50', textClass: 'text-rose-800 border-rose-200', borderClass: 'border-rose-200' };
    } else {
      return { id: 'ativo', label: 'Ativo Assíduo', color: 'emerald', bgClass: 'bg-emerald-50', textClass: 'text-emerald-800', borderClass: 'border-emerald-200' };
    }
  }

  return { id: 'sem_sessao', label: 'Sem sessão agendada', color: 'amber', bgClass: 'bg-amber-50', textClass: 'text-amber-800', borderClass: 'border-[#D9B8A7]/30' };
}

function getDurationText(createdAtStr: string): string {
  if (!createdAtStr) return "S/D";
  const diff = Date.now() - new Date(createdAtStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Hoje";
  if (days === 1) return "1 dia";
  if (days < 30) return `${days} dias`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 mês";
  return `${months} meses`;
}

const originalFetch = window.fetch;
const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let url = typeof input === "string" ? input : (input instanceof URL ? input.href : (input as Request).url);
  if (url && url.startsWith("/api/")) {
    const apiBase = ((import.meta as any).env.VITE_API_URL as string) || "";
    if (apiBase) {
      const cleanBase = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
      url = `${cleanBase}${url}`;
    }
  }
  
  if (typeof input === "string" || input instanceof URL) {
    return originalFetch(url, init);
  } else {
    const newRequest = new Request(url, input);
    return originalFetch(newRequest, init);
  }
};

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Google Single Sign-In/Register states
  const [googleUser, setGoogleUser] = useState<{ name: string; email: string } | null>(null);
  const [isCompletingGoogleRegister, setIsCompletingGoogleRegister] = useState(false);
  const [googlePhone, setGooglePhone] = useState("");
  const [isGoogleChooserOpen, setIsGoogleChooserOpen] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");
  const [customGoogleName, setCustomGoogleName] = useState("");
  const [isAddingCustomGoogleAccount, setIsAddingCustomGoogleAccount] = useState(false);

  // Common client data streams
  const [reflections, setReflections] = useState<ReflectiveMessage[]>([]);
  const [availabilities, setAvailabilities] = useState<AvailabilityDay[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<JournalEntry[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<SystemNotification[]>([]);

  // Admin insights state
  const [patientsList, setPatientsList] = useState<User[]>([]);
  const [selectedAdminPatientDiary, setSelectedAdminPatientDiary] = useState<{ patient: User; entries: JournalEntry[] } | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // General loading/busy variables
  const [loading, setLoading] = useState(false);
  const [refGenerating, setRefGenerating] = useState(false);

  // Active Screen Selector for Patient: 'stories' | 'diary' | 'calendar' | 'resources'
  const [activeTab, setActiveTab] = useState<"stories" | "diary" | "calendar" | "resources">("stories");

  // Active View Selector for Admin: 'agenda' | 'patients' | 'finance' | 'availability' | 'logs' | 'config'
  const [adminTab, setAdminTab] = useState<"agenda" | "patients" | "finance" | "availability" | "logs" | "config">("agenda");

  // Dynamic Credentials Manager Admin Settings States
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleCalendarId, setGoogleCalendarId] = useState("primary");
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [testResults, setTestResults] = useState<any | null>(null);
  const [testing, setTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Pre-session reminder configuration states
  const [reminderMinutes, setReminderMinutes] = useState("30");
  const [reminderAdditionalMsg, setReminderAdditionalMsg] = useState("");
  const [reminderQty, setReminderQty] = useState("1");
  const [reminderCompulsoryMsg, setReminderCompulsoryMsg] = useState("");
  const [reminderTriggerMessage, setReminderTriggerMessage] = useState<string | null>(null);
  const [triggeringReminders, setTriggeringReminders] = useState(false);
  const [isAdminViewingAsPatient, setIsAdminViewingAsPatient] = useState(false);

  // Custom Pix Configuration States
  const [pixKey, setPixKey] = useState("");
  const [pixBeneficiaryName, setPixBeneficiaryName] = useState("");
  const [pixCity, setPixCity] = useState("");

  // States for Educational Material and Email Templates
  const [eduTitle, setEduTitle] = useState("");
  const [eduCategory, setEduCategory] = useState("Ansiedade");
  const [eduType, setEduType] = useState<"article" | "video" | "podcast">("article");
  const [eduDuration, setEduDuration] = useState("5 min");
  const [eduSummary, setEduSummary] = useState("");
  const [eduUrl, setEduUrl] = useState("");
  const [emailTemplatesList, setEmailTemplatesList] = useState<EmailTemplate[]>([]);
  const [selectedTemplateForEdit, setSelectedTemplateForEdit] = useState<EmailTemplate | null>(null);
  const [editTemplateSubject, setEditTemplateSubject] = useState("");
  const [editTemplateBody, setEditTemplateBody] = useState("");
  const [eduList, setEduList] = useState<EducationalContent[]>([]);

  // Invoicing & clinical receipt states
  const [receiptModalAppt, setReceiptModalAppt] = useState<Appointment | null>(null);
  const [receiptCPF, setReceiptCPF] = useState("");
  const [receiptCRP, setReceiptCRP] = useState("06/158925");
  const [receiptValue, setReceiptValue] = useState("180,00");
  const [generatedReceiptResult, setGeneratedReceiptResult] = useState<any | null>(null);

  // Dynamic Financial Dashboard and Patient Checkout States
  const [checkoutApptId, setCheckoutApptId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('pay');
  });
  const [checkoutAppt, setCheckoutAppt] = useState<any | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [billingSentApptId, setBillingSentApptId] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);

  // States for financial dashboard filtering and receipt creation
  const [financialSearch, setFinancialSearch] = useState("");
  const [financialStatusFilter, setFinancialStatusFilter] = useState<string>("all");
  const [selectedReceiptPatient, setSelectedReceiptPatient] = useState<User | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptCpf, setReceiptCpf] = useState("");
  const [receiptCrp, setReceiptCrp] = useState("CRP 11/21054");
  const [receiptCnpj, setReceiptCnpj] = useState("45.123.789/0001-00");
  const [receiptCid, setReceiptCid] = useState("");
  const [receiptSelectedAppts, setReceiptSelectedAppts] = useState<string[]>([]);
  const [renderedReceipt, setRenderedReceipt] = useState<any | null>(null);
  const [isReceiptGeneratedPreviewOpen, setIsReceiptGeneratedPreviewOpen] = useState(false);

  // Rescheduling modal state (Admin quick update)
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [reschedDate, setReschedDate] = useState("");
  const [reschedTime, setReschedTime] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  // WhatsApp notification modal states
  const [whatsappModalAppt, setWhatsappModalAppt] = useState<Appointment | null>(null);
  const [whatsappTemplateType, setWhatsappTemplateType] = useState<"confirm" | "reminder" | "reschedule" | "cancel">("confirm");
  const [whatsappMessageText, setWhatsappMessageText] = useState("");

  // Professional Session Notes & AI Dynamic Consultant states
  const [selectedSessionPatient, setSelectedSessionPatient] = useState<User | null>(null);
  const [isSessionNotesModalOpen, setIsSessionNotesModalOpen] = useState(false);
  const [sessionNotesHistory, setSessionNotesHistory] = useState<any[]>([]);
  const [newSessionNoteText, setNewSessionNoteText] = useState("");
  const [newSessionNoteDate, setNewSessionNoteDate] = useState("");
  const [newSessionNoteTime, setNewSessionNoteTime] = useState("");
  const [isNoteSavingAndAnalyzing, setIsNoteSavingAndAnalyzing] = useState(false);

  // Audio support for notes
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedAudioChunks, setRecordedAudioChunks] = useState<Blob[]>([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingIntervalId, setRecordingIntervalId] = useState<any | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [expandedInsightNoteId, setExpandedInsightNoteId] = useState<string | null>(null);
  const [selectedHistoryPatient, setSelectedHistoryPatient] = useState<User | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const getWhatsAppTemplateMessage = (type: string, appt: Appointment) => {
    const meetLink = appt.meetLink || `https://meet.google.com/abc-defg-hij`;
    const formattedDate = new Date(appt.date).toLocaleDateString("pt-BR");
    const firstName = appt.patientName.split(" ")[0];
    
    switch (type) {
      case "confirm":
        return `Olá ${firstName}! Tudo bem? Passando para confirmar nossa consulta agendada para o dia ${formattedDate} às ${appt.time}h. O link da nossa sala virtual do Google Meet é:\n${meetLink}\n\nEsperamos você com carinho! ✨`;
      case "reminder":
        return `Olá ${firstName}! Lembrete amigável: hoje temos nosso encontro marcado para as ${appt.time}h. Segue o link para nossa sala virtual:\n${meetLink}\n\nNos vemos em breve! 🌱`;
      case "reschedule":
        return `Olá ${firstName}! Confirmando nossa alteração de horário: nosso atendimento ficou reagendado para o dia ${formattedDate} às ${appt.time}h. O novo link do Google Meet é:\n${meetLink}\n\nAté lá! 😊`;
      case "cancel":
        return `Olá ${firstName}! Passando para comunicar que nossa consulta marcada para o dia ${formattedDate} às ${appt.time}h precisou ser cancelada. Se tiver alguma dúvida ou quiser reagendar, sinta-se à vontade para enviar um registro no seu diário ou acessar o calendário novamente.\n\nAbraços, Dra. Elieyd Barreto.`;
      default:
        return `Olá ${firstName}! Tudo bem?`;
    }
  };

  // --- RECONECTAR AUTOMATICAMENTE, SENHA TEMPORÁRIA E RECUPERAÇÃO DE ACESSO ---

  // Password Recovery States
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<"request" | "verify">("request");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryNewPassword, setRecoveryNewPassword] = useState("");
  const [recoverySuccess, setRecoverySuccess] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // Temporary Password states for active patient login block
  const [tempNewPassword, setTempNewPassword] = useState("");
  const [tempConfirmPassword, setTempConfirmPassword] = useState("");
  const [tempPassError, setTempPassError] = useState("");
  const [tempPassLoading, setTempPassLoading] = useState(false);

  // Forced Profile Update States for patient login block
  const [forcedEmail, setForcedEmail] = useState("");
  const [forcedPhone, setForcedPhone] = useState("");
  const [profileUpdateError, setProfileUpdateError] = useState("");
  const [profileUpdateLoading, setProfileUpdateLoading] = useState(false);

  // Restoration on mount
  useEffect(() => {
    const saved = localStorage.getItem("clinical_session_user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && parsed.id) {
          setCurrentUser(parsed);
        }
      } catch (err) {
        console.error("Erro restaurando sessão:", err);
        localStorage.removeItem("clinical_session_user");
      }
    }
  }, []);

  // Sync forced inputs when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setForcedEmail(currentUser.email || "");
      setForcedPhone(currentUser.phone || "");
    }
  }, [currentUser]);

  // Handler to request a 6-digit verification code
  const handleRequestRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setRecoverySuccess("");
    if (!recoveryEmail) {
      setAuthError("Favor preencher o campo e-mail.");
      return;
    }

    setRecoveryLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoveryEmail })
      });

      if (response.ok) {
        const data = await response.json();
        // Injetamos uma nota amigável instruindo o código caso queiram testar sem o bot Telegram ativo
        setRecoverySuccess(`${data.message} ${data.code ? `(Seu código temporário para testes rápidos é: ${data.code})` : ""}`);
        setRecoveryStep("verify");
      } else {
        const err = await response.json();
        setAuthError(err.error || "E-mail não localizado.");
      }
    } catch (err) {
      setAuthError("Erro de comunicação com o servidor.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  // Handler for Password Recovery Execution using verification code
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setRecoverySuccess("");
    if (!recoveryEmail || !recoveryCode || !recoveryNewPassword) {
      setAuthError("Todos os campos obrigatórios do formulário devem ser definidos.");
      return;
    }

    setRecoveryLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: recoveryEmail,
          code: recoveryCode,
          newPassword: recoveryNewPassword
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        setIsRecoveringPassword(false);
        setRecoveryStep("request");
        setAuthEmail(recoveryEmail); // Autoset user's e-mail as username in standard field
        setRecoveryEmail("");
        setRecoveryCode("");
        setRecoveryNewPassword("");
      } else {
        const err = await response.json();
        setAuthError(err.error || "Operação falhou.");
      }
    } catch (err) {
      setAuthError("Erro de comunicação com o servidor.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  // Handler for Saving Temporary to Permanent Password
  const handleSavePermanentPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setTempPassError("");
    if (!currentUser) return;
    if (!tempNewPassword || !tempConfirmPassword) {
      setTempPassError("Campos de nova senha são obrigatórios.");
      return;
    }
    if (tempNewPassword !== tempConfirmPassword) {
      setTempPassError("As senhas informadas não coincidem. Digite novamente.");
      return;
    }

    setTempPassLoading(true);
    try {
      const response = await fetch("/api/auth/change-temp-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          newPassword: tempNewPassword
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
        localStorage.setItem("clinical_session_user", JSON.stringify(data.user));
        setTempNewPassword("");
        setTempConfirmPassword("");
        alert("Sua senha permanente foi configurada com sucesso!");
      } else {
        const err = await response.json();
        setTempPassError(err.error || "Falha ao definir senha.");
      }
    } catch (err) {
      setTempPassError("Erro de comunicação.");
    } finally {
      setTempPassLoading(false);
    }
  };

  // Handler for Saving Forced Profile Update Details
  const handleSaveForcedProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileUpdateError("");
    if (!currentUser) return;
    if (!forcedEmail || !forcedPhone) {
      setProfileUpdateError("Os campos de e-mail e celular são inteiramente obrigatórios.");
      return;
    }

    setProfileUpdateLoading(true);
    try {
      const response = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          email: forcedEmail,
          phone: forcedPhone
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
        localStorage.setItem("clinical_session_user", JSON.stringify(data.user));
        alert("Cadastro atualizado com sucesso!");
      } else {
        const err = await response.json();
        setProfileUpdateError(err.error || "Falha ao atualizar.");
      }
    } catch (err) {
      setProfileUpdateError("Erro de comunicação ao salvar.");
    } finally {
      setProfileUpdateLoading(false);
    }
  };

  useEffect(() => {
    if (whatsappModalAppt) {
      setWhatsappMessageText(getWhatsAppTemplateMessage(whatsappTemplateType, whatsappModalAppt));
    }
  }, [whatsappModalAppt, whatsappTemplateType]);

  // Load checkout details if 'pay' parameter is detected in URL
  useEffect(() => {
    if (!checkoutApptId) return;
    setCheckoutLoading(true);
    fetch(`/api/appointments/${checkoutApptId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Atendimento não localizado ou link expirado.");
        return res.json();
      })
      .then((data) => {
        setCheckoutAppt(data);
        setCheckoutError(null);
      })
      .catch((err) => {
        setCheckoutError(err.message);
      })
      .finally(() => {
        setCheckoutLoading(false);
      });
  }, [checkoutApptId]);

  // Patient editor modal states
  const [editPatientForceProfileUpdate, setEditPatientForceProfileUpdate] = useState(false);
  const [generatedTempPassword, setGeneratedTempPassword] = useState("");
  const [tempPasswordLoading, setTempPasswordLoading] = useState(false);
  const [editingPatient, setEditingPatient] = useState<User | null>(null);
  const [editPatientName, setEditPatientName] = useState("");
  const [editPatientPhone, setEditPatientPhone] = useState("");
  const [editPatientGender, setEditPatientGender] = useState("");
  const [editPatientSessionType, setEditPatientSessionType] = useState<'presencial' | 'online'>("online");
  const [editPatientDiscoverySource, setEditPatientDiscoverySource] = useState("");
  const [editPatientClinicalNotes, setEditPatientClinicalNotes] = useState("");
  const [editPatientSessionPrice, setEditPatientSessionPrice] = useState<number>(150);
  const [editPatientPaymentStatus, setEditPatientPaymentStatus] = useState<'em_dia' | 'devendo'>("em_dia");
  const [editPatientManualStatus, setEditPatientManualStatus] = useState<'ativo' | 'sem_sessao' | 'agendado' | 'ausente' | 'desistiu' | "">("");

  // Availability Builder Temp State
  const [tempDate, setTempDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [tempSlots, setTempSlots] = useState<string[]>([
    "08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"
  ]);

  // Load backend static resources
  useEffect(() => {
    fetchReflections();
    fetchAvailabilities();
    if (currentUser) {
      if (currentUser.role === "admin") {
        fetchAdminData();
        if (isAdminViewingAsPatient) {
          fetchPatientData(currentUser.id);
        }
      } else {
        fetchPatientData(currentUser.id);
      }
    }
  }, [currentUser, isAdminViewingAsPatient]);

  // Fetch functions helpers
  const fetchReflections = async () => {
    try {
      const response = await fetch("/api/reflective-messages");
      if (response.ok) {
        const data = await response.json();
        // Reverse array list so newest appears first
        setReflections([...data].reverse());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAvailabilities = async () => {
    try {
      const response = await fetch("/api/availabilities");
      if (response.ok) {
        const data = await response.json();
        setAvailabilities(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPatientData = async (patientId: string) => {
    setLoading(true);
    try {
      // My journal entries query
      const dResponse = await fetch(`/api/diary?userId=${patientId}`);
      if (dResponse.ok) {
        const dData = await dResponse.json();
        setDiaryEntries(dData);
      }

      // My requested appointments query
      const aResponse = await fetch(`/api/appointments?userId=${patientId}`);
      if (aResponse.ok) {
        const aData = await aResponse.json();
        setAppointments(aData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminConfig = async () => {
    try {
      const response = await fetch("/api/admin/config");
      if (response.ok) {
        const config = await response.json();
        setSmtpHost(config.SMTP_HOST || "");
        setSmtpPort(config.SMTP_PORT || "587");
        setSmtpUser(config.SMTP_USER || "");
        setSmtpPass(config.SMTP_PASS || "");
        setSmtpFrom(config.SMTP_FROM || "");
        setTelegramToken(config.TELEGRAM_BOT_TOKEN || "");
        setTelegramChatId(config.TELEGRAM_CHAT_ID || "");
        setGeminiKey(config.GEMINI_API_KEY || "");
        setGoogleClientId(config.GOOGLE_CLIENT_ID || "");
        setGoogleClientSecret(config.GOOGLE_CLIENT_SECRET || "");
        setGoogleCalendarId(config.GOOGLE_CALENDAR_ID || "primary");
        setIsGoogleConnected(config.google_connected || false);
        setReminderMinutes(config.reminder_minutes || "30");
        setReminderAdditionalMsg(config.reminder_additional_msg || "");
        setReminderQty(config.reminder_qty || "1");
        setReminderCompulsoryMsg(config.reminder_compulsory_msg || "");
        setPixKey(config.PIX_KEY || "");
        setPixBeneficiaryName(config.PIX_BENEFICIARY_NAME || "");
        setPixCity(config.PIX_CITY || "");
      }
    } catch (err) {
      console.error("Erro ao carregar configurações administrador:", err);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Get entire patients list
      const pResponse = await fetch("/api/patients");
      if (pResponse.ok) {
        const pData = await pResponse.json();
        setPatientsList(pData);
      }

      // 2. Get globally requested appointments
      const aResponse = await fetch("/api/appointments");
      if (aResponse.ok) {
        const aData = await aResponse.json();
        setAppointments(aData);
      }

      // 3. Get notification/event records log
      const nResponse = await fetch("/api/admin/notifications");
      if (nResponse.ok) {
        const nData = await nResponse.json();
        setNotificationLogs(nData);
      }

      // 4. Get Dynamic Credentials config
      await fetchAdminConfig();

      // 5. Get clinical & privacy audit trail log
      const auditRes = await fetch("/api/admin/audit-logs");
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData);
      }

      // 6. Get educational items & email templates list
      const eduRes = await fetch("/api/educational-contents");
      if (eduRes.ok) {
        const eduData = await eduRes.json();
        setEduList(eduData);
      }
      const tplRes = await fetch("/api/admin/email-templates");
      if (tplRes.ok) {
        const tplData = await tplRes.json();
        setEmailTemplatesList(tplData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Auth processing
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!authEmail || !authPassword) {
      setAuthError("Favor preencher todos os dados.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
        if (rememberMe) {
          localStorage.setItem("clinical_session_user", JSON.stringify(data.user));
        } else {
          localStorage.removeItem("clinical_session_user");
        }
        setAuthPassword("");
        setAuthEmail("");
      } else {
        const err = await response.json();
        setAuthError(err.error || "Erro de login.");
      }
    } catch (err) {
      setAuthError("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    
    // VALIDACÃO ADICIONAL OBRIGATÓRIA DA REQUISIÇÃO
    if (!authEmail) {
      setAuthError("O campo de e-mail é estritamente obrigatório para criar conta.");
      return;
    }
    if (!authName || !authPhone || !authPassword) {
      setAuthError("Favor preencher todos os dados cadastrais necessários.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authName,
          email: authEmail,
          phone: authPhone,
          password: authPassword
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
        localStorage.setItem("clinical_session_user", JSON.stringify(data.user));
        setAuthPassword("");
        setAuthName("");
        setAuthPhone("");
        setAuthEmail("");
        setIsRegistering(false);
      } else {
        const err = await response.json();
        setAuthError(err.error || "Falha no preenchimento.");
      }
    } catch (err) {
      setAuthError("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  // Google Single Sign-In Handlers
  const handleGoogleSignInClick = async () => {
    setAuthError("");
    setLoading(true);
    try {
      const resStatus = await fetch("/api/auth/google/status");
      if (resStatus.ok) {
        const dataStatus = await resStatus.json();
        if (dataStatus.configured) {
          const resUrl = await fetch("/api/auth/google/auth-url");
          if (resUrl.ok) {
            const dataUrl = await resUrl.json();
            const authWindow = window.open(
              dataUrl.url,
              "google_oauth_popup",
              "width=585,height=650"
            );
            if (!authWindow) {
              setAuthError("Bloqueador de popups ativo. Permita popups para acessar com Google.");
            }
            setLoading(false);
            return;
          }
        }
      }
      
      // Fallback a simulação inteligente e elegante
      setCustomGoogleEmail("");
      setCustomGoogleName("");
      setIsGoogleChooserOpen(true);
    } catch (err) {
      console.error("Erro ao inicializar Google Auth:", err);
      setCustomGoogleEmail("");
      setCustomGoogleName("");
      setIsGoogleChooserOpen(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleGoogleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith(".run.app") && !origin.includes("localhost")) {
        return;
      }
      
      if (event.data?.type === "GOOGLE_SIGNIN_SUCCESS") {
        setCurrentUser(event.data.user);
        localStorage.setItem("clinical_session_user", JSON.stringify(event.data.user));
        setIsGoogleChooserOpen(false);
      } else if (event.data?.type === "GOOGLE_SIGNIN_NEW_USER") {
        setGoogleUser(event.data.googleUser);
        setIsCompletingGoogleRegister(true);
        setIsGoogleChooserOpen(false);
      }
    };
    
    window.addEventListener("message", handleGoogleMessage);
    return () => window.removeEventListener("message", handleGoogleMessage);
  }, []);

  const handleGoogleCheck = async (name: string, email: string) => {
    setAuthError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/google-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          // If user exists, log in instantly!
          setCurrentUser(data.user);
          localStorage.setItem("clinical_session_user", JSON.stringify(data.user));
          setIsGoogleChooserOpen(false);
        } else {
          // New user, trigger phone number completion step
          setGoogleUser({ name, email });
          setIsCompletingGoogleRegister(true);
          setIsGoogleChooserOpen(false);
        }
      } else {
        const err = await response.json();
        setAuthError(err.error || "Erro ao conectar com o Google.");
      }
    } catch (err) {
      setAuthError("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!googleUser) return;
    if (!googlePhone) {
      setAuthError("Favor preencher o número de telefone.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/google-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: googleUser.name,
          email: googleUser.email,
          phone: googlePhone
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
        localStorage.setItem("clinical_session_user", JSON.stringify(data.user));
        // Clear Google details
        setGoogleUser(null);
        setGooglePhone("");
        setIsCompletingGoogleRegister(false);
      } else {
        const err = await response.json();
        setAuthError(err.error || "Falha ao registrar com o Google.");
      }
    } catch (err) {
      setAuthError("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("clinical_session_user");
    setCurrentUser(null);
    setDiaryEntries([]);
    setAppointments([]);
    setPatientsList([]);
    setSelectedAdminPatientDiary(null);
  };

  // Curation Handlers for Educational & E-mail Templates
  const handleAddEduContent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/educational-contents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: eduTitle,
          category: eduCategory,
          type: eduType,
          duration: eduDuration,
          summary: eduSummary,
          url: eduUrl
        })
      });
      if (res.ok) {
        setEduTitle("");
        setEduSummary("");
        setEduUrl("");
        
        // Reload edu list
        const loadRes = await fetch("/api/educational-contents");
        if (loadRes.ok) {
          const listData = await loadRes.json();
          setEduList(listData);
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEduContent = async (id: string) => {
    try {
      const res = await fetch(`/api/educational-contents/${id}`, { method: "DELETE" });
      if (res.ok) {
        const loadRes = await fetch("/api/educational-contents");
        if (loadRes.ok) {
          const listData = await loadRes.json();
          setEduList(listData);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateForEdit) return;
    try {
      const res = await fetch(`/api/admin/email-templates/${selectedTemplateForEdit.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editTemplateSubject,
          body: editTemplateBody
        })
      });
      if (res.ok) {
        setSelectedTemplateForEdit(null);
        // Reload templates
        const loadTpl = await fetch("/api/admin/email-templates");
        if (loadTpl.ok) {
          const tplData = await loadTpl.json();
          setEmailTemplatesList(tplData);
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptModalAppt) return;
    try {
      const res = await fetch(`/api/appointments/${receiptModalAppt.id}/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpfoPaciente: receiptCPF,
          crp: receiptCRP,
          valor: receiptValue
        })
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedReceiptResult(data);
        // Refresh audit logs
        const auditRes = await fetch("/api/admin/audit-logs");
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditLogs(auditData);
        }
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao emitir recibo digital.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Patient Submissions: Write Journal record
  const handleAddDiaryEntry = async (text: string, mood: string) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const response = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          text,
          mood
        })
      });
      if (response.ok) {
        await fetchPatientData(currentUser.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Patient Submissions: Book Slot
  const handleBookAppointment = async (date: string, time: string) => {
    if (!currentUser) return { success: false, error: "Usuário desconectado." };
    setLoading(true);
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          date,
          time
        })
      });

      if (response.ok) {
        await fetchPatientData(currentUser.id);
        await fetchAvailabilities();
        return { success: true };
      } else {
        const err = await response.json();
        return {
          success: false,
          error: err.error,
          limitExceeded: err.limitExceeded
        };
      }
    } catch (err) {
      return { success: false, error: "Falha de comunicação." };
    } finally {
      setLoading(false);
    }
  };

  // Psychologist Submissions: Approve, Cancel, Reschedule states
  const handleUpdateAppointmentStatus = async (
    id: string,
    status: "confirmed" | "canceled" | "rescheduled",
    reschedD?: string,
    reschedT?: string,
    notesText?: string
  ) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/appointments/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          rescheduledDate: reschedD,
          rescheduledTime: reschedT,
          notes: notesText
        })
      });

      if (response.ok) {
        await fetchAdminData();
        await fetchAvailabilities();
        setReschedulingAppt(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Admin: inspect authorized patient's emotional journal entries
  const handleInspectPatientDiary = async (patient: User) => {
    if (!patient.authorizedForDiary) {
      alert("Este diário é restrito. O paciente revogou ou ainda não definiu a autorização de leitura.");
      return;
    }

    try {
      const response = await fetch(`/api/diary?userId=${patient.id}&requesterId=${currentUser?.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedAdminPatientDiary({ patient, entries: data });
      } else {
        alert("Não foi possível carregar o diário. Permissão negada pelo servidor.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Audio Recording, transcribing, and saving clinical notes
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        await handleAudioTranscription(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      setRecordedAudioChunks([]);
      setRecordingSeconds(0);
      
      const interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      setRecordingIntervalId(interval);
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecordingAudio(true);
    } catch (e) {
      console.error("Erro ao iniciar gravação de áudio:", e);
      alert("Não foi possível acessar seu microfone. Verifique as permissões de áudio da página.");
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorder && isRecordingAudio) {
      mediaRecorder.stop();
      setIsRecordingAudio(false);
      if (recordingIntervalId) {
        clearInterval(recordingIntervalId);
        setRecordingIntervalId(null);
      }
    }
  };

  const handleAudioTranscription = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const resultString = reader.result as string;
        if (!resultString) return;
        const base64String = resultString.split(",")[1];
        const response = await fetch(`/api/patients/${selectedSessionPatient?.id}/transcribe-audio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64: base64String,
            mimeType: "audio/webm"
          })
        });
        const data = await response.json();
        if (response.ok && data.transcription) {
          setNewSessionNoteText((prev) => {
            const separator = prev ? "\n\n" : "";
            return prev + separator + data.transcription;
          });
        } else {
          console.error("Erro ao transcrever:", data.error);
        }
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error("Erro ao processar áudio para transcrição:", e);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSaveSessionNote = async () => {
    if (!newSessionNoteText.trim()) {
      alert("Por favor, preencha as observações clínicas da sessão para gravar.");
      return;
    }

    setIsNoteSavingAndAnalyzing(true);
    try {
      const response = await fetch(`/api/patients/${selectedSessionPatient?.id}/session-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: newSessionNoteText,
          date: newSessionNoteDate || getTodayString(),
          time: newSessionNoteTime || "14:00"
        })
      });

      if (response.ok) {
        const data = await response.json();
        await fetchAdminData();
        
        // Refresh local history in modal
        const refreshedPatient = data.user;
        setSessionNotesHistory(refreshedPatient.sessionNotes || []);
        
        setNewSessionNoteText("");
        setNewSessionNoteDate(getTodayString());
        setNewSessionNoteTime(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }).substring(0, 5));
      } else {
        alert("Erro no servidor ao salvar e processar a anotação.");
      }
    } catch (e) {
      console.error("Erro ao registrar consulta e insights:", e);
    } finally {
      setIsNoteSavingAndAnalyzing(false);
    }
  };

  // Admin Availability Management additions
  const handleAddAvailabilityDay = async () => {
    if (!tempDate) return;
    const existing = availabilities.filter((av) => av.date !== tempDate);
    const updated = [...existing, { date: tempDate, slots: [...tempSlots].sort() }];

    try {
      const response = await fetch("/api/availabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availabilities: updated })
      });
      if (response.ok) {
        await fetchAvailabilities();
        alert(`Disponibilidade para ${new Date(tempDate + "T00:00:00").toLocaleDateString("pt-BR")} salva com sucesso.`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // AI Reflection Creator Call
  const handleTriggerAIGenerator = async (mood: string) => {
    setRefGenerating(true);
    try {
      const response = await fetch("/api/reflective-messages/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodContext: mood })
      });
      if (response.ok) {
        await fetchReflections();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefGenerating(false);
    }
  };

  // Clears live simulators dashboard logs
  const handleClearLogs = async () => {
    try {
      const response = await fetch("/api/admin/notifications/clear", { method: "POST" });
      if (response.ok) {
        await fetchAdminData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Save credentials configuration variables
  const handleSaveConfig = async () => {
    setSaveSuccess(false);
    try {
      const response = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          SMTP_HOST: smtpHost,
          SMTP_PORT: smtpPort,
          SMTP_USER: smtpUser,
          SMTP_PASS: smtpPass,
          SMTP_FROM: smtpFrom,
          TELEGRAM_BOT_TOKEN: telegramToken,
          TELEGRAM_CHAT_ID: telegramChatId,
          GEMINI_API_KEY: geminiKey,
          GOOGLE_CLIENT_ID: googleClientId,
          GOOGLE_CLIENT_SECRET: googleClientSecret,
          GOOGLE_CALENDAR_ID: googleCalendarId,
          reminder_minutes: reminderMinutes,
          reminder_additional_msg: reminderAdditionalMsg,
          reminder_qty: reminderQty,
          reminder_compulsory_msg: reminderCompulsoryMsg,
          PIX_KEY: pixKey,
          PIX_BENEFICIARY_NAME: pixBeneficiaryName,
          PIX_CITY: pixCity
        })
      });
      if (response.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 6000);
        await fetchAdminConfig();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Run dynamic testing and validations helper
  const handleTestConfig = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const response = await fetch("/api/admin/config/test", { method: "POST" });
      if (response.ok) {
        const results = await response.json();
        setTestResults(results);
      }
    } catch (e) {
      console.error("Erro ao testar configurações:", e);
    } finally {
      setTesting(false);
    }
  };

  // Connect Google Calendar OAuth flow
  const handleConnectGoogle = async () => {
    try {
      const response = await fetch("/api/auth/google-calendar/auth-url");
      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          window.open(data.url, "_blank");
        }
      }
    } catch (e) {
      console.error("Erro ao gerar link de autorização do Google:", e);
    }
  };

  // Disconnect Google Calendar OAuth flow
  const handleDisconnectGoogle = async () => {
    try {
      const response = await fetch("/api/auth/google-calendar/disconnect", { method: "POST" });
      if (response.ok) {
        await fetchAdminConfig();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerRemindersCheck = async () => {
    setTriggeringReminders(true);
    setReminderTriggerMessage(null);
    try {
      const response = await fetch("/api/admin/reminders/trigger-check", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setReminderTriggerMessage(data.message || "Auditoria de disparos de lembrete efetuada com sucesso!");
        if (data.notifications) {
          setNotificationLogs(data.notifications);
        }
        setTimeout(() => setReminderTriggerMessage(null), 10000);
      }
    } catch (e) {
      console.error(e);
      setReminderTriggerMessage("Erro de rede ao processar auditoria de lembretes.");
      setTimeout(() => setReminderTriggerMessage(null), 6000);
    } finally {
      setTriggeringReminders(false);
    }
  };

  const handleOpenEditPatient = (pat: User) => {
    setEditingPatient(pat);
    setEditPatientName(pat.name || "");
    setEditPatientPhone(pat.phone || "");
    setEditPatientGender(pat.gender || "Feminino");
    setEditPatientSessionType(pat.sessionType || "online");
    setEditPatientDiscoverySource(pat.discoverySource || "Instagram");
    setEditPatientClinicalNotes(pat.clinicalNotes || "");
    setEditPatientSessionPrice(pat.sessionPrice !== undefined ? pat.sessionPrice : 150);
    setEditPatientPaymentStatus(pat.paymentStatus || "em_dia");
    setEditPatientManualStatus(pat.manualStatus || "");
    setEditPatientForceProfileUpdate(!!pat.forceProfileUpdate);
    setGeneratedTempPassword("");
  };

  const handleSavePatientProfile = async (id: string) => {
    try {
      const response = await fetch(`/api/patients/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editPatientName,
          phone: editPatientPhone,
          gender: editPatientGender,
          sessionType: editPatientSessionType,
          discoverySource: editPatientDiscoverySource,
          clinicalNotes: editPatientClinicalNotes,
          sessionPrice: editPatientSessionPrice,
          paymentStatus: editPatientPaymentStatus,
          manualStatus: editPatientManualStatus,
          forceProfileUpdate: editPatientForceProfileUpdate
        })
      });
      if (response.ok) {
        setEditingPatient(null);
        await fetchAdminData();
      }
    } catch (e) {
      console.error("Erro ao salvar cadastro do paciente:", e);
    }
  };

  const handleUpdatePatientPriceAndStatus = async (patientId: string, customPrice: number, customStatus: string, customPayment: 'em_dia' | 'devendo') => {
    try {
      const patient = patientsList.find(p => p.id === patientId);
      if (!patient) return;
      const response = await fetch(`/api/patients/${patientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: patient.name,
          phone: patient.phone,
          gender: patient.gender || "",
          sessionType: patient.sessionType || "online",
          discoverySource: patient.discoverySource || "",
          clinicalNotes: patient.clinicalNotes || "",
          sessionPrice: Number(customPrice),
          paymentStatus: customPayment,
          manualStatus: customStatus
        })
      });
      if (response.ok) {
        await fetchAdminData();
      }
    } catch (err) {
      console.error("Erro ao atualizar dados financeiros do paciente:", err);
    }
  };

  const handleSendBillingEmail = async (apptId: string) => {
    setBillingSentApptId(apptId);
    try {
      const res = await fetch(`/api/appointments/${apptId}/send-billing-email`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.success) {
        // reload admin appointments list
        await fetchAdminData();
        alert("E-mail de cobrança emitido com sucesso! O paciente receberá os dados de Pix e Cartão.");
      }
    } catch (e) {
      console.error("Erro ao enviar cobrança por e-mail:", e);
    } finally {
      setBillingSentApptId(null);
    }
  };

  const getDayLabel = (dateStr: string) => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short"
    });
  };

  const handleConfirmCheckoutPayment = async (method: "pix" | "cartao") => {
    setSubmittingPayment(true);
    try {
      const response = await fetch(`/api/appointments/${checkoutApptId}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: method, paidValue: checkoutAppt?.sessionPrice })
      });
      const data = await response.json();
      if (data.success) {
        setPaymentSuccessMessage(`Pagamento compensado com sucesso!`);
        setCheckoutAppt((prev: any) => ({
          ...prev,
          paymentStatus: "pago",
          paymentMethod: method,
          paymentDate: new Date().toISOString()
        }));
        // Update local status of appointments if any loaded
        setAppointments((prevAppts) => 
          prevAppts.map((a) => a.id === checkoutApptId ? { ...a, paymentStatus: "pago" } : a)
        );
      }
    } catch (err) {
      console.error("Erro ao confirmar pagamento:", err);
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Standalone Clinical Checkout/Payment Portal Segment
  if (checkoutApptId) {
    const apptDateStr = checkoutAppt ? new Date(checkoutAppt.date + "T00:00:00").toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }) : "";

    return (
      <div className="min-h-screen bg-[#FAF8F6] text-[#1E2822] flex flex-col antialiased font-sans p-4 md:p-8 justify-center items-center">
        <div className="max-w-xl w-full bg-white rounded-3xl border border-[#D9B8A7]/40 shadow-2xl overflow-hidden animate-fade-in text-left">
          {/* Header */}
          <div className="bg-[#2F4738] p-6 text-center text-white relative">
            <span className="inline-block w-10 h-10 rounded-full bg-[#EBF5EF] text-[#2F4738] flex items-center justify-center font-serif font-bold text-sm mb-2 mx-auto shadow-sm">
              E
            </span>
            <h2 className="text-lg font-serif font-bold tracking-tight">Dra. Elieyd Barreto</h2>
            <p className="text-[10px] text-zinc-300 uppercase tracking-widest font-semibold">Psicologia Clínica & Neurociências</p>
            
            <button
              onClick={() => {
                // Clear query parameter and reload to standard home page
                window.history.pushState({}, "", window.location.pathname);
                setCheckoutApptId(null);
                setCheckoutAppt(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 text-xs transition-all cursor-pointer font-bold flex items-center justify-center"
              title="Voltar para a página de login"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {checkoutLoading ? (
            <div className="p-12 text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-[#2F4738] animate-spin mx-auto" />
              <p className="text-xs text-zinc-500 font-mono">Buscando dados seguros de faturamento...</p>
            </div>
          ) : checkoutError ? (
            <div className="p-8 text-center space-y-4">
              <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
              <h3 className="text-sm font-bold text-zinc-800">Erro de Cobrança</h3>
              <p className="text-xs text-zinc-500">{checkoutError}</p>
              <button
                onClick={() => {
                  window.history.pushState({}, "", window.location.pathname);
                  setCheckoutApptId(null);
                  setCheckoutAppt(null);
                }}
                className="px-4 py-2 bg-[#2F4738] hover:bg-[#1E2E24] text-white text-xs rounded-xl font-bold transition-all cursor-pointer"
              >
                Voltar à Página Principal
              </button>
            </div>
          ) : checkoutAppt ? (
            <div className="p-6 md:p-8 space-y-6">
              
              {/* Payment Details Card */}
              <div className="bg-[#FAF8F6] rounded-2xl p-4 border border-[#D9B8A7]/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-[8px] uppercase font-mono font-bold text-[#556B5D] tracking-wider bg-[#EBF5EF] px-2 py-0.5 rounded border border-[#D9B8A7]/25">
                    Consulta Clínico-Terapêutica
                  </span>
                  <h3 className="text-xs font-bold text-[#2F4738] mt-2 leading-tight">
                    Paciente: {checkoutAppt.patientName}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-sans mt-1">
                    📅 {apptDateStr} às {checkoutAppt.time}h ({checkoutAppt.modality === "online" ? "🌐 Online" : "🏢 Presencial"})
                  </p>
                </div>
                <div className="text-left md:text-right border-t md:border-t-0 border-zinc-100 pt-3 md:pt-0">
                  <span className="text-[9px] text-zinc-400 font-medium">Valor Total</span>
                  <p className="text-2xl font-bold font-serif text-[#2F4738]">
                    <span className="text-xs font-sans font-bold text-[#556B5D] mr-0.5">R$</span>
                    {Number(checkoutAppt.sessionPrice).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* PAID STATE: Render official receipt & therapeutic report summary */}
              {checkoutAppt.paymentStatus === "pago" ? (
                <div className="space-y-6 animate-fade-in">
                  <div className="bg-emerald-50 border border-emerald-200/85 p-4 rounded-2xl text-center space-y-1.5">
                    <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
                    <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider font-mono">Sessão Quitada com Sucesso</h3>
                    <p className="text-[10.5px] text-emerald-800 leading-relaxed font-sans max-w-sm mx-auto">
                      Sua transação R$ {Number(checkoutAppt.sessionPrice).toFixed(2)} foi compensada e registrada automaticamente no prontuário.
                    </p>
                  </div>

                  {/* Elegant Printable Receipt Template */}
                  <div id="clinical-receipt-print" className="bg-white border-2 border-zinc-200 rounded-2xl p-6 md:p-8 relative space-y-6 font-serif shadow-sm">
                    {/* Watermark badge */}
                    <div className="absolute top-4 right-4 opacity-15 border-2 border-emerald-800 text-emerald-800 text-[9px] uppercase tracking-widest font-sans font-bold px-3 py-1 rounded rotate-12">
                      Compensado Eletronicamente
                    </div>

                    <div className="text-center font-sans border-b border-zinc-100 pb-4">
                      <h4 className="text-sm font-bold text-[#2F4738] uppercase tracking-tight font-serif">Recibo Clínico de Atendimento</h4>
                      <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Dra. Elieyd Barreto • CRP 11/21054</p>
                    </div>

                    <p className="text-xs leading-relaxed text-zinc-700 italic">
                      "Declaro em conformidade fiscal e regulamentar do Conselho Federal de Psicologia que recebi do(a) paciente <strong className="text-zinc-900 not-italic">{checkoutAppt.patientName}</strong>, a importância de <strong className="text-zinc-900 not-italic">R$ {Number(checkoutAppt.sessionPrice).toFixed(2)} ({Number(checkoutAppt.sessionPrice) === 150 ? "cento e cinquenta reais" : "cento e oitenta reais"})</strong>, decorrente de honrarias referentes ao atendimento psicoterápico efetuado no dia <span className="text-zinc-900 not-italic">{apptDateStr} às {checkoutAppt.time}h</span>."
                    </p>

                    <div className="grid grid-cols-2 gap-4 text-[10px] font-sans border-t border-zinc-100 pt-4 text-zinc-500">
                      <div>
                        <p className="font-bold text-zinc-700">EMISSOR:</p>
                        <p className="mt-0.5">Dra. Elieyd Barreto</p>
                        <p>CPF: 014.225.889-00</p>
                        <p>Registro: CRP 11/21054</p>
                      </div>
                      <div>
                        <p className="font-bold text-zinc-700">STATUS DA TRANSAÇÃO:</p>
                        <p className="mt-0.5">Código PIX/TRANS: TX-{checkoutAppt.id.toUpperCase()}</p>
                        <p className="text-emerald-800 font-bold">Quitação: {new Date(checkoutAppt.paymentDate || new Date()).toLocaleString('pt-BR')}</p>
                        <p>Meio de Compensação: {checkoutAppt.paymentMethod === 'pix' ? 'Pix Instantâneo' : 'Cartão de Crédito Online'}</p>
                      </div>
                    </div>

                    <div className="text-center pt-6 leading-none">
                      <div className="inline-block w-40 border-b border-zinc-300"></div>
                      <p className="text-[9px] font-sans text-zinc-400 mt-2">Dra. Elieyd Barreto • Psicóloga Responsável</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => window.print()}
                      className="flex-1 py-2.5 bg-[#2F4738] hover:bg-[#1E2E24] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir ou Salvar PDF (IR/Plano)
                    </button>
                    <button
                      onClick={() => {
                        window.history.pushState({}, "", window.location.pathname);
                        setCheckoutApptId(null);
                        setCheckoutAppt(null);
                      }}
                      className="py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold cursor-pointer text-center"
                    >
                      Voltar ao Painel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Select Payment Method Toggles */}
                  <div className="bg-[#FAF8F6] p-1.5 rounded-2xl border border-zinc-200/60 max-w-sm mx-auto flex gap-1 font-sans">
                    <span className="bg-[#FAF8F6] p-1 flex-1 flex">
                      <span className="text-xs text-zinc-650 font-bold px-3 py-1.5 block text-center w-full bg-white rounded-xl shadow-xs border border-zinc-150">
                        💳 Opções Seguras de Quitação Eletrônica
                      </span>
                    </span>
                  </div>

                  {/* PIX Option rendering first inside a visual bento block */}
                  <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4 shadow-xs">
                    <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
                      <span className="p-1 px-2.5 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded-full text-[9px] font-bold">
                        PIX INSTANTÂNEO
                      </span>
                      <p className="text-[10.5px] text-zinc-500 font-mono">Chave Pix Ativa: <b>{checkoutAppt.pixKey || "014.225.889-00"}</b> (Dra. Elieyd)</p>
                    </div>

                    <div className="flex flex-col items-center py-2 space-y-3">
                      {/* Generates standard dynamic QR code preview */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=2e4738&data=${encodeURIComponent(
                          checkoutAppt.pixPayload || ""
                        )}`}
                        alt="Pix QR Code"
                        className="w-44 h-44 border-4 border-[#FAF8F6] rounded-2xl shadow-sm"
                      />
                      
                      <div className="w-full space-y-1.5">
                        <label className="text-[10px] font-mono font-bold text-[#556B5D] flex items-center justify-between">
                          <span>CÓDIGO PIX COPIA E COLA:</span>
                          <span className="text-[9px] text-zinc-400">Clique para copiar</span>
                        </label>
                        <div className="flex gap-1">
                          <input
                            readOnly
                            type="text"
                            value={checkoutAppt.pixPayload || ""}
                            className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-[9.5px] font-mono text-zinc-600 focus:outline-none"
                            onClick={(e) => {
                              (e.target as any).select();
                              navigator.clipboard.writeText((e.target as any).value);
                            }}
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(checkoutAppt.pixPayload || "");
                            }}
                            className="p-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-zinc-505 cursor-pointer"
                            title="Copiar Código"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleConfirmCheckoutPayment("pix")}
                      disabled={submittingPayment}
                      className="w-full py-2.5 bg-[#2F4738] hover:bg-[#1E2E24] text-white rounded-xl text-xs font-semibold font-sans flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                    >
                      {submittingPayment ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 text-emerald-300" />
                      )}
                      Débito Efetuado (Confirmar Transferência Pix)
                    </button>
                  </div>

                  {/* Standard Credit Card Section for simulation */}
                  <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4 shadow-xs">
                    <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
                      <span className="p-1 px-2.5 bg-blue-50 text-blue-800 border border-blue-150 rounded-full text-[9px] font-bold">
                        CARTÃO DE CRÉDITO
                      </span>
                      <p className="text-[10px] text-zinc-400 font-sans">Quitação parcelada ou à vista com aprovação instantânea</p>
                    </div>

                    {/* Simulation Card Input fields */}
                    <div className="space-y-3 font-sans">
                      <div>
                        <label className="block text-[9.5px] font-bold text-zinc-500 mb-1 uppercase font-mono">Nome Titular (Como no Cartão):</label>
                        <input
                          type="text"
                          placeholder="Manoel de Barros"
                          className="w-full bg-white border border-zinc-250 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#2F4738] outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9.5px] font-bold text-zinc-500 mb-1 uppercase font-mono">Número do Cartão:</label>
                          <input
                            type="text"
                            placeholder="4452 •••• •••• 1245"
                            maxLength={19}
                            className="w-full bg-white border border-zinc-250 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#2F4738] outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9.5px] font-bold text-zinc-500 mb-1 uppercase font-mono">Validade:</label>
                            <input
                              type="text"
                              placeholder="08/31"
                              maxLength={5}
                              className="w-full bg-white border border-zinc-250 rounded-xl px-3 py-2 text-xs text-center focus:ring-1 focus:ring-[#2F4738] outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[9.5px] font-bold text-zinc-500 mb-1 uppercase font-mono">CVV:</label>
                            <input
                              type="password"
                              placeholder="•••"
                              maxLength={4}
                              className="w-full bg-white border border-zinc-250 rounded-xl px-3 py-2 text-xs text-center focus:ring-1 focus:ring-[#2F4738] outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleConfirmCheckoutPayment("cartao")}
                      disabled={submittingPayment}
                      className="w-full py-2.5 bg-[#2F4738] hover:bg-[#1E2E24] text-white rounded-xl text-xs font-semibold font-sans flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
                    >
                      {submittingPayment ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CreditCard className="w-4 h-4 text-[#FAF8F6]" />
                      )}
                      Efetuar Pagamento R$ {Number(checkoutAppt.sessionPrice).toFixed(2)}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Filter appointments for Admin Views
  const pendingAppointments = appointments.filter((a) => a.status === "pending");
  const activeAppointments = appointments.filter((a) => a.status === "confirmed" || a.status === "rescheduled");
  const canceledAppointments = appointments.filter((a) => a.status === "canceled");

  return (
    <div className="min-h-screen bg-[#F7F2EE] text-[#1E2822] flex flex-col antialiased font-sans transition-all duration-500">
      {/* Brand Elegant Header Header with custom profile switches */}
      {currentUser && (
        <header className="bg-[#FAF8F6]/85 backdrop-blur-md border-b border-[#D9B8A7]/25 sticky top-0 z-40 shadow-xs">
          <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-[#2F4738] flex items-center justify-center text-white font-serif font-semibold text-xs shadow-xs">
                E
              </span>
              <div>
                <h1 className="text-xs font-serif font-semibold tracking-tight text-[#2F4738] leading-none">
                  Elieyd Barreto
                </h1>
                <span className="text-[9px] uppercase tracking-wider text-[#556B5D] font-semibold font-sans mt-0.5 block">
                  Psicologia Clínica
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentUser.role === "admin" && (
                <button
                  onClick={() => setIsAdminViewingAsPatient(!isAdminViewingAsPatient)}
                  className={`text-[9px] font-bold py-1 px-2.5 rounded-full border transition-all cursor-pointer inline-flex items-center gap-1 font-sans ${
                    isAdminViewingAsPatient
                      ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-150-sm"
                      : "bg-[#2F4738] text-white border-transparent hover:bg-[#1E2E24]"
                  }`}
                  title={isAdminViewingAsPatient ? "Sair da visualização como paciente" : "Experimentar aplicativo como um paciente"}
                >
                  <Eye className="w-3 h-3" />
                  {isAdminViewingAsPatient ? "Painel Clínico" : "Ver como Paciente"}
                </button>
              )}
              <span className="text-[10px] font-semibold bg-[#D9B8A7]/20 text-[#2F4738] px-2.5 py-1 rounded-full capitalize">
                {currentUser.role === "admin" ? "Dra. Elieyd" : currentUser.name.split(" ")[0]}
              </span>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-[#556B5D] hover:text-[#2F4738] hover:bg-[#D9B8A7]/10 transition-colors cursor-pointer"
                title="Sair da Conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {currentUser.role === "admin" && isAdminViewingAsPatient && (
            <div className="bg-[#A45A52] text-white py-1.5 px-4 text-center animate-fade-in flex items-center justify-between shadow-xs">
              <span className="text-[10.5px] font-medium tracking-wide flex items-center gap-1 font-sans">
                <span className="animate-ping inline-block w-1.5 h-1.5 rounded-full bg-white mr-1" />
                Dra., você está navegando no <b>Modo de Visualização do Paciente</b>:
              </span>
              <button
                onClick={() => setIsAdminViewingAsPatient(false)}
                className="text-[9px] font-bold bg-[#FAF8F6] text-[#A45A52] hover:bg-white px-2.5 py-0.5 rounded-md hover:scale-105 transition-all font-mono"
              >
                VOLTAR AO PAINEL CLÍNICO
              </button>
            </div>
          )}
        </header>
      )}

      {/* Main Body */}
      <main className={`flex-1 ${currentUser ? "max-w-md w-full mx-auto p-4 flex flex-col" : "w-full flex"}`}>
        {!currentUser ? (
          /* IMMERSIVE THERAPEUTIC AUTH SCREEN: EXACT PICTURE REPLICATION */
          <div className="flex-1 w-full min-h-screen bg-[#F7F2EE] flex items-center justify-center relative p-0 overflow-y-auto">
            {/* Elegant SVG Background Backdrops */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
              {/* Top-left organic shape - Rosé gradient */}
              <svg className="absolute top-0 left-0 w-72 h-72 -translate-x-12 -translate-y-12 text-[#D9B8A7]/20" viewBox="0 0 200 200" fill="currentColor">
                <path d="M0,0 C120,-30 190,40 200,200 L0,200 Z" />
              </svg>
              {/* Top-left botanical outlines */}
              <svg className="absolute top-8 left-8 w-44 h-44 text-[#556B5D]/15" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.6">
                <path d="M5,95 Q35,45 85,15" />
                <path d="M15,95 Q40,55 75,25" />
                <path d="M25,95 Q45,65 65,35" />
                <circle cx="85" cy="15" r="1.5" fill="currentColor" />
                <circle cx="75" cy="25" r="1" fill="currentColor" />
              </svg>

              {/* Bottom-left leaf drawing */}
              <svg className="absolute bottom-10 left-4 w-36 h-36 text-[#D9B8A7]/30" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="0.8">
                <path d="M10,110 C30,90 60,80 100,50" />
                <path d="M40,95 C45,85 55,80 60,85 C65,90 55,95 40,95 Z" fill="currentColor" fillOpacity="0.1" />
                <path d="M60,80 C65,70 75,65 80,70 C85,75 75,80 60,80 Z" fill="currentColor" fillOpacity="0.1" />
                <path d="M80,65 C85,55 95,50 100,55 C105,60 95,65 80,65 Z" fill="currentColor" fillOpacity="0.1" />
              </svg>

              {/* Bottom-right sweeping premium dark-green/olive canvas curves */}
              <div className="absolute bottom-0 right-0 w-72 h-80 overflow-hidden">
                <svg className="absolute bottom-0 right-0 w-full h-full text-[#2F4738]" viewBox="0 0 200 220" fill="currentColor">
                  <path d="M200,220 L0,220 C40,180 90,160 130,110 C160,80 185,40 200,0 Z" />
                </svg>
                <svg className="absolute bottom-0 right-0 w-full h-full text-[#556B5D]/40" viewBox="0 0 200 220" fill="currentColor">
                  <path d="M200,220 L30,220 C60,185 100,170 140,125 C170,90 190,50 200,10 Z" />
                </svg>
              </div>
            </div>

            {/* Core Card (Centered, vertical mobile proportion on desktop, edge-to-edge on mobile) */}
            <div className="relative z-10 w-full max-w-[430px] min-h-screen sm:min-h-[850px] sm:my-8 bg-[#F7F2EE]/95 sm:rounded-[40px] sm:shadow-[0_24px_80px_rgba(47,71,56,0.12)] sm:border sm:border-[#D9B8A7]/20 flex flex-col justify-between py-10 px-8 select-none">
              {isCompletingGoogleRegister ? (
                /* GOOGLE STEP 2: FINISH SIGN-UP REQUIRED DETAILS */
                <div className="w-full space-y-6 my-auto animate-fade-in">
                  <div className="text-center space-y-2">
                    <span className="inline-flex w-12 h-12 bg-rose-50 text-[#2F4738] rounded-full items-center justify-center text-xl shadow-xs animate-pulse-slow">
                      🌸
                    </span>
                    <h2 className="text-md font-serif font-semibold text-[#2F4738] tracking-tight animate-fade-in">
                      Quase lá, {googleUser?.name.split(" ")[0]}!
                    </h2>
                    <p className="text-[11px] text-[#8A8A8A] leading-relaxed font-sans max-w-[280px] mx-auto">
                      Para dar início ao seu atendimento e receber as notificações oficiais do Telegram/E-mail, informe seu telefone de contato.
                    </p>
                  </div>

                  {authError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-800 text-[10px] font-sans flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <div className="bg-[#FAF8F6] p-3 rounded-2xl border border-[#D9B8A7]/20 flex items-center gap-3 shadow-xs">
                    <div className="w-9 h-9 rounded-full bg-brand-rose/30 flex items-center justify-center text-xs font-bold text-[#2F4738] font-sans">
                      {googleUser?.name ? googleUser.name[0].toUpperCase() : "G"}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-[#2F4738]">{googleUser?.name}</h4>
                      <p className="text-[10px] text-[#8A8A8A] font-sans">{googleUser?.email}</p>
                    </div>
                  </div>

                  <form onSubmit={handleGoogleRegisterSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-[#8A8A8A] font-mono font-medium block">
                        Telefone (WhatsApp)
                      </label>
                      <input
                        type="text"
                        required
                        value={googlePhone}
                        onChange={(e) => setGooglePhone(e.target.value)}
                        placeholder="Ex: (85) 99999-9999"
                        className="w-full text-xs text-[#1E2822] bg-[#FAF8F6] border border-[#D9B8A7]/30 p-3.5 rounded-2xl focus:border-[#2F4738] focus:outline-none transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-4 bg-[#2F4738] hover:bg-[#1E2822] text-white font-semibold text-xs rounded-full transition-all cursor-pointer shadow-md shadow-[#2F4738]/20 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>Criar minha Conta & Acessar</span>
                      )}
                    </button>
                  </form>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCompletingGoogleRegister(false);
                        setGoogleUser(null);
                        setAuthError("");
                      }}
                      className="text-xs font-semibold text-[#8A8A8A] hover:underline cursor-pointer"
                    >
                      Voltar ao início
                    </button>
                  </div>
                </div>
              ) : (
                /* REGULAR E-MAIL AND PASSWORD AUTH WITH PARITY DESIGN */
                <div className="w-full flex-1 flex flex-col justify-between space-y-6">
                  {/* Branding Header Segment */}
                  <div className="space-y-5 text-center">
                    {/* SVG PREMIUM CUSTOM EMBLEM LOGO (REPLICATED BASED ON IMAGE) */}
                    <div className="relative h-44 flex items-center justify-center">
                      <svg className="w-44 h-44 select-none" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="emblemRose" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#E2C2B1" />
                            <stop offset="100%" stopColor="#C49B85" />
                          </linearGradient>
                          <linearGradient id="emblemGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#4A6954" />
                            <stop offset="100%" stopColor="#2F4738" />
                          </linearGradient>
                          <filter id="beautyShadow" x="-10%" y="-10%" width="120%" height="120%">
                            <dropShadow dx="0" dy="2" stdDeviation="4" floodColor="#2F4738" floodOpacity="0.06" />
                          </filter>
                        </defs>

                        {/* Leaves on left of letter 'E' */}
                        <g filter="url(#beautyShadow)">
                          <path d="M72,172 C68,142 82,118 106,90" stroke="url(#emblemRose)" strokeWidth="1.2" strokeLinecap="round" />
                          <path d="M100,98 C108,100 114,94 108,88 C102,82 96,88 100,98 Z" fill="url(#emblemRose)" />
                          <path d="M84,118 C76,116 70,122 78,128 C86,134 90,128 84,118 Z" fill="url(#emblemRose)" />
                          <path d="M90,138 C98,140 104,134 98,128 C92,122 86,128 90,138 Z" fill="url(#emblemRose)" />
                          <path d="M80,158 C72,156 66,162 74,168 C82,174 86,168 80,158 Z" fill="url(#emblemRose)" />
                        </g>

                        {/* Letter E inside monogram (Rose gold gradient) */}
                        <text x="70" y="156" 
                          fill="url(#emblemRose)" 
                          fontFamily="Cormorant Garamond, Georgia, serif" 
                          fontSize="120" 
                          fontWeight="300"
                        >
                          E
                        </text>

                        {/* Overlapping Letter B styled into B/3 curve (Deep forest green gradient) */}
                        <text x="108" y="168" 
                          fill="url(#emblemGreen)" 
                          fontFamily="Cormorant Garamond, Georgia, serif" 
                          fontSize="120" 
                          fontWeight="400"
                        >
                          3
                        </text>

                        {/* Continuous line art face silhouette mapping profile line of female */}
                        <path d="M152,90 
                                 C160,105 168,118 178,125 
                                 C182,128 185,130 188,132
                                 C192,134 195,137 192,141
                                 C190,145 186,146 182,148
                                 C180,149 178,151 179,154
                                 C180,157 184,158 181,162
                                 C178,166 172,168 170,172
                                 C166,180 162,192 153,198" 
                              stroke="url(#emblemRose)" 
                              strokeWidth="1.2" 
                              strokeLinecap="round" 
                              fill="none" 
                        />
                      </svg>
                    </div>

                    {/* Clinic & Dr Name Title */}
                    <div className="space-y-2 mt-2">
                      <h2 className="text-2xl font-serif font-medium tracking-tight text-[#2F4738] leading-tight">
                        Dra. Elieyd Barreto
                      </h2>
                      <div className="flex items-center justify-center gap-2">
                        <span className="w-8 h-px bg-[#D9B8A7]/40"></span>
                        <span className="text-[10px] uppercase tracking-[0.25em] text-[#D9B8A7] font-semibold">
                          Psicóloga
                        </span>
                        <span className="w-8 h-px bg-[#D9B8A7]/40"></span>
                      </div>
                    </div>

                    {/* Welcome message */}
                    <div className="space-y-1 pt-2 text-center">
                      <h3 className="text-md font-semibold text-[#2F4738] tracking-tight">
                        {isRecoveringPassword ? "Recuperar Acesso" : isRegistering ? "Criar meu Cadastro" : "Bem-vinda!"}
                      </h3>
                      <p className="text-xs text-[#8A8A8A] leading-relaxed">
                        {isRecoveringPassword ? "Código de validação será emitido para restaurar sua senha" : isRegistering ? "Faça parte de um espaço de acolhimento e cura" : "Que bom ter você aqui."}
                      </p>
                    </div>
                  </div>

                  {isRecoveringPassword ? (
                    /* PASSWORD RECOVERY SYSTEM FLOW */
                    <div className="space-y-4 text-left">
                      {recoverySuccess && (
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-800 text-[10px] font-sans flex items-start gap-2.5 animate-fade-in">
                          <span className="text-emerald-600 font-bold mt-0.5 font-sans">✔</span>
                          <span className="font-medium leading-normal flex-1">{recoverySuccess}</span>
                        </div>
                      )}

                      {authError && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-red-800 text-[10px] font-sans flex items-center gap-2 animate-pulse">
                          <AlertCircle className="w-4.5 h-4.5 text-red-600 flex-shrink-0" />
                          <span className="font-medium text-left flex-1">{authError}</span>
                        </div>
                      )}

                      {recoveryStep === "request" ? (
                        <form onSubmit={handleRequestRecoveryCode} className="space-y-4">
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                              <Mail className="w-4 h-4 text-[#D9B8A7]" />
                            </span>
                            <input
                              type="email"
                              required
                              value={recoveryEmail}
                              onChange={(e) => setRecoveryEmail(e.target.value)}
                              placeholder="Qual o seu e-mail cadastrado?"
                              className="w-full text-xs text-[#1E2822] bg-[#FAF8F6] border border-[#D9B8A7]/30 py-4 pl-11 pr-4 rounded-2xl focus:border-[#2F4738] focus:ring-1 focus:ring-[#2F4738]/10 focus:outline-none transition-all placeholder:text-[#8A8A8A]/50 font-medium"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={recoveryLoading}
                            className="w-full py-4 bg-[#2F4738] hover:bg-[#1E2822] text-white font-semibold text-xs rounded-full transition-all duration-300 cursor-pointer shadow-md flex items-center justify-center gap-1.5 transform active:scale-98"
                          >
                            {recoveryLoading ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <span>Solicitar Código de Segurança</span>
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </form>
                      ) : (
                        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                          <div className="relative animate-fade-in">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                              <Mail className="w-4 h-4 text-[#D9B8A7]/40" />
                            </span>
                            <input
                              type="email"
                              required
                              disabled
                              value={recoveryEmail}
                              className="w-full text-xs text-[#1E2822]/60 bg-zinc-100 border border-[#D9B8A7]/20 py-4 pl-11 pr-4 rounded-2xl cursor-not-allowed font-medium"
                            />
                          </div>

                          <div className="space-y-1 font-sans">
                            <label className="block text-[10px] uppercase font-bold text-slate-500 font-mono tracking-wider pl-1 font-sans">Código recebido por e-mail</label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none font-mono font-bold text-[#D9B8A7] text-[10px]">
                                # COD
                              </span>
                              <input
                                type="text"
                                required
                                maxLength={6}
                                value={recoveryCode}
                                onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, ""))}
                                placeholder="Digite o código"
                                className="w-full text-xs text-[#1E2822] bg-[#FAF8F6] border border-[#D9B8A7]/30 py-4 pl-16 pr-4 rounded-2xl focus:border-[#2F4738] focus:ring-1 focus:ring-[#2F4738]/10  focus:outline-none tracking-widest font-mono font-bold"
                              />
                            </div>
                          </div>

                          <div className="space-y-1 font-sans">
                            <label className="block text-[10px] uppercase font-bold text-slate-500 font-mono tracking-wider pl-1 font-sans">Nova Senha Permanente</label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                                <Lock className="w-4 h-4 text-[#D9B8A7]" />
                              </span>
                              <input
                                type="password"
                                required
                                value={recoveryNewPassword}
                                onChange={(e) => setRecoveryNewPassword(e.target.value)}
                                placeholder="Digite sua nova senha"
                                className="w-full text-xs text-[#1E2822] bg-[#FAF8F6] border border-[#D9B8A7]/30 py-4 pl-11 pr-4 rounded-2xl focus:border-[#2F4738] focus:ring-1 focus:ring-[#2F4738]/10 focus:outline-none transition-all placeholder:text-[#8A8A8A]/50 font-medium"
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={recoveryLoading}
                            className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-full transition-all duration-300 cursor-pointer shadow-md flex items-center justify-center gap-1.5 transform active:scale-98"
                          >
                            {recoveryLoading ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              "Redefinir Minha Senha"
                            )}
                          </button>
                        </form>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsRecoveringPassword(false);
                          setRecoveryStep("request");
                          setAuthError("");
                          setRecoverySuccess("");
                        }}
                        className="w-full py-2 text-center text-xs font-semibold text-[#556B5D] hover:text-[#2F4738] hover:underline cursor-pointer"
                      >
                        ← Voltar para o Login
                      </button>
                    </div>
                  ) : (
                    /* ORIGINAL AUTHENTICATION VIEW */
                    <>
                      {/* Auth message errors */}
                      {authError && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-red-800 text-[10px] font-sans flex items-center gap-2 animate-pulse">
                          <AlertCircle className="w-4.5 h-4.5 text-red-600 flex-shrink-0" />
                          <span className="font-medium text-center flex-1">{authError}</span>
                        </div>
                      )}

                      {/* FORM FIELDS BODY */}
                      <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
                        {isRegistering && (
                          <div className="space-y-3.5">
                            {/* Name Input */}
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                                <UserIcon className="w-4 h-4 text-[#D9B8A7]" />
                              </span>
                              <input
                                type="text"
                                value={authName}
                                onChange={(e) => setAuthName(e.target.value)}
                                placeholder="Nome Completo"
                                className="w-full text-xs text-[#1E2822] bg-[#FAF8F6] border border-[#D9B8A7]/25 py-3.5 pl-11 pr-4 rounded-2xl focus:border-[#2F4738] focus:ring-1 focus:ring-[#2F4738]/10 focus:outline-none transition-all placeholder:text-[#8A8A8A]/50 font-medium"
                              />
                            </div>

                            {/* Phone Input */}
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                                <Smartphone className="w-4 h-4 text-[#D9B8A7]" />
                              </span>
                              <input
                                type="text"
                                value={authPhone}
                                onChange={(e) => setAuthPhone(e.target.value)}
                                placeholder="Celular (WhatsApp)"
                                className="w-full text-xs text-[#1E2822] bg-[#FAF8F6] border border-[#D9B8A7]/25 py-3.5 pl-11 pr-4 rounded-2xl focus:border-[#2F4738] focus:ring-1 focus:ring-[#2F4738]/10 focus:outline-none transition-all placeholder:text-[#8A8A8A]/50 font-medium"
                              />
                            </div>
                          </div>
                        )}

                        {/* Email Input */}
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                            <Mail className="w-4 h-4 text-[#D9B8A7]" />
                          </span>
                          <input
                            type="email"
                            value={authEmail}
                            onChange={(e) => setAuthEmail(e.target.value)}
                            placeholder="E-mail"
                            className="w-full text-xs text-[#1E2822] bg-[#FAF8F6] border border-[#D9B8A7]/30 py-4 pl-11 pr-4 rounded-2xl focus:border-[#2F4738] focus:ring-1 focus:ring-[#2F4738]/10 focus:outline-none transition-all placeholder:text-[#8A8A8A]/50 font-medium"
                          />
                        </div>

                        {/* Password Input */}
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                            <Lock className="w-4 h-4 text-[#D9B8A7]" />
                          </span>
                          <input
                            type={showPassword ? "text" : "password"}
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            placeholder="Senha"
                            className="w-full text-xs text-[#1E2822] bg-[#FAF8F6] border border-[#D9B8A7]/30 py-4 pl-11 pr-11 rounded-2xl focus:border-[#2F4738] focus:ring-1 focus:ring-[#2F4738]/10 focus:outline-none transition-all placeholder:text-[#8A8A8A]/50 font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D9B8A7] hover:text-[#2F4738] transition-colors cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                          </button>
                        </div>

                        {/* Remember-me & Forgot Password row */}
                        {!isRegistering && (
                          <div className="flex items-center justify-between text-xs px-1">
                            <label className="flex items-center gap-2 text-[#8A8A8A] cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="rounded border-[#D9B8A7] text-[#2F4738] focus:ring-[#2F4738]/20 w-4 h-4"
                              />
                              <span>Lembrar-me</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setIsRecoveringPassword(true);
                                setRecoveryStep("request");
                                setRecoveryEmail(authEmail);
                                setAuthError("");
                                setRecoverySuccess("");
                              }}
                              className="text-[#D9B8A7] hover:text-[#C49B85] font-semibold transition-all hover:underline cursor-pointer"
                            >
                              Esqueci minha senha
                            </button>
                          </div>
                        )}

                        {/* ENTER ACTION BUTTON */}
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-4 mt-2 bg-[#2F4738] hover:bg-[#1E2822] text-white font-semibold text-xs rounded-full transition-all duration-300 cursor-pointer shadow-md shadow-[#2F4738]/20 flex items-center justify-center gap-1.5 group transform active:scale-98"
                        >
                          {loading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <span>{isRegistering ? "Criar Conta & Entrar" : "Entrar"}</span>
                              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </>
                          )}
                        </button>
                      </form>
                    </>
                  )}

                  {/* DIVIDER */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-[#D9B8A7]/20" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-[#F7F2EE] px-3 font-sans text-[11px] tracking-wider text-[#8A8A8A]">ou</span>
                    </div>
                  </div>

                  {/* GOOGLE SIGN IN BUTTON */}
                  <button
                    type="button"
                    onClick={handleGoogleSignInClick}
                    className="w-full py-3.5 border border-[#D9B8A7]/30 bg-[#FAF8F6] hover:bg-[#FAF8F6]/40 text-[#1E2822] text-xs font-semibold rounded-full transition-all duration-300 flex items-center justify-center gap-2.5 shadow-xs cursor-pointer transform active:scale-98"
                  >
                    <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5.04c1.54 0 2.92.53 4.01 1.58l3-3A11.96 11.96 0 0012 0C7.3 0 3.23 2.72 1.23 6.69l3.58 2.78C5.7 6.44 8.61 5.04 12 5.04z" />
                      <path fill="#4285F4" d="M23.52 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.46a5.52 5.52 0 01-2.4 3.63l3.72 2.88c2.18-2.01 3.74-4.97 3.74-8.64z" />
                      <path fill="#FBBC05" d="M4.81 9.47A7.17 7.17 0 014.5 12c0 .87.11 1.72.31 2.53l-3.58 2.78A11.94 11.94 0 010 12c0-1.92.45-3.74 1.23-5.31l3.58 2.78z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.72-2.88c-1.04.7-2.38 1.11-4.21 1.11-3.39 0-6.3-1.4-7.31-4.43l-3.58 2.78C3.23 21.28 7.3 24 12 24z" />
                    </svg>
                    <span>Entrar com Google</span>
                  </button>

                  {/* BOTTOM TOGGLE ACCOUNT REGISTER */}
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(!isRegistering);
                        setAuthError("");
                      }}
                      className="text-xs text-[#8A8A8A] font-medium"
                    >
                      {isRegistering ? (
                        <>
                          Já possui uma conta?{" "}
                          <span className="text-[#D9B8A7] hover:text-[#C49B85] font-semibold underline decoration-2 underline-offset-4 decoration-[#D9B8A7]/60">
                            Faça login
                          </span>
                        </>
                      ) : (
                        <>
                          Ainda não tem uma conta?{" "}
                          <span className="text-[#D9B8A7] hover:text-[#C49B85] font-semibold underline decoration-2 underline-offset-4 decoration-[#D9B8A7]/60">
                            Criar conta
                          </span>
                        </>
                      )}
                    </button>
                  </div>


                </div>
              )}
            </div>
          </div>
        ) : currentUser.isTemporaryPassword ? (
          /* REGRA DE NEGÓCIO DE SENHA TEMPORÁRIA DE ACESSO EXCLUSIVO */
          <div className="flex-1 w-full max-w-md mx-auto flex flex-col justify-center items-center py-8 p-4 font-sans select-none text-left">
            <div className="bg-white rounded-3xl p-6 w-full border border-zinc-200/80 shadow-2xl flex flex-col space-y-5 animate-fade-in text-left">
              <div className="text-center space-y-2">
                <span className="p-3 bg-rose-50 rounded-2xl text-rose-600 inline-block shadow-xs animate-pulse">
                  <Lock className="w-5.5 h-5.5" />
                </span>
                <h3 className="text-md font-bold text-zinc-900 tracking-tight text-center">Definir Senha Permanente</h3>
                <p className="text-[11.5px] text-zinc-500 leading-relaxed text-center">
                  Seu login foi realizado utilizando uma <strong>senha temporária</strong>. Para a segurança dos seus dados de prontuário, você precisa criar uma nova senha definitiva e exclusiva.
                </p>
              </div>

              {tempPassError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-red-800 text-[10px] font-sans flex items-center gap-2 text-left animate-shake">
                  <AlertCircle className="w-4.5 h-4.5 text-red-600 flex-shrink-0" />
                  <span className="font-medium text-left flex-grow">{tempPassError}</span>
                </div>
              )}

              <form onSubmit={handleSavePermanentPassword} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[9.5px] uppercase font-bold text-slate-500 font-mono pl-1">Nova Senha Permanente *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                      <Lock className="w-4 h-4 text-[#D9B8A7]" />
                    </span>
                    <input
                      type="password"
                      placeholder="Mínimo de 6 caracteres"
                      required
                      value={tempNewPassword}
                      onChange={(e) => setTempNewPassword(e.target.value)}
                      className="w-full text-xs text-[#1E2822] bg-[#FAF8F6] border border-[#D9B8A7]/35 py-3.5 pl-11 pr-4 rounded-2xl focus:border-[#2F4738] focus:ring-1 focus:ring-[#2F4738]/15 focus:outline-none transition-all placeholder:text-[#8A8A8A]/40 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[9.5px] uppercase font-bold text-slate-500 font-mono pl-1">Confirmar Nova Senha *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                      <Lock className="w-4 h-4 text-[#D9B8A7]" />
                    </span>
                    <input
                      type="password"
                      placeholder="Repita a nova senha desejada"
                      required
                      value={tempConfirmPassword}
                      onChange={(e) => setTempConfirmPassword(e.target.value)}
                      className="w-full text-xs text-[#1E2822] bg-[#FAF8F6] border border-[#D9B8A7]/35 py-3.5 pl-11 pr-4 rounded-2xl focus:border-[#2F4738] focus:ring-1 focus:ring-[#2F4738]/15 focus:outline-none transition-all placeholder:text-[#8A8A8A]/40 font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={tempPassLoading}
                  className="w-full py-3.5 bg-[#2F4738] text-white hover:bg-[#1E2822] font-semibold text-xs rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md transform active:scale-98"
                >
                  {tempPassLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Configurar Senha Permanente"
                  )}
                </button>
              </form>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2 text-center text-xs text-[#556B5D] hover:text-[#2F4738] hover:underline"
              >
                Cancelar e Sair da Conta
              </button>
            </div>
          </div>
        ) : currentUser.forceProfileUpdate ? (
          /* REGRA DE NEGÓCIO DA ATUALIZAÇÃO REQUERIDA / FORÇADA PELO ADM */
          <div className="flex-1 w-full max-w-md mx-auto flex flex-col justify-center items-center py-8 p-4 font-sans select-none text-left">
            <div className="bg-white rounded-3xl p-6 w-full border border-zinc-200/80 shadow-2xl flex flex-col space-y-5 animate-fade-in text-left">
              <div className="text-center space-y-2">
                <span className="p-3 bg-emerald-50 rounded-2xl text-[#2F4738] inline-block shadow-xs">
                  <UserIcon className="w-5.5 h-5.5" />
                </span>
                <h3 className="text-md font-bold text-zinc-900 tracking-tight text-center">Atualização Cadastral Requerida</h3>
                <p className="text-[11.5px] text-zinc-500 leading-relaxed text-center">
                  A <strong>Dra. Elieyd Barreto</strong> solicitou que você atualize os seguintes campos essenciais para garantir conformidade e continuidade do seu acompanhamento clínico.
                </p>
              </div>

              {profileUpdateError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-red-800 text-[10px] font-sans flex items-center gap-2 text-left animate-shake">
                  <AlertCircle className="w-4.5 h-4.5 text-red-600 flex-shrink-0" />
                  <span className="font-medium text-left flex-grow">{profileUpdateError}</span>
                </div>
              )}

              <form onSubmit={handleSaveForcedProfile} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[9.5px] uppercase font-bold text-slate-500 font-mono pl-1">Seu E-mail Atualizado *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                      <Mail className="w-4 h-4 text-[#D9B8A7]" />
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="seu@email.com"
                      value={forcedEmail}
                      onChange={(e) => setForcedEmail(e.target.value)}
                      className="w-full text-xs text-[#1E2822] bg-[#FAF8F6] border border-[#D9B8A7]/35 py-3.5 pl-11 pr-4 rounded-2xl focus:border-[#2F4738] focus:ring-1 focus:ring-[#2F4738]/15 focus:outline-none transition-all placeholder:text-[#8A8A8A]/40 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[9.5px] uppercase font-bold text-slate-500 font-mono pl-1">Número de Celular (WhatsApp) *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                      <Smartphone className="w-4 h-4 text-[#D9B8A7]" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="(DD) 99999-9999"
                      value={forcedPhone}
                      onChange={(e) => setForcedPhone(e.target.value)}
                      className="w-full text-xs text-[#1E2822] bg-[#FAF8F6] border border-[#D9B8A7]/35 py-3.5 pl-11 pr-4 rounded-2xl focus:border-[#2F4738] focus:ring-1 focus:ring-[#2F4738]/15 focus:outline-none transition-all placeholder:text-[#8A8A8A]/40 font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={profileUpdateLoading}
                  className="w-full py-3.5 bg-[#2F4738] text-white hover:bg-[#1E2822] font-semibold text-xs rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md transform active:scale-98"
                >
                  {profileUpdateLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Confirmar e Salvar Cadastro"
                  )}
                </button>
              </form>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2 text-center text-xs text-[#556B5D] hover:text-[#2F4738] hover:underline"
              >
                Fazer Logout
              </button>
            </div>
          </div>
        ) : (currentUser.role === "admin" && !isAdminViewingAsPatient) ? (
          /* ============================================================ */
          /* PSYCHOLOGIST ADMIN CONTROLS PORTAL                           */
          /* ============================================================ */
          <div className="space-y-6 flex-1 flex flex-col">
            {/* Tab navigation bar */}
            <div className="grid grid-cols-3 md:grid-cols-7 bg-[#D9B8A7]/10 p-1 rounded-2xl border border-[#D9B8A7]/20 gap-1">
              <button
                onClick={() => setAdminTab("agenda")}
                className={`relative py-2 px-1 text-[10px] font-medium rounded-xl transition-colors cursor-pointer text-center z-10 ${
                  adminTab === "agenda" ? "text-white font-semibold" : "text-[#556B5D] hover:text-[#2F4738]"
                }`}
              >
                {adminTab === "agenda" && (
                  <motion.span
                    layoutId="activeAdminTab"
                    className="absolute inset-0 bg-[#2F4738] rounded-xl -z-10 shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Agenda ({pendingAppointments.length})</span>
              </button>
              <button
                onClick={() => setAdminTab("patients")}
                className={`relative py-2 px-1 text-[10px] font-medium rounded-xl transition-colors cursor-pointer text-center z-10 ${
                  adminTab === "patients" ? "text-white font-semibold" : "text-[#556B5D] hover:text-[#2F4738]"
                }`}
              >
                {adminTab === "patients" && (
                  <motion.span
                    layoutId="activeAdminTab"
                    className="absolute inset-0 bg-[#2F4738] rounded-xl -z-10 shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Pacientes</span>
              </button>
              <button
                onClick={() => setAdminTab("finance")}
                className={`relative py-2 px-1 text-[10px] font-medium rounded-xl transition-colors cursor-pointer text-center z-10 ${
                  adminTab === "finance" ? "text-white font-semibold" : "text-[#556B5D] hover:text-[#2F4738]"
                }`}
              >
                {adminTab === "finance" && (
                  <motion.span
                    layoutId="activeAdminTab"
                    className="absolute inset-0 bg-[#2F4738] rounded-xl -z-10 shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">💰 Financeiro</span>
              </button>
              <button
                onClick={() => setAdminTab("availability")}
                className={`relative py-2 px-1 text-[10px] font-medium rounded-xl transition-colors cursor-pointer text-center z-10 ${
                  adminTab === "availability" ? "text-white font-semibold" : "text-[#556B5D] hover:text-[#2F4738]"
                }`}
              >
                {adminTab === "availability" && (
                  <motion.span
                    layoutId="activeAdminTab"
                    className="absolute inset-0 bg-[#2F4738] rounded-xl -z-10 shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Disponib.</span>
              </button>
              <button
                onClick={() => setAdminTab("config")}
                className={`relative py-2 px-1 text-[10px] font-medium rounded-xl transition-colors cursor-pointer text-center z-10 ${
                  adminTab === "config" ? "text-white font-semibold" : "text-[#556B5D] hover:text-[#2F4738]"
                }`}
              >
                {adminTab === "config" && (
                  <motion.span
                    layoutId="activeAdminTab"
                    className="absolute inset-0 bg-[#2F4738] rounded-xl -z-10 shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">Variáveis</span>
              </button>
              <button
                onClick={() => setAdminTab("logs")}
                className={`relative py-2 px-1 text-[10px] font-medium rounded-xl transition-colors cursor-pointer text-center z-10 ${
                  adminTab === "logs" ? "text-white font-semibold" : "text-[#556B5D] hover:text-[#2F4738]"
                }`}
              >
                {adminTab === "logs" && (
                  <motion.span
                    layoutId="activeAdminTab"
                    className="absolute inset-0 bg-[#2F4738] rounded-xl -z-10 shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 block truncate">Simulador</span>
              </button>
              <button
                onClick={() => {
                  setIsAdminViewingAsPatient(true);
                  setActiveTab("stories");
                }}
                className={`py-2 px-1 text-[10px] font-semibold rounded-xl transition-all cursor-pointer text-center bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100 flex flex-col justify-center items-center leading-none`}
                title="Visualizar tela idêntica aos pacientes"
              >
                <span>👁️ Ver como</span>
                <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">Paciente</span>
              </button>
            </div>

            {/* TAB CONTENT: AGENDA MANAGER */}
            <AnimatePresence mode="wait">
              {adminTab === "agenda" && (
                <motion.div
                  key="agenda"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6 flex-1"
                >
                {/* Pending Actions */}
                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold flex items-center justify-between">
                    <span>Novas Solicitações ({pendingAppointments.length})</span>
                    <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-sans uppercase animate-pulse">
                      Aguardando Sua Resposta
                    </span>
                  </h3>

                  {pendingAppointments.length === 0 ? (
                    <div className="bg-white rounded-2xl p-6 text-center border border-zinc-100">
                      <span className="text-xl block mb-1">🕊️</span>
                      <p className="text-xs text-zinc-400">Nenhuma solicitação de horário pendente no momento.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingAppointments.map((appt) => (
                        <div key={appt.id} className="bg-white rounded-2xl p-4.5 shadow-xs border border-zinc-100 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 text-left">
                              <span className="text-[10px] uppercase font-mono text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                                Paciente: {appt.patientName}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <h4 className="text-sm font-semibold text-slate-800">
                                  {getDayLabel(appt.date)} • {appt.time}h
                                </h4>
                                <button
                                  onClick={() => {
                                    setWhatsappModalAppt(appt);
                                    setWhatsappTemplateType("confirm");
                                  }}
                                  className="inline-flex items-center gap-1 text-[9px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded transition-colors font-medium border border-emerald-100 cursor-pointer"
                                  title="Enviar mensagem ou contato via WhatsApp"
                                >
                                  <MessageCircle className="w-2.5 h-2.5 text-emerald-600 fill-emerald-600/10" />
                                  <span>WhatsApp</span>
                                </button>
                              </div>
                              <p className="text-[10px] text-zinc-500 font-serif leading-none flex items-center gap-1 mt-1">
                                <Smartphone className="w-3 h-3 text-zinc-400" />
                                {appt.patientPhone}
                              </p>
                            </div>
                            <span className="text-[9px] bg-amber-50 rounded-md border border-amber-100 text-amber-800 py-0.5 px-2 font-mono">
                              Pendente
                            </span>
                          </div>

                          {/* Action Decision buttons */}
                          <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-zinc-50">
                            <button
                              onClick={() => handleUpdateAppointmentStatus(appt.id, "confirmed")}
                              className="py-2 px-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              Aprovar
                            </button>
                            <button
                              onClick={() => {
                                setReschedulingAppt(appt);
                                setReschedDate(appt.date);
                                setReschedTime(appt.time);
                              }}
                              className="py-2 px-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Clock className="w-3 h-3" />
                              Reagendar
                            </button>
                            <button
                              onClick={() => handleUpdateAppointmentStatus(appt.id, "canceled")}
                              className="py-2 px-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                              Recusar (Cancela)
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirmed consultations schedule */}
                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold">
                    Consultas Confirmadas ({activeAppointments.length})
                  </h3>

                  {activeAppointments.length === 0 ? (
                    <div className="bg-slate-50 border border-dashed border-zinc-200 rounded-2xl p-6 text-center">
                      <p className="text-xs text-zinc-400 font-sans">Nenhuma consulta agendada ou confirmada no calendário.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeAppointments.map((appt) => (
                        <div key={appt.id} className="bg-white rounded-xl p-3.5 border border-zinc-100 flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-slate-800">{appt.patientName}</span>
                              <span className="text-[9px] font-mono bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded">
                                {appt.status === "rescheduled" ? "Reagendado" : "Confirmado"}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              🗓️ {getDayLabel(appt.date)} • {appt.time}h {appt.notes ? `• ${appt.notes}` : ""}
                            </div>
                          </div>

                          {/* Quick Admin action to reschedule/cancel after confirmation */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setWhatsappModalAppt(appt);
                                setWhatsappTemplateType("reminder");
                              }}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                              title="Enviar contato ou lembrete via WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setReceiptModalAppt(appt);
                                setReceiptCPF("");
                                setGeneratedReceiptResult(null);
                              }}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                              title="Emitir Recibo de Reembolso"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setReschedulingAppt(appt);
                                setReschedDate(appt.date);
                                setReschedTime(appt.time);
                              }}
                              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                              title="Reagendar"
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleUpdateAppointmentStatus(appt.id, "canceled")}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Cancelar Consulta"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB CONTENT: PATIENTS MANAGER & DIARY COMPLIANCE */}
            {adminTab === "patients" && (
              <motion.div
                key="patients"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 flex-1"
              >
                <div className="space-y-3">
                  <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold">
                    Pacientes Cadastrados ({patientsList.length})
                  </h3>

                  {patientsList.length === 0 ? (
                    <div className="bg-white rounded-2xl p-6 text-center border border-zinc-100">
                      <p className="text-xs text-zinc-400">Nenhum paciente cadastrado até o momento.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {patientsList.map((pat) => {
                        const status = getPatientStatus(pat, appointments);
                        
                        // Appointments aggregates for counters
                        const userAppts = appointments.filter((a) => a.userId === pat.id);
                        const completedCount = userAppts.filter((a) => a.status === "completed").length;
                        const canceledCount = userAppts.filter((a) => a.status === "cancel" || a.status === "canceled" || a.status === "cancelled").length;
                        
                        const price = pat.sessionPrice !== undefined ? pat.sessionPrice : 150;
                        const isOverdue = pat.paymentStatus === "devendo";

                        return (
                          <div key={pat.id} className="bg-white rounded-2xl p-5 border border-zinc-200/90 shadow-xs hover:shadow-sm transition-all space-y-3.5 text-left">
                            {/* Profile Header */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-zinc-100 pb-2.5">
                              <div>
                                <h4 className="text-xs font-serif font-bold text-[#2F4738] flex items-center gap-1.5 flex-wrap">
                                  {pat.name}
                                  {pat.gender && (
                                    <span className="text-[8.5px] bg-[#FAF8F6] text-[#556B5D] px-1.5 py-0.5 rounded border border-[#D9B8A7]/30 font-medium font-sans">
                                      {pat.gender}
                                    </span>
                                  )}
                                  <span className={`text-[8.5px] px-2 py-0.5 rounded-full font-sans font-bold uppercase tracking-wider border ${status.bgClass} ${status.textClass} ${status.borderClass}`}>
                                    {status.label}
                                  </span>
                                </h4>
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{pat.email} • {pat.phone}</p>
                              </div>

                              <div className="flex flex-col sm:items-end gap-1.5">
                                {/* View diary authorization status */}
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium border ${
                                  pat.authorizedForDiary ? "bg-emerald-50 text-emerald-800 border-emerald-100 font-sans" : "bg-zinc-50 text-zinc-500 border-zinc-200 font-sans"
                                }`}>
                                  {pat.authorizedForDiary ? "Compartilha Diário" : "Diário Privado"}
                                </span>
                                
                                <div className="flex gap-1">
                                  {pat.sessionType && (
                                    <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-mono uppercase font-bold tracking-wider ${
                                      pat.sessionType === "online" ? "bg-blue-50 text-blue-750 border border-blue-100" : "bg-amber-50 text-amber-750 border border-[#D9B8A7]/50"
                                    }`}>
                                      {pat.sessionType === "online" ? "🌐 Online" : "🏢 Presencial"}
                                    </span>
                                  )}
                                  {pat.discoverySource && (
                                    <span className="text-[8.5px] bg-[#FAF8F6] text-[#556B5D] border border-zinc-150 px-1.5 py-0.2 rounded font-mono font-bold uppercase tracking-wider">
                                      📣 {pat.discoverySource}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Operational & Financial Bento Details */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-left font-sans">
                              {/* 1. Value of Session */}
                              <div className="bg-[#FAF8F6] p-2.5 rounded-xl border border-zinc-100 flex flex-col justify-between">
                                <span className="text-[8px] uppercase font-mono font-bold text-zinc-400 tracking-wider">Valor de Sessão</span>
                                <div className="mt-1 flex items-baseline gap-0.5 flex-wrap">
                                  <span className="text-[8.5px] text-zinc-400 font-semibold">R$</span>
                                  <span className="text-xs font-bold text-[#2F4738]">{price}</span>
                                  <span className="text-[8.5px] text-zinc-400">/sessão</span>
                                </div>
                              </div>

                              {/* 2. Financial Balance status */}
                              <div className="bg-[#FAF8F6] p-2.5 rounded-xl border border-zinc-100 flex flex-col justify-between">
                                <span className="text-[8px] uppercase font-mono font-bold text-zinc-400 tracking-wider">Mensalidade</span>
                                <div className="mt-1">
                                  {isOverdue ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                      ⚠️ Em Débito
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#2F4738] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                      ✅ Em Dia
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 3. Session Statistics Counters - INTERACTIVE CLICK */}
                              <button
                                onClick={() => {
                                  setSelectedHistoryPatient(pat);
                                  setIsHistoryModalOpen(true);
                                }}
                                className="bg-[#EBF5EF]/35 hover:bg-[#EBF5EF]/80 p-2.5 rounded-xl border border-emerald-150 flex flex-col justify-between text-left cursor-pointer transition-all group"
                                title="Visualizar histórico completo de agendamentos"
                              >
                                <span className="text-[8px] uppercase font-mono font-bold text-emerald-800 tracking-wider group-hover:text-emerald-950 flex items-center gap-1">
                                  Sessões Clínicas 🔎
                                </span>
                                <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[9px]">
                                  <span className="text-emerald-900 font-bold font-mono">
                                    {completedCount} Realizadas
                                  </span>
                                  <span className="text-rose-800 font-bold font-mono">
                                    {canceledCount} Canceladas
                                  </span>
                                </div>
                              </button>

                              {/* 4. Tracking Duration */}
                              <div className="bg-[#FAF8F6] p-2.5 rounded-xl border border-zinc-100 flex flex-col justify-between">
                                <span className="text-[8px] uppercase font-mono font-bold text-zinc-400 tracking-wider">Acompanhamento</span>
                                <div className="mt-1 text-[10px] text-zinc-700 font-bold font-sans flex items-center gap-1 flex-wrap">
                                  📅 <span>Há {getDurationText(pat.createdAt)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Clinical Notes snippet */}
                            {pat.clinicalNotes ? (
                              <div className="bg-[#FAF8F6] border-l-2 border-[#556B5D] p-2.5 rounded-r-xl">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-0.5">Observações Clínicas:</p>
                                <p className="text-[10.5px] text-zinc-650 leading-relaxed italic">"{pat.clinicalNotes}"</p>
                              </div>
                            ) : (
                              <p className="text-[9.5px] text-zinc-400 italic">Nenhuma observação clínica registrada.</p>
                            )}

                            {/* Clinical and administrative management triggers */}
                            <div className="flex justify-end gap-1.5 pt-2 border-t border-zinc-50 flex-wrap">
                              <button
                                onClick={() => {
                                  setSelectedSessionPatient(pat);
                                  setSessionNotesHistory(pat.sessionNotes || []);
                                  setNewSessionNoteDate(getTodayString());
                                  setNewSessionNoteTime(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }).substring(0, 5));
                                  setIsSessionNotesModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-[#2F4738] hover:bg-[#203126] text-white text-[10px] rounded-lg font-semibold flex items-center gap-1.5 transition-colors border border-[#2F4738] cursor-pointer"
                                title="Consulta dinâmica com gravação em áudio, transcrição e insights científicos da IA"
                              >
                                <Brain className="w-3 h-3 text-emerald-300" />
                                Dinamizar com IA
                              </button>

                              <button
                                onClick={() => handleOpenEditPatient(pat)}
                                className="px-2.5 py-1 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-[10px] rounded-lg font-semibold flex items-center gap-1.5 transition-colors border border-zinc-200 cursor-pointer"
                              >
                                <FileText className="w-3 h-3 text-[#556B5D]" />
                                Editar Cadastro
                              </button>

                              {pat.authorizedForDiary ? (
                                <button
                                  onClick={() => handleInspectPatientDiary(pat)}
                                  className="px-2.5 py-1 bg-[#EBF5EF] hover:bg-emerald-100 text-emerald-800 text-[10px] rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-[#D1E0D7]"
                                >
                                  <Eye className="w-3 h-3" />
                                  Inspecionar Diário
                                </button>
                              ) : (
                                <span className="text-[10px] text-zinc-400 flex items-center gap-1 italic py-1 bg-zinc-50/50 px-2 rounded-lg border border-zinc-100">
                                  <Lock className="w-3 h-3 text-zinc-300" />
                                  Diário Restrito (LGPD)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Open Patient Editor Modal in Overlay */}
                {editingPatient && (
                  <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
                    <div className="bg-white rounded-3xl p-5 max-w-sm w-full border border-zinc-200 shadow-2xl flex flex-col space-y-4 max-h-[85vh] overflow-y-auto">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-150">
                        <div>
                          <h4 className="text-[10px] uppercase tracking-[0.15em] text-[#556B5D] font-mono font-bold">
                            Editar Prontuário Clínico
                          </h4>
                          <span className="text-xs text-zinc-400 font-medium font-sans">
                            {editingPatient.email}
                          </span>
                        </div>
                        <button
                          onClick={() => setEditingPatient(null)}
                          className="p-1 rounded-full text-zinc-400 hover:bg-zinc-100 transition-all"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-3.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Nome Completo</label>
                          <input
                            type="text"
                            value={editPatientName}
                            onChange={(e) => setEditPatientName(e.target.value)}
                            className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-[#2F4738] font-sans text-zinc-700 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Telefone / Contato</label>
                          <input
                            type="text"
                            value={editPatientPhone}
                            onChange={(e) => setEditPatientPhone(e.target.value)}
                            className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-[#2F4738] font-sans text-zinc-700 font-medium"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Gênero / Sexo</label>
                            <select
                              value={editPatientGender}
                              onChange={(e) => setEditPatientGender(e.target.value)}
                              className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-[#2F4738] font-sans text-zinc-700 font-medium"
                            >
                              <option value="Feminino">Feminino</option>
                              <option value="Masculino">Masculino</option>
                              <option value="Outro">Outro</option>
                              <option value="Prefiro não dizer">não dizer</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Tipo de Sessão</label>
                            <select
                              value={editPatientSessionType}
                              onChange={(e) => setEditPatientSessionType(e.target.value as 'presencial' | 'online')}
                              className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-[#2F4738] font-sans text-zinc-700 font-medium"
                            >
                              <option value="online">🌐 Online</option>
                              <option value="presencial">🏢 Presencial</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Como nos encontrou?</label>
                          <select
                            value={editPatientDiscoverySource}
                            onChange={(e) => setEditPatientDiscoverySource(e.target.value)}
                            className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-[#2F4738] font-sans text-zinc-700 font-medium"
                          >
                            <option value="Google">Google (Busca)</option>
                            <option value="Instagram">Instagram</option>
                            <option value="Indicação">Indicação</option>
                            <option value="Facebook">Facebook</option>
                            <option value="Outro">Outro Canal</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Observações do Paciente / Clínicas</label>
                          <textarea
                            value={editPatientClinicalNotes}
                            onChange={(e) => setEditPatientClinicalNotes(e.target.value)}
                            placeholder="Anote aqui queixas principais, histórico clínico básico ou termos de prontuário..."
                            rows={3}
                            className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-[#2F4738] font-sans text-zinc-700"
                          />
                        </div>

                        {/* Session price and payment status */}
                        <div className="grid grid-cols-2 gap-3 bg-[#FAF8F6] p-3 rounded-2xl border border-[#D9B8A7]/30">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-650 uppercase tracking-wider font-mono mb-1">Valor da Sessão (R$)</label>
                            <input
                              type="number"
                              value={editPatientSessionPrice}
                              onChange={(e) => setEditPatientSessionPrice(Number(e.target.value) || 0)}
                              className="w-full text-xs p-2 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-[#2F4738] font-sans font-bold text-[#2F4738]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-650 uppercase tracking-wider font-mono mb-1">Situação de Pagamento</label>
                            <select
                              value={editPatientPaymentStatus}
                              onChange={(e) => setEditPatientPaymentStatus(e.target.value as 'em_dia' | 'devendo')}
                              className="w-full text-xs p-2 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-[#2F4738] font-sans text-zinc-750 font-semibold"
                            >
                              <option value="em_dia">✅ Em dia</option>
                              <option value="devendo">⚠️ Devendo</option>
                            </select>
                          </div>
                        </div>

                        {/* Status/Clinical Override Flag */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Marcação / Status Clínico</label>
                          <select
                            value={editPatientManualStatus}
                            onChange={(e) => setEditPatientManualStatus(e.target.value as any)}
                            className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-[#2F4738] font-sans text-zinc-700 font-medium"
                          >
                            <option value="">⚙️ Calcular automaticamente (Sugerido)</option>
                            <option value="ativo">🟢 Ativo Assíduo</option>
                            <option value="sem_sessao">🟡 Sem sessão agendada</option>
                            <option value="agendado">🔵 Agendado (Sessão futura)</option>
                            <option value="ausente">🔴 Ausente (Mais de 15 dias sem remarcar)</option>
                            <option value="desistiu">⚫ Desistiu (Arquivar/Desistente)</option>
                          </select>
                          <p className="text-[9px] text-zinc-400 mt-1 leading-normal font-sans">
                            Por padrão, o sistema monitora e atualiza os status de forma automatizada com base no comparecimento clínico e agendamentos.
                          </p>
                        </div>

                        {/* SECTION: FORÇAR ATUALIZAÇÃO CADASTRAL */}
                        <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100 flex items-start gap-2.5 text-left">
                          <input
                            type="checkbox"
                            id="editPatientForceProfileUpdate"
                            checked={editPatientForceProfileUpdate}
                            onChange={(e) => setEditPatientForceProfileUpdate(e.target.checked)}
                            className="rounded border-zinc-300 text-[#2F4738] focus:ring-[#2F4738]/20 w-4 h-4 mt-0.5 cursor-pointer"
                          />
                          <label htmlFor="editPatientForceProfileUpdate" className="flex-1 cursor-pointer select-none text-left">
                            <span className="block text-[11px] font-bold text-[#1E2E24] leading-tight text-left">
                              Forçar atualização cadastral
                            </span>
                            <span className="block text-[9.5px] text-zinc-500 mt-0.5 leading-normal text-left">
                              O paciente precisará confirmar/atualizar seu celular e e-mail obrigatoriamente logo no próximo login para conseguir navegar.
                            </span>
                          </label>
                        </div>

                        {/* SECTION: ALTERAÇÃO DE ACESSO / SENHA TEMPORÁRIA */}
                        <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200/80 space-y-2 text-left">
                          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono text-left">
                            Acesso & Segurança
                          </span>
                          <p className="text-[9.5px] text-zinc-500 leading-normal text-left">
                            Libere o acesso rápido para este paciente gerando uma senha temporária automática. Ela exigirá a criação de uma senha forte permanente no primeiro acesso.
                          </p>

                          {generatedTempPassword ? (
                            <div className="bg-amber-50 border border-amber-200/70 p-2.5 rounded-xl space-y-1.5 animate-fade-in text-left">
                              <span className="block text-[9px] uppercase tracking-widest font-mono text-amber-700 font-semibold text-left">
                                Senha temporária gerada:
                              </span>
                              <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-amber-200">
                                <span className="font-mono text-xs font-bold text-amber-900 tracking-wider">
                                  {generatedTempPassword}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(generatedTempPassword);
                                    alert("Senha copiada para a área de transferência!");
                                  }}
                                  className="text-[10px] text-amber-850 font-bold hover:underline cursor-pointer"
                                >
                                  Copiar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={tempPasswordLoading}
                              onClick={async () => {
                                setTempPasswordLoading(true);
                                try {
                                  const response = await fetch(`/api/patients/${editingPatient.id}/temporary-password`, {
                                    method: "POST"
                                  });
                                  if (response.ok) {
                                    const data = await response.json();
                                    setGeneratedTempPassword(data.tempPassword);
                                  } else {
                                    alert("Falha ao gerar senha temporária.");
                                  }
                                } catch (err) {
                                  alert("Erro de comunicação ao gerar senha.");
                                } finally {
                                  setTempPasswordLoading(false);
                                }
                              }}
                              className="w-full py-2.5 px-3 bg-[#2F4738]/10 hover:bg-[#2F4738]/15 text-[#2F4738] font-bold text-[10.5px] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              {tempPasswordLoading ? (
                                <div className="w-3.5 h-3.5 border border-[#2F4738] border-t-transparent rounded-full animate-spin" />
                              ) : (
                                "Gerar Senha Temporária"
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-zinc-150">
                        <button
                          type="button"
                          onClick={() => setEditingPatient(null)}
                          className="flex-1 py-2.5 border border-zinc-250 hover:bg-zinc-50 text-[#556B5D] font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSavePatientProfile(editingPatient.id)}
                          className="flex-grow py-2.5 bg-[#2F4738] text-white hover:bg-[#1E2E24] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md text-center"
                        >
                          Salvar Cadastro
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Open Multi-Session Legal Receipt Creator Modal */}
                {isReceiptModalOpen && selectedReceiptPatient && (
                  <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in text-left font-sans">
                    <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-zinc-200 shadow-2xl flex flex-col space-y-4 max-h-[90vh] overflow-y-auto">
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-150">
                        <div>
                          <h4 className="text-[10px] uppercase tracking-widest text-[#556B5D] font-mono font-bold">
                            Gerador de Recibo de Honorários
                          </h4>
                          <span className="text-xs text-[#2F4738] font-bold">
                            Paciente: {selectedReceiptPatient.name}
                          </span>
                        </div>
                        <button
                          onClick={() => setIsReceiptModalOpen(false)}
                          className="p-1 rounded-full text-zinc-400 hover:bg-zinc-100 transition-all cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-3 text-xs text-zinc-600">
                        {/* Legal and Emissor fields */}
                        <div className="grid grid-cols-2 gap-3 bg-[#FAF8F6] p-3 rounded-2xl border border-[#D9B8A7]/25">
                          <div>
                            <label className="block text-[9px] font-mono uppercase tracking-wider text-[#556B5D] font-bold mb-1">CPF do Paciente:</label>
                            <input
                              type="text"
                              value={receiptCpf}
                              onChange={(e) => setReceiptCpf(e.target.value)}
                              placeholder="000.000.000-00"
                              className="w-full p-2 bg-white border border-zinc-200 rounded-lg outline-none focus:border-[#2F4738]"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-mono uppercase tracking-wider text-[#556B5D] font-bold mb-1">Código CID (Opcional):</label>
                            <input
                              type="text"
                              value={receiptCid}
                              onChange={(e) => setReceiptCid(e.target.value)}
                              placeholder="Ex: F41.1"
                              className="w-full p-2 bg-white border border-zinc-200 rounded-lg outline-none focus:border-[#2F4738]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-mono uppercase text-zinc-400 font-bold mb-1">CRP do Emissor:</label>
                            <input
                              type="text"
                              value={receiptCrp}
                              onChange={(e) => setReceiptCrp(e.target.value)}
                              className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-mono uppercase text-zinc-400 font-bold mb-1">CPF/CNPJ Emissor:</label>
                            <input
                              type="text"
                              value={receiptCnpj}
                              onChange={(e) => setReceiptCnpj(e.target.value)}
                              className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg outline-none"
                            />
                          </div>
                        </div>

                        {/* Completed Sessions Checklist */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest font-mono mb-2">
                            Selecione as Sessões Completadas:
                          </label>
                          <div className="max-h-48 overflow-y-auto border border-zinc-150 rounded-2xl p-2.5 bg-zinc-50/50 space-y-1.5">
                            {appointments.filter((a) => a.userId === selectedReceiptPatient.id && a.status === "completed").length === 0 ? (
                              <p className="text-[10px] text-zinc-400 text-center py-4">Nenhuma consulta concluída no histórico deste paciente.</p>
                            ) : (
                              appointments
                                .filter((a) => a.userId === selectedReceiptPatient.id && a.status === "completed")
                                .map((appt) => {
                                  const isChecked = receiptSelectedAppts.includes(appt.id);
                                  const apptPrice = selectedReceiptPatient.sessionPrice !== undefined ? selectedReceiptPatient.sessionPrice : 150;
                                  return (
                                    <label key={appt.id} className="flex items-center gap-2.5 p-2 bg-white border border-zinc-200 hover:border-[#D9B8A7]/35 rounded-xl cursor-pointer transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          if (isChecked) {
                                            setReceiptSelectedAppts(receiptSelectedAppts.filter(id => id !== appt.id));
                                          } else {
                                            setReceiptSelectedAppts([...receiptSelectedAppts, appt.id]);
                                          }
                                        }}
                                        className="rounded border-zinc-350 text-[#2F4738] focus:ring-[#2F4738]"
                                      />
                                      <div className="flex-1">
                                        <p className="font-bold text-zinc-800 text-[10.5px]">📅 {new Date(appt.date + "T00:00:00").toLocaleDateString('pt-BR')} às {appt.time}h</p>
                                        <p className="text-[9.5px] text-[#556B5D] font-mono">Valor: R$ {Number(apptPrice).toFixed(2)} | Pgto: {(appt as any).paymentStatus === 'pago' ? '✅ Pago' : '⚠️ Em aberto'}</p>
                                      </div>
                                    </label>
                                  );
                                })
                            )}
                          </div>
                        </div>

                        {/* Calculation Preview */}
                        <div className="bg-[#FAF8F6] p-3 rounded-2xl border border-[#D9B8A7]/20 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-[#556B5D]">Sessões Selecionadas: {receiptSelectedAppts.length}</span>
                          <span className="text-sm font-bold text-[#2F4738] font-serif">
                            Total: R$ {receiptSelectedAppts.reduce((sum, id) => {
                              const appt = appointments.find(a => a.id === id);
                              const price = selectedReceiptPatient.sessionPrice !== undefined ? selectedReceiptPatient.sessionPrice : 150;
                              return sum + Number(price);
                            }, 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-zinc-150">
                        <button
                          type="button"
                          onClick={() => setIsReceiptModalOpen(false)}
                          className="flex-1 py-2.5 border border-zinc-250 hover:bg-zinc-50 text-zinc-600 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={receiptSelectedAppts.length === 0}
                          onClick={() => {
                            const totalVal = receiptSelectedAppts.reduce((sum, id) => {
                              const appt = appointments.find(a => a.id === id);
                              const price = selectedReceiptPatient.sessionPrice !== undefined ? selectedReceiptPatient.sessionPrice : 150;
                              return sum + Number(price);
                            }, 0);
                            
                            const sessionsArr = receiptSelectedAppts.map(id => {
                              const a = appointments.find(item => item.id === id);
                              return { date: a?.date || "", time: a?.time || "" };
                            });

                            setRenderedReceipt({
                              patientName: selectedReceiptPatient.name,
                              patientCpf: receiptCpf,
                              cid: receiptCid,
                              emissorName: "Dra. Elieyd Barreto",
                              emissorCrp: receiptCrp,
                              emissorCnpj: receiptCnpj,
                              value: totalVal,
                              appointments: sessionsArr
                            });
                            
                            setIsReceiptModalOpen(false);
                            setIsReceiptGeneratedPreviewOpen(true);
                          }}
                          className="flex-grow py-2.5 bg-[#2F4738] text-white hover:bg-[#1E2E24] font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md text-center disabled:opacity-40"
                        >
                          Visualizar Recibo
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Printable Letterhead Overlay Preview */}
                {isReceiptGeneratedPreviewOpen && renderedReceipt && (
                  <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in text-left">
                    <div className="bg-[#FAF8F6] rounded-3xl p-6 md:p-8 max-w-2xl w-full border border-[#D9B8A7]/30 shadow-2xl flex flex-col space-y-6 max-h-[92vh] overflow-y-auto">
                      <div className="flex items-center justify-between pb-3 border-b border-[#D9B8A7]/25">
                        <span className="text-xs uppercase font-bold tracking-widest text-[#2F4738] font-sans">
                          Visualização do Documento Clínico-Fiscal
                        </span>
                        <button
                          onClick={() => {
                            setIsReceiptGeneratedPreviewOpen(false);
                            setIsReceiptModalOpen(true);
                          }}
                          className="p-1 rounded-full text-zinc-400 hover:bg-zinc-150"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Printable Letterhead Receipt Component */}
                      <div id="receipt-clinical-print-area" className="bg-white border-2 border-zinc-200/80 rounded-2xl p-6 md:p-8 relative space-y-6 font-serif shadow-xs">
                        <div className="absolute top-4 right-4 opacity-15 border-2 border-[#2F4738] text-[#2F4738] text-[8px] uppercase tracking-widest font-sans font-bold px-3 py-1 rounded">
                          Honorários Clínicos
                        </div>

                        {/* Top Letterhead */}
                        <div className="text-center pb-6 border-b border-zinc-100 font-sans">
                          <h2 className="text-lg font-serif font-bold tracking-tight text-[#2F4738]">Dra. Elieyd Barreto</h2>
                          <p className="text-[9px] uppercase tracking-widest font-bold text-[#556B5D] mt-1">Psicologia Clínica Integrada & Formulação Psicoterapêutica</p>
                          <p className="text-[8.5px] text-zinc-400 font-mono mt-0.5">Registro CRP {renderedReceipt.emissorCrp} • Emissor {renderedReceipt.emissorCnpj}</p>
                        </div>

                        {/* Document Content */}
                        <div className="text-xs text-zinc-700 leading-relaxed space-y-4">
                          <h3 className="text-center text-sm font-bold tracking-tight uppercase font-sans text-neutral-800">
                            DECLARAÇÃO DE QUITAÇÃO DE HONORÁRIOS PROFISSIONAIS
                          </h3>
                          
                          <p className="indent-8 italic text-zinc-800 text-justify">
                            "Declaro para fins de direito regulamentar, dedução fiscal junto à Receita Federal e reembolso junto a planos de assistência de saúde que recebi do(a) paciente 
                            <strong className="text-zinc-900 not-italic"> {renderedReceipt.patientName}</strong>, 
                            {renderedReceipt.patientCpf ? ` inscrito(a) no CPF n° ${renderedReceipt.patientCpf}, ` : ""} 
                            a importância total de <strong className="text-zinc-900 not-italic">R$ {renderedReceipt.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>, 
                            referente a honorários clínicos de psicoterapia ambulatorial individual."
                          </p>

                          <div>
                            <p className="font-semibold font-sans text-[10px] text-[#556B5D] uppercase tracking-wider mb-2">Consultas Realizadas e Quitações Correspondentes:</p>
                            <ul className="grid grid-cols-2 gap-2 text-[10.5px] font-mono text-zinc-600 bg-zinc-50 border border-zinc-150 rounded-xl p-3">
                              {renderedReceipt.appointments.map((appt: any, idx: number) => (
                                <li key={idx} className="flex items-center gap-1.5">
                                  <span>📅</span>
                                  <span>{new Date(appt.date + "T00:00:00").toLocaleDateString('pt-BR')} às {appt.time}h</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {renderedReceipt.cid && (
                            <p className="text-[10px] font-sans text-zinc-500 bg-neutral-50 px-3 py-1.5 rounded-lg border border-zinc-100">
                              <strong>📍 Classificação Internacional de Doenças (CID-10):</strong> Cod. {renderedReceipt.cid} (Declaração solicitada pelo paciente para fins de junta médica/plano de seguro).
                            </p>
                          )}

                          <p className="text-[10.5px] text-right font-sans text-zinc-500">
                             Localidade de Emissão: São Paulo, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.
                          </p>
                        </div>

                        {/* Signature Line */}
                        <div className="text-center pt-8 border-t border-zinc-100 leading-none">
                          <div className="inline-block w-48 border-b-2 border-zinc-200"></div>
                          <p className="text-[9px] font-sans text-zinc-400 uppercase tracking-widest font-semibold mt-2">Dra. Elieyd Barreto</p>
                          <p className="text-[8px] font-sans text-zinc-400 mt-1">Psicologia Clinica • CRP {renderedReceipt.emissorCrp}</p>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex flex-col sm:flex-row gap-2 font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            setIsReceiptGeneratedPreviewOpen(false);
                            setIsReceiptModalOpen(true);
                          }}
                          className="flex-1 py-2.5 border border-zinc-250 hover:bg-zinc-50 text-zinc-700 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
                        >
                          Voltar para Edição
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            window.print();
                            // Audit log
                            fetch('/api/audit-logs/add', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                action: 'IMPRIMIR_RECIBO_REEMBOLSO',
                                patientName: renderedReceipt.patientName,
                                details: `Impressão de recibo de Reembolso no total de R$ ${renderedReceipt.value}`
                              })
                            }).catch(() => {});
                          }}
                          className="flex-grow py-2.5 bg-[#2F4738] hover:bg-[#1E2E24] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                        >
                          <Printer className="w-3.5 h-3.5 text-zinc-100" />
                          Imprimir Documento / Salvar PDF
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Open Diary Modal in overlay for Elieyd review */}
                {selectedAdminPatientDiary && (
                  <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-5 max-w-sm w-full border border-zinc-200 shadow-2xl flex flex-col h-[70vh]">
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-3">
                        <div>
                          <h4 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold">
                            Registro Emocional
                          </h4>
                          <h3 className="text-sm font-semibold text-slate-800">
                            Paciente: {selectedAdminPatientDiary.patient.name}
                          </h3>
                        </div>
                        <button
                          onClick={() => setSelectedAdminPatientDiary(null)}
                          className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                        {selectedAdminPatientDiary.entries.length === 0 ? (
                          <div className="text-center py-10">
                            <span className="text-xl block mb-1">📖</span>
                            <p className="text-xs text-zinc-400 italic">O diário deste paciente está vazio por enquanto.</p>
                          </div>
                        ) : (
                          selectedAdminPatientDiary.entries.map((entry) => (
                            <div key={entry.id} className="bg-slate-50 border border-zinc-100 p-3.5 rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold font-mono">
                                  Humor: {entry.mood}
                                </span>
                                <span className="text-[9px] font-mono text-zinc-400">
                                  {new Date(entry.date + "T00:00:00").toLocaleDateString("pt-BR")} às {entry.time}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-700 leading-relaxed font-sans">{entry.text}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB CONTENT: FINANCIAL CONTROL & DYNAMIC BILLING DASHBOARD */}
            {adminTab === "finance" && (
              <motion.div
                key="finance"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 flex-1 text-left"
              >
                {/* Visual Intro with human, helpful titles */}
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold">
                    Painel Financeiro & Monitoramento Clínico
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-sans mt-0.5">
                    Previsões de receita, quitações eletrônicas em lote e emissão instantânea de recibos para convênios e IR.
                  </p>
                </div>

                {/* Interactive Dynamic Metrics Section */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-sans">
                  <div className="bg-[#FAF8F6] rounded-2xl p-4 border border-[#D9B8A7]/30 shadow-xs relative overflow-hidden">
                    <span className="text-[9px] font-mono uppercase text-[#556B5D] font-bold tracking-wider">Faturamento Projetado (Mensal)</span>
                    <p className="text-xl font-bold text-[#2F4738] mt-1">
                      R$ {patientsList
                        .filter(p => p.manualStatus !== "desistiu" && p.manualStatus !== "ausente")
                        .reduce((sum, p) => sum + (Number(p.sessionPrice || 150) * 4), 0)
                        .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[9px] text-zinc-400 mt-1">Base: 4 sessões/mês por paciente ativo.</p>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-zinc-150 shadow-xs">
                    <span className="text-[9px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">Honorários Recebidos (PIX/Cartão)</span>
                    <p className="text-xl font-bold text-emerald-800 mt-1">
                      R$ {appointments
                        .filter(a => (a as any).paymentStatus === "pago")
                        .reduce((sum, a) => sum + (Number((a as any).paidAmount) || Number(patientsList.find(p => p.id === a.userId)?.sessionPrice) || 150), 0)
                        .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[9px] text-zinc-400 mt-1">Total acumulado e compensado.</p>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-zinc-150 shadow-xs">
                    <span className="text-[9px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">Saldos Em Aberto / Pendente</span>
                    <p className="text-xl font-bold text-rose-800 mt-1">
                      R$ {appointments
                        .filter(a => a.status === "completed" && (a as any).paymentStatus !== "pago")
                        .reduce((sum, a) => sum + (Number((a as any).paymentSentValue) || Number(patientsList.find(p => p.id === a.userId)?.sessionPrice) || 150), 0)
                        .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[9px] text-rose-600/80 mt-1 font-medium">Aguardando compensação.</p>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-zinc-150 shadow-xs">
                    <span className="text-[9px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">Fluxo Geral de Atendimentos</span>
                    <div className="flex gap-4 mt-2 justify-start items-baseline">
                      <div>
                        <p className="text-base font-bold text-zinc-700 leading-none">
                          {appointments.filter(a => a.status === "completed").length}
                        </p>
                        <span className="text-[8px] text-zinc-400 lowercase">Ocorridas</span>
                      </div>
                      <div className="border-l border-zinc-150 pl-3">
                        <p className="text-base font-bold text-rose-600 leading-none">
                          {appointments.filter(a => a.status === "canceled").length}
                        </p>
                        <span className="text-[8px] text-rose-500 lowercase">Canceladas</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter and controls line */}
                <div className="bg-white rounded-2xl p-4 border border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-3 font-sans shadow-sm">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Pesquisar paciente..."
                      value={financialSearch}
                      onChange={(e) => setFinancialSearch(e.target.value)}
                      className="w-full max-w-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#2F4738]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-tight">Filtros:</span>
                    <select
                      value={financialStatusFilter}
                      onChange={(e) => setFinancialStatusFilter(e.target.value)}
                      className="bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1 text-xs outline-none cursor-pointer focus:ring-1 focus:ring-[#2F4738] text-zinc-700"
                    >
                      <option value="all">Sitação de Pagamento (Todos)</option>
                      <option value="em_dia">Em Dia</option>
                      <option value="devendo">Em Aberto / Devendo</option>
                    </select>

                    <button
                      onClick={() => {
                        setFinancialSearch("");
                        setFinancialStatusFilter("all");
                      }}
                      className="text-[10px] font-bold text-[#556B5D] hover:text-[#2F4738] transition-colors cursor-pointer"
                    >
                      Limpar Filtros
                    </button>
                  </div>
                </div>

                {/* Patient Bento Financial Grid */}
                <div className="space-y-4">
                  {patientsList
                    .filter((p) => {
                      const matchesSearch = p.name.toLowerCase().includes(financialSearch.toLowerCase());
                      const matchesPayment = financialStatusFilter === "all" || p.paymentStatus === financialStatusFilter;
                      return matchesSearch && matchesPayment;
                    })
                    .map((pat) => {
                      const ocurredCount = appointments.filter((a) => a.userId === pat.id && a.status === "completed").length;
                      const canceledCount = appointments.filter((a) => a.userId === pat.id && a.status === "canceled").length;
                      
                      const pendingBillables = appointments.filter((a) => a.userId === pat.id && a.status === "completed" && (a as any).paymentStatus !== "pago");
                      const userPrice = pat.sessionPrice !== undefined ? pat.sessionPrice : 150;
                      
                      return (
                        <div key={pat.id} className="bg-white rounded-2xl border border-zinc-150 p-5 font-sans space-y-4 shadow-xs hover:border-[#D9B8A7]/30 transition-all">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* Patient Basic Detail */}
                            <div className="flex items-center gap-3">
                              <span className="w-10 h-10 rounded-full bg-[#FAF8F6] text-[#2F4738] flex items-center justify-center font-serif font-bold text-sm border border-[#D9B8A7]/20 shadow-xs">
                                {pat.name.slice(0, 2).toUpperCase()}
                              </span>
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                  {pat.name}
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full border ${
                                    pat.paymentStatus === "em_dia" 
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                                      : "bg-rose-50 text-rose-800 border-rose-200 animate-pulse"
                                  }`}>
                                    {pat.paymentStatus === "em_dia" ? "● Em Dia" : "● Em Aberto / Devendo"}
                                  </span>
                                </h4>
                                <p className="text-[10px] text-zinc-400 mt-1">Contato: {pat.phone || "Não cadastrado"}</p>
                              </div>
                            </div>

                            {/* Status and Session Pricing adjustments on-the-fly */}
                            <div className="flex flex-wrap items-center gap-4 bg-[#FAF8F6] p-3 rounded-xl border border-zinc-100">
                              
                              {/* Clinical Status Toggles */}
                              <div className="text-left">
                                <label className="block text-[8px] font-mono uppercase text-zinc-400 font-bold mb-1">Status Clínico do Paciente:</label>
                                <select
                                  value={pat.manualStatus || "sem_sessao"}
                                  onChange={(e) => handleUpdatePatientPriceAndStatus(pat.id, userPrice, e.target.value, pat.paymentStatus || "em_dia")}
                                  className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-[10.5px] font-medium outline-none cursor-pointer focus:ring-1 focus:ring-[#2F4738] text-zinc-700"
                                >
                                  <option value="ativo">Ativo Assíduo</option>
                                  <option value="sem_sessao">Sem Sessão Agendada</option>
                                  <option value="agendado">Agendado</option>
                                  <option value="ausente">Ausente (Desmarcado)</option>
                                  <option value="desistiu">Desistiu</option>
                                </select>
                              </div>

                              {/* Price adjustment on-the-fly to raise the prices in future */}
                              <div className="text-left w-24">
                                <label className="block text-[8px] font-mono uppercase text-zinc-400 font-bold mb-1">Valor Sessão (R$):</label>
                                <div className="flex gap-1 items-center">
                                  <input
                                    type="number"
                                    value={userPrice}
                                    onChange={(e) => handleUpdatePatientPriceAndStatus(pat.id, Number(e.target.value), pat.manualStatus || "sem_sessao", pat.paymentStatus || "em_dia")}
                                    className="w-full bg-white border border-zinc-200 rounded-lg px-1.5 py-1 text-xs font-mono font-bold text-center focus:outline-none focus:border-[#2F4738]"
                                  />
                                </div>
                              </div>

                              {/* Financial Health switch button */}
                              <div className="text-left">
                                <label className="block text-[8px] font-mono uppercase text-zinc-400 font-bold mb-1">Alterar Débito:</label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextPayment = pat.paymentStatus === "em_dia" ? "devendo" : "em_dia";
                                    handleUpdatePatientPriceAndStatus(pat.id, userPrice, pat.manualStatus || "sem_sessao", nextPayment);
                                  }}
                                  className={`px-3 py-1 text-[10px] font-bold rounded-lg border cursor-pointer transition-colors ${
                                    pat.paymentStatus === "em_dia"
                                      ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  }`}
                                >
                                  Marcar {pat.paymentStatus === "em_dia" ? "Como Devendo" : "Como Em Dia"}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Sessions Count statistics widget */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 border-t border-zinc-100 text-[11px] text-zinc-600">
                            <div>
                              <span className="font-semibold text-zinc-400 uppercase text-[9px] font-mono">Histórico Clínico:</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="bg-zinc-100 text-zinc-700 rounded-md px-2 py-0.5 text-[10px] font-bold">
                                  ✔️ {ocurredCount} Ocorridas
                                </span>
                                <span className="bg-rose-50 text-rose-700 rounded-md px-2 py-0.5 text-[10px] font-bold">
                                  ❌ {canceledCount} Canceladas
                                </span>
                              </div>
                            </div>

                            <div className="col-span-2 flex flex-col justify-center">
                              <span className="font-semibold text-zinc-400 uppercase text-[9px] font-mono block mb-1">Avisos Pendentes de Cobrança:</span>
                              {pendingBillables.length === 0 ? (
                                <p className="text-[10px] text-emerald-800 font-medium">✨ Nenhuma sessão em aberto aguardando pagamento.</p>
                              ) : (
                                <div className="flex flex-wrap gap-1 items-center">
                                  <span className="text-[10px] text-rose-700 font-bold bg-rose-50 border border-rose-100 px-2 py-0.5 rounded">
                                    {pendingBillables.length} sessões pendentes (R$ {(pendingBillables.length * userPrice).toFixed(2)})
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Bento Action buttons for rapid email invoicing or receipt creation */}
                            <div className="flex items-center justify-end gap-2">
                              {pendingBillables.length > 0 && (
                                <button
                                  type="button"
                                  disabled={billingSentApptId !== null}
                                  onClick={async () => {
                                    // Send billing mail utilizing first pending billing appt id
                                    const apptId = pendingBillables[0].id;
                                    await handleSendBillingEmail(apptId);
                                  }}
                                  className="px-3 py-1.5 bg-[#2F4738] text-white hover:bg-[#1E2E24] text-[10px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                                >
                                  {billingSentApptId ? "Enviando..." : "📧 Cobrar via Pix"}
                                </button>
                              )}
                              
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedReceiptPatient(pat);
                                  setReceiptCpf(pat.cpf || "");
                                  setReceiptSelectedAppts(appointments.filter(a => a.userId === pat.id && a.status === "completed").map(a => a.id));
                                  setIsReceiptModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-[#2F4738] text-[10px] font-bold rounded-lg transition-colors cursor-pointer border border-[#D9B8A7]/25"
                              >
                                🧾 Recibo Convênio/IR
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            )}

            {/* TAB CONTENT: AVAILABILITY SCHEDULER BUILDER */}
            {adminTab === "availability" && (
              <motion.div
                key="availability"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 flex-1"
              >
                <div className="bg-white rounded-2xl p-5 border border-zinc-100 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 tracking-tight flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    Gerenciar Calendário de Vagas
                  </h3>

                  <p className="text-xs text-zinc-500 leading-relaxed font-sans">
                    Defina abaixo quais dias e horas você quer abrir para que seus pacientes consigam realizar os agendamentos online sozinhos de forma otimizada.
                  </p>

                  <div className="space-y-3 pt-2">
                    {/* Date choice */}
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-medium block">
                        Selecione o Dia de Trabalho:
                      </label>
                      <input
                        type="date"
                        value={tempDate}
                        onChange={(e) => setTempDate(e.target.value)}
                        className="w-full text-xs text-slate-800 bg-slate-50 p-3 rounded-xl border border-zinc-100 focus:outline-none focus:border-emerald-300"
                      />
                    </div>

                    {/* Slots picker checkboxes */}
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-medium block mb-2">
                        Selecione as Horas Disponíveis neste dia:
                      </span>
                      <div className="grid grid-cols-4 gap-2">
                        {["08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"].map((slot) => {
                          const hasSlot = tempSlots.includes(slot);
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => {
                                if (hasSlot) {
                                  setTempSlots(tempSlots.filter((ts) => ts !== slot));
                                } else {
                                  setTempSlots([...tempSlots, slot].sort());
                                }
                              }}
                              className={`py-2 px-1 text-center rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                                hasSlot
                                  ? "bg-emerald-600 border-emerald-600 text-white font-semibold"
                                  : "bg-stone-50 border-zinc-100 text-zinc-500 hover:bg-stone-100"
                              }`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={handleAddAvailabilityDay}
                      className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer shadow-sm"
                    >
                      Salvar Disponibilidades Propostas
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold">
                    Dias Configuradas no Calendário Atualmente
                  </h4>
                  {availabilities.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic">Nenhum dia cadastrado.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {availabilities.map((av) => (
                        <div key={av.date} className="bg-white p-3 rounded-xl border border-zinc-100 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">
                            {getDayLabel(av.date)} (
                            {new Date(av.date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short" })}
                            )
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono max-w-[200px] truncate">
                            {av.slots.join(", ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB CONTENT: ADMIN CONFIGURATION & CREDENTIALS CHECKPORT */}
            {adminTab === "config" && (
              <motion.div
                key="config"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 flex-1"
              >
                <div className="bg-white rounded-2xl p-5 border border-zinc-100 space-y-4 animate-fade-in">
                  <h3 className="text-sm font-semibold text-slate-800 tracking-tight flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-emerald-600" />
                    Gerenciador de Variáveis & Credenciais
                  </h3>
                  <p className="text-xs text-zinc-500 leading-relaxed font-sans">
                    Gerencie com segurança as variáveis de ambiente das integrações de e-mail, alertas automáticos por Telegram, inteligência artificial e link inteligente do Google Calendar.
                  </p>
                </div>

                {/* Main panel */}
                <div className="space-y-5">
                  {/* CONFIGURAÇÃO DE LEMBRETES PRÉ-SESSÃO AUTOMÁTICOS */}
                  <div className="bg-white rounded-2xl p-5 border border-zinc-100 space-y-4 shadow-xs">
                    <h4 className="text-xs font-bold text-slate-400 font-mono tracking-wider flex items-center justify-between border-b border-zinc-50 pb-2">
                      <span>⏰ Lembretes Pré-Sessão (WhatsApp/E-mail)</span>
                      <span className="text-[9px] bg-[#2F4738] text-white px-2 py-0.5 rounded-full font-semibold">ATIVO POR PADRÃO</span>
                    </h4>

                    <p className="text-xs text-zinc-500 leading-relaxed font-sans">
                      Configure os disparos automáticos de preparação antes das consultas da Dra. Elieyd. O sistema inclui sintonizações emocionais diferenciadas para 1ª vez (foco em sigilo) ou demais sessões (foco em progresso).
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Quantidade de Lembretes</label>
                        <select
                          value={reminderQty}
                          onChange={(e) => setReminderQty(e.target.value)}
                          className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-[#2F4738] font-sans text-zinc-700 font-medium"
                        >
                          <option value="1">1 Lembrete único (Padrão: 30 mins)</option>
                          <option value="2">2 Lembretes sequenciais (40 mins e dps 15 mins)</option>
                        </select>
                      </div>

                      {reminderQty === "1" ? (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Tempo de Antecedência do Alerta</label>
                          <select
                            value={reminderMinutes}
                            onChange={(e) => setReminderMinutes(e.target.value)}
                            className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-[#2F4738] font-sans text-zinc-700 font-medium"
                          >
                            <option value="15">15 minutos antes</option>
                            <option value="30">30 minutos antes (Recomendado)</option>
                            <option value="40">40 minutos antes</option>
                            <option value="60">1 hora antes</option>
                          </select>
                        </div>
                      ) : (
                        <div className="bg-[#FAF8F6] p-2.5 rounded-xl border border-[#D9B8A7]/40 flex items-center justify-center">
                          <p className="text-[10.5px] text-[#A45A52] leading-tight font-medium">
                            <b>Regra Clínica Ativada:</b> Primeiro lembrete curto às 40 minutos (com instruções normais) e o segundo curto em 15 minutos (com a observação abaixo).
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">
                        Mensagem Adicional da Psicóloga <span className="text-zinc-400 uppercase text-[8px] font-normal">(Opcional - Vai no 1º E-mail)</span>
                      </label>
                      <textarea
                        value={reminderAdditionalMsg}
                        onChange={(e) => setReminderAdditionalMsg(e.target.value)}
                        placeholder="Ex: Não se esqueça de manter seu fone de ouvido fáceis e beber água..."
                        rows={2}
                        className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-[#2F4738] font-sans text-zinc-700"
                      />
                    </div>

                    {reminderQty === "2" && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono">
                            📝 Observação Complementar Obrigatória (2º Lembrete)
                          </label>
                          <span className="text-[8px] bg-rose-50 text-rose-700 border border-rose-100 px-1.5 py-0.5 rounded font-bold uppercase">Obrigatório</span>
                        </div>
                        <textarea
                          value={reminderCompulsoryMsg}
                          onChange={(e) => setReminderCompulsoryMsg(e.target.value)}
                          placeholder="Digite aqui uma observação complementar curta e direta..."
                          rows={2}
                          className={`w-full text-xs p-2.5 bg-zinc-50 border rounded-xl focus:outline-none focus:border-[#2F4738] font-sans text-zinc-700 ${
                            !reminderCompulsoryMsg ? "border-amber-300 bg-amber-50/10" : "border-zinc-200"
                          }`}
                        />
                        {!reminderCompulsoryMsg && (
                          <span className="text-[9px] text-[#A45A52] block font-medium">⚠️ A observação não pode ficar em branco se optar por enviar dois lembretes (para manter os e-mails variados e úteis).</span>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-zinc-50">
                      <button
                        type="button"
                        onClick={handleSaveConfig}
                        disabled={reminderQty === "2" && !reminderCompulsoryMsg}
                        className="flex-1 py-2.5 bg-[#2F4738] text-white hover:bg-[#1E2E24] disabled:bg-zinc-300 font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
                      >
                        Salvar Lembretes de Pré-Sessão
                      </button>

                      <button
                        type="button"
                        onClick={handleTriggerRemindersCheck}
                        disabled={triggeringReminders}
                        className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-100 px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        {triggeringReminders ? "Executando..." : "⚡ Testar/Forçar Disparos"}
                      </button>
                    </div>

                    {reminderTriggerMessage && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-900 leading-normal font-sans">
                        👍 {reminderTriggerMessage} Verifique o menu <b>Simulador</b> ao lado para inspecionar os e-mails/logs enviados hoje!
                      </div>
                    )}
                  </div>

                  {/* Google Calendar Sincronização */}
                  <div className="bg-white rounded-2xl p-5 border border-zinc-100 space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 font-mono tracking-wider flex items-center justify-between border-b border-zinc-50 pb-2">
                      <span>📅 Sincronização com Google Agenda</span>
                      {isGoogleConnected ? (
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-sans border border-emerald-100 uppercase font-bold tracking-wider">Conectado</span>
                      ) : (
                        <span className="text-[9px] bg-zinc-50 text-zinc-500 px-2 py-0.5 rounded-full font-sans border border-zinc-200 uppercase font-bold tracking-wider font-mono">Inativo</span>
                      )}
                    </h4>

                    {/* 1-Click Automatic Connection Header */}
                    <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100/60 space-y-2">
                      <p className="text-xs font-semibold text-emerald-900 leading-tight">Sincronização Direta sem Configuração</p>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        A Dra. Elieyd <b>não precisa</b> configurar ou colar chaves complexas se desejar. Nós pré-configuramos credenciais padrão de alta segurança para que o processo de vinculação seja imediato e automático em um clique.
                      </p>
                    </div>

                    <div className="pt-2">
                      {isGoogleConnected ? (
                        <button
                          onClick={handleDisconnectGoogle}
                          className="w-full py-3 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold rounded-xl text-center transition-all cursor-pointer font-sans flex items-center justify-center gap-1.5"
                        >
                          Desconectar Conta Google Agenda
                        </button>
                      ) : (
                        <button
                          onClick={handleConnectGoogle}
                          className="w-full py-3 bg-emerald-800 border border-emerald-700 text-white hover:bg-emerald-950 text-xs font-bold rounded-xl text-center shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 font-sans hover:-translate-y-0.5 active:translate-y-0"
                        >
                          <Calendar className="w-4 h-4 text-emerald-300" />
                          Vincular Minha Google Agenda Oficial (Simples - 1 clique)
                        </button>
                      )}
                    </div>

                    {/* Advanced Dropdown Accordion */}
                    <details className="mt-4 border-t border-zinc-100 pt-3 group">
                      <summary className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono cursor-pointer hover:text-zinc-650 flex items-center justify-between select-none">
                        <span>⚙️ Personalizar com Credenciais Próprias (Avançado)</span>
                        <span className="text-xs transition-transform group-open:rotate-180">▼</span>
                      </summary>
                      
                      <div className="space-y-3.5 mt-3 pt-1">
                        <p className="text-[10px] text-zinc-400 leading-relaxed font-sans mt-1">
                          Preencha estes campos apenas se você tiver conhecimentos em Google Cloud Platform e desejar que a tela de autorização exiba o nome e a logomarca oficial da sua clínica, em vez da nossa credencial compartilhada.
                        </p>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Google Client ID (ID do Cliente)</label>
                          <input
                            type="text"
                            value={googleClientId}
                            onChange={(e) => setGoogleClientId(e.target.value)}
                            placeholder="Caso queira, cole aqui o ID de cliente próprio"
                            className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-600 font-mono text-zinc-700 placeholder:text-zinc-300"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Google Client Secret (Chave Secreta)</label>
                          <input
                            type="password"
                            value={googleClientSecret}
                            onChange={(e) => setGoogleClientSecret(e.target.value)}
                            placeholder={googleClientSecret ? "••••••••" : "Caso queira, cole a chave secreta própria"}
                            className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-600 font-mono text-zinc-700 placeholder:text-zinc-300"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">ID da Agenda Google (Calendar ID)</label>
                          <input
                            type="text"
                            value={googleCalendarId}
                            onChange={(e) => setGoogleCalendarId(e.target.value)}
                            placeholder="primary (Agenda principal)"
                            className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-600 font-mono text-zinc-700"
                          />
                          <span className="text-[9px] text-zinc-400 block mt-1.5 font-sans">Use <b>primary</b> para sincronizar no seu e-mail principal, ou insira o identificador de uma agenda de terceiros se preferir.</span>
                        </div>
                      </div>
                    </details>
                  </div>

                  {/* Servidor de E-mail (SMTP) */}
                  <div className="bg-white rounded-2xl p-5 border border-zinc-100 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-50 pb-2.5 gap-2">
                      <h4 className="text-xs font-bold text-slate-400 font-mono tracking-wider">📨 Servidor de E-mail Notificador (SMTP)</h4>
                      <button
                        type="button"
                        onClick={() => {
                          setSmtpHost("smtp.gmail.com");
                          setSmtpPort("587");
                          if (!smtpUser && currentUser?.email) {
                            setSmtpUser(currentUser.email);
                          }
                          if (!smtpFrom && currentUser?.email) {
                            setSmtpFrom(currentUser.email);
                          }
                        }}
                        className="text-[10px] bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-100 px-2 py-1 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-all self-start sm:self-auto"
                      >
                        ⚡ Autopreencher Padrões Gmail
                      </button>
                    </div>

                    {/* Explanatory helper for Gmail app passwords */}
                    <div className="bg-amber-50/55 rounded-xl p-4 border border-amber-100/60 text-[11px] text-amber-900 leading-relaxed space-y-2">
                      <p className="font-semibold flex items-center gap-1">
                        🔒 Sobre a Senha de Aplicativo do Gmail (SMTP Pass)
                      </p>
                      <p>
                        Por razões estritas de segurança, <b>o Google não permite que nenhum aplicativo externo gere essa senha de forma 100% automática</b>. Para proteger a sua conta principal, o Gmail exige que você gere uma chave especial exclusiva com estes 3 passos rápidos:
                      </p>
                      <ol className="list-decimal pl-4 space-y-1.5 font-sans mt-1">
                        <li>Certifique-se de que a <b>Verificação em duas etapas</b> está ativada no seu e-mail do Google.</li>
                        <li>
                          Acesse diretamente o painel de segurança:{" "}
                          <a 
                            href="https://myaccount.google.com/apppasswords" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-bold underline text-amber-950 hover:text-black decoration-dotted"
                          >
                            myaccount.google.com/apppasswords ↗
                          </a>
                        </li>
                        <li>Escreva um nome descritivo (ex: <code className="bg-amber-100/80 px-1 rounded font-mono">Clinica Elieyd</code>) e clique em <b>Criar</b>. Copie o código gerado de <b>16 letras</b> e cole no campo "Senha de Aplicativo" abaixo.</li>
                      </ol>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Host SMTP</label>
                          <input
                            type="text"
                            value={smtpHost}
                            onChange={(e) => setSmtpHost(e.target.value)}
                            placeholder="ex: smtp.gmail.com"
                            className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-600 font-mono text-zinc-700"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Porta SMTP</label>
                          <input
                            type="text"
                            value={smtpPort}
                            onChange={(e) => setSmtpPort(e.target.value)}
                            placeholder="ex: 587"
                            className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-600 font-mono text-zinc-700"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">E-mail Remetente (SMTP From)</label>
                        <input
                          type="text"
                          value={smtpFrom}
                          onChange={(e) => setSmtpFrom(e.target.value)}
                          placeholder="jefferson.videira@gmail.com"
                          className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-600 font-mono text-zinc-700"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Usuário de Autenticação (SMTP User)</label>
                        <input
                          type="text"
                          value={smtpUser}
                          onChange={(e) => setSmtpUser(e.target.value)}
                          placeholder="seu-email-anterior@gmail.com"
                          className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-600 font-mono text-zinc-700"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Senha de Aplicativo (SMTP Pass)</label>
                        <input
                          type="password"
                          value={smtpPass}
                          onChange={(e) => setSmtpPass(e.target.value)}
                          placeholder={smtpPass ? "••••••••" : "Digite a Senha SMTP"}
                          className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-600 font-mono text-zinc-700 placeholder:text-zinc-300"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Telegram Alerts */}
                  <div className="bg-white rounded-2xl p-5 border border-zinc-100 space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 font-mono tracking-wider border-b border-zinc-50 pb-2">✈️ Notificações Automáticas no Telegram (Avisos de Consulta)</h4>
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Telegram Bot Token</label>
                        <input
                          type="password"
                          value={telegramToken}
                          onChange={(e) => setTelegramToken(e.target.value)}
                          placeholder={telegramToken ? "••••••••" : "Ex: 8641820974:AAHdRmRm_AXLsCAzW5i..."}
                          className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-600 font-mono text-zinc-700 placeholder:text-zinc-300"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Telegram Chat ID (ID do Canal/Grupo)</label>
                        <input
                          type="text"
                          value={telegramChatId}
                          onChange={(e) => setTelegramChatId(e.target.value)}
                          placeholder="Ex: 514324017 ou -100XXXXXXXXXX"
                          className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-600 font-mono text-zinc-700 placeholder:text-zinc-300"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Configuração de Recebimentos via Pix */}
                  <div className="bg-white rounded-2xl p-5 border border-zinc-100 space-y-4 shadow-xs">
                    <h4 className="text-xs font-bold text-slate-400 font-mono tracking-wider flex items-center justify-between border-b border-zinc-50 pb-2">
                      <span className="flex items-center gap-1.5 text-zinc-750 font-semibold">
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                        💸 Recebimentos via Pix (Cobrança Automática)
                      </span>
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-sans border border-emerald-100 uppercase font-bold tracking-wider">Pix Dinâmico</span>
                    </h4>

                    <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100/60 space-y-2">
                      <p className="text-xs font-semibold text-emerald-950 leading-tight">Configuração de Cobrança Pix</p>
                      <p className="text-[11px] text-[#2F4738] leading-relaxed">
                        Abaixo, configure os dados do seu Pix. As cobranças enviadas por e-mail no fechamento das sessões e a tela de checkout de sessões usarão estes dados para gerar o <b>código Pix "Copia e Cola"</b> e o <b>QR Code</b> dinamicamente com o valor correto de cada sessão.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Chave Pix (Celular, E-mail, CPF/CNPJ ou Chave Aleatória)</label>
                        <input
                          type="text"
                          value={pixKey}
                          onChange={(e) => setPixKey(e.target.value)}
                          placeholder="Ex: +5585999999999 ou 12345678909"
                          className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-600 font-mono text-zinc-700"
                        />
                        <span className="text-[9px] text-zinc-400 block mt-1 font-sans">
                          Dica: Para celulares, prefira o formato internacional (ex: +5585999999999). CPFs/CNPJs serão limpos de pontos e traços.
                        </span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Nome do Beneficiário (Até 25 caracteres)</label>
                        <input
                          type="text"
                          value={pixBeneficiaryName}
                          onChange={(e) => setPixBeneficiaryName(e.target.value)}
                          placeholder="Ex: Dra. Elieyd Barreto"
                          maxLength={25}
                          className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-600 font-sans text-zinc-700"
                        />
                        <span className="text-[9px] text-zinc-400 block mt-1 font-sans">
                          Nome da conta bancária vinculada à chave Pix.
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Cidade do Beneficiário (Até 15 caracteres)</label>
                      <input
                        type="text"
                        value={pixCity}
                        onChange={(e) => setPixCity(e.target.value)}
                        placeholder="Ex: Fortaleza"
                        maxLength={15}
                        className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-600 font-sans text-zinc-700"
                      />
                      <span className="text-[9px] text-zinc-400 block mt-1 font-sans">
                        Cidade do beneficiário cadastrada no banco.
                      </span>
                    </div>
                  </div>

                  {/* Gemini Key */}
                  <div className="bg-white rounded-2xl p-5 border border-zinc-100 space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 font-mono tracking-wider border-b border-zinc-50 pb-2">🧠 Inteligência Artificial (Gemini API)</h4>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono mb-1">Chave de API Gemini</label>
                      <input
                        type="password"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder={geminiKey ? "••••••••" : "Sua chave de API para as reflexões"}
                        className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-600 font-mono text-zinc-700 placeholder:text-zinc-300"
                      />
                    </div>
                  </div>

                  {/* Action block */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleSaveConfig}
                      className="flex-1 py-3 text-xs bg-emerald-800 text-white rounded-xl shadow-xs font-semibold hover:bg-emerald-900 transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                    >
                      <Save className="w-4 h-4" />
                      Salvar Variáveis
                    </button>

                    <button
                      onClick={handleTestConfig}
                      disabled={testing}
                      className="flex-1 py-3 text-xs bg-zinc-800 text-white disabled:opacity-55 disabled:cursor-not-allowed rounded-xl shadow-xs font-semibold hover:bg-zinc-900 transition-colors flex items-center justify-center gap-2 cursor-pointer font-sans"
                    >
                      {testing ? (
                        <>
                          <div className="w-3 text-[10px] h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Checando Conexões...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Validar & Testar Integridades
                        </>
                      )}
                    </button>
                  </div>

                  {/* Save Status alert */}
                  {saveSuccess && (
                    <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-3 rounded-lg text-center text-xs font-medium leading-relaxed font-sans mt-2 animate-pulse">
                      ✓ Variáveis configuradas e recarregadas em cache no servidor com sucesso!
                    </div>
                  )}

                  {/* Diagnostic details */}
                  {testResults && (
                    <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 space-y-4 shadow-xs animate-fade-in mt-4">
                      <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                        <span className="text-[10px] font-mono tracking-wider font-bold text-slate-500 uppercase">Status Geral de Prontidão</span>
                        <span className="text-[10px] font-bold text-zinc-400 font-sans">{new Date().toLocaleTimeString("pt-BR")}</span>
                      </div>

                      <div className="space-y-3 font-sans text-xs">
                        {/* SMTP result */}
                        <div className="p-3 bg-white rounded-xl border border-zinc-100 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">📨 Servidor SMTP</span>
                            {testResults.smtp.status === "success" ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] px-2 py-0.5 rounded-full font-medium uppercase font-sans font-bold">online</span>
                            ) : testResults.smtp.status === "missing" ? (
                              <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded-full font-medium uppercase font-sans font-bold">simulado</span>
                            ) : (
                              <span className="bg-rose-100 text-rose-800 text-[9px] px-2 py-0.5 rounded-full font-medium uppercase font-sans font-bold">falho</span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-500 leading-normal font-mono bg-zinc-50 p-1.5 rounded-lg border border-zinc-100 select-all overflow-x-auto">{testResults.smtp.message}</p>
                        </div>

                        {/* Telegram Alert result */}
                        <div className="p-3 bg-white rounded-xl border border-zinc-100 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">✈️ Telegram Bots API</span>
                            {testResults.telegram.status === "success" ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] px-2 py-0.5 rounded-full font-medium uppercase font-sans font-bold">online</span>
                            ) : testResults.telegram.status === "missing" ? (
                              <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded-full font-medium uppercase font-sans font-bold">simulado</span>
                            ) : (
                              <span className="bg-rose-100 text-rose-800 text-[9px] px-2 py-0.5 rounded-full font-medium uppercase font-sans font-bold">falho</span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-500 leading-normal font-mono bg-zinc-50 p-1.5 rounded-lg border border-zinc-100 select-all overflow-x-auto">{testResults.telegram.message}</p>
                        </div>

                        {/* Gemini result */}
                        <div className="p-3 bg-white rounded-xl border border-zinc-100 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">🧠 IA Inteligência Artificial</span>
                            {testResults.gemini.status === "success" ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] px-2 py-0.5 rounded-full font-medium uppercase font-sans font-bold">online</span>
                            ) : testResults.gemini.status === "missing" ? (
                              <span className="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded-full font-medium uppercase font-sans font-bold">simulado</span>
                            ) : (
                              <span className="bg-rose-100 text-rose-800 text-[9px] px-2 py-0.5 rounded-full font-medium uppercase font-sans font-bold">falho</span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-500 leading-normal font-mono bg-zinc-50 p-1.5 rounded-lg border border-zinc-100 select-all overflow-x-auto">{testResults.gemini.message}</p>
                        </div>

                        {/* Google Calendar result */}
                        <div className="p-3 bg-white rounded-xl border border-zinc-100 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">📅 Google Calendar Sync</span>
                            {testResults.calendar.status === "success" ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] px-2 py-0.5 rounded-full font-medium uppercase font-sans font-bold">conectado</span>
                            ) : testResults.calendar.status === "missing" ? (
                              <span className="bg-zinc-150 text-zinc-600 text-[9px] px-2 py-0.5 rounded-full font-medium uppercase font-sans font-bold">inativo</span>
                            ) : (
                              <span className="bg-rose-100 text-rose-800 text-[9px] px-2 py-0.5 rounded-full font-medium uppercase font-sans font-bold">link expirado</span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-500 leading-normal font-mono bg-zinc-50 p-1.5 rounded-lg border border-zinc-100 select-all overflow-x-auto">{testResults.calendar.message}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CONFIGURAÇÃO DE MODELOS DE EMAIL PERSONALIZADOS */}
                  <div className="bg-white rounded-2xl p-5 border border-zinc-100 space-y-4 shadow-xs">
                    <h4 className="text-xs font-bold text-slate-400 font-mono tracking-wider flex items-center justify-between border-b border-zinc-50 pb-2">
                      <span>✉️ Modelos de Comunicação por E-mail (HTML)</span>
                      <span className="text-[9px] bg-emerald-700 text-white px-2 py-0.5 rounded-full font-semibold font-sans">EDITÁVEL</span>
                    </h4>
                    
                    <p className="text-xs text-zinc-500 leading-relaxed font-sans">
                      Edite as mensagens enviadas automaticamente pelo consultório para as preparações clínicas e sintonizações emocionais. Use marcadores estruturados como <code>{"{{patient_name}}"}</code> ou <code>{"{{meet_link}}"}</code> para substituição dinâmica.
                    </p>

                    {selectedTemplateForEdit ? (
                      <form onSubmit={handleUpdateTemplate} className="space-y-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-mono font-bold text-emerald-800">Editando: {selectedTemplateForEdit.name}</span>
                          <button type="button" onClick={() => setSelectedTemplateForEdit(null)} className="text-[10px] text-zinc-400 hover:text-rose-700 font-mono cursor-pointer">CANCELAR</button>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-zinc-500 font-mono">Assunto do E-mail</label>
                          <input
                            type="text"
                            required
                            value={editTemplateSubject}
                            onChange={(e) => setEditTemplateSubject(e.target.value)}
                            className="w-full text-xs text-slate-800 bg-white border border-zinc-200 p-2.5 rounded-xl focus:border-emerald-600 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-zinc-500 font-mono">Corpo do E-mail (HTML Disponível)</label>
                          <textarea
                            required
                            rows={8}
                            value={editTemplateBody}
                            onChange={(e) => setEditTemplateBody(e.target.value)}
                            className="w-full text-xs text-slate-800 bg-white border border-zinc-200 p-2.5 rounded-xl focus:border-emerald-600 focus:outline-none font-mono text-[11px]"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-[#2F4738] hover:bg-[#1E2E24] text-white text-[10.5px] font-bold py-2.5 rounded-xl cursor-pointer"
                        >
                          Salvar Alterações de E-mail
                        </button>
                      </form>
                    ) : (
                      <div className="space-y-2">
                        {emailTemplatesList.length === 0 ? (
                          <p className="text-[11px] text-zinc-400 italic py-2 text-center">Nenhum modelo localizado.</p>
                        ) : (
                          emailTemplatesList.map((tpl) => (
                            <div key={tpl.id} className="p-3 bg-stone-50 rounded-xl border border-stone-100 flex items-center justify-between">
                              <div className="space-y-0.5">
                                <h5 className="text-xs font-bold text-[#2F4738] uppercase tracking-wide font-sans">{tpl.name.replace(/_/g, " ")}</h5>
                                <span className="text-[9px] text-zinc-500 block truncate max-w-[220px] font-sans">
                                  {tpl.subject}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTemplateForEdit(tpl);
                                  setEditTemplateSubject(tpl.subject);
                                  setEditTemplateBody(tpl.body);
                                }}
                                className="text-[10px] font-bold bg-[#2F4738]/10 text-[#2F4738] px-3 py-1 rounded-lg hover:bg-[#2F4738]/20 transition-colors cursor-pointer"
                              >
                                Editar
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* CURADORIA DE MATERIAIS EDUCATIVOS */}
                  <div className="bg-white rounded-2xl p-5 border border-zinc-100 space-y-4 shadow-xs">
                    <h4 className="text-xs font-bold text-slate-400 font-mono tracking-wider border-b border-zinc-50 pb-2 flex items-center justify-between">
                      <span>📚 Acervo Educativo Complementar</span>
                      <span className="text-[9px] bg-emerald-700 text-white px-2 py-0.5 rounded-full font-semibold font-sans">CURADORIA</span>
                    </h4>

                    <p className="text-xs text-zinc-500 leading-relaxed font-sans">
                      Adicione novos artigos, vídeos ou áudios para disponibilizar aos pacientes no feed de autoajuda do aplicativo deles.
                    </p>

                    <form onSubmit={handleAddEduContent} className="space-y-3 p-4 bg-stone-50 rounded-xl border border-stone-200/50">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-zinc-500 font-mono">Título do Recurso</label>
                          <input
                            type="text"
                            required
                            value={eduTitle}
                            onChange={(e) => setEduTitle(e.target.value)}
                            placeholder="Ex: Regulando o Sono em Tempos de Crise"
                            className="w-full text-xs text-slate-800 bg-white border border-zinc-200 p-2.5 rounded-xl focus:border-emerald-600 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-zinc-500 font-mono">Categoria</label>
                          <select
                            value={eduCategory}
                            onChange={(e) => setEduCategory(e.target.value)}
                            className="w-full text-xs text-slate-800 bg-white border border-zinc-200 p-2.5 rounded-xl focus:border-emerald-600 focus:outline-none"
                          >
                            <option value="Ansiedade">Ansiedade</option>
                            <option value="Sono">Qualidade de Sono</option>
                            <option value="Relacionamentos">Relacionamentos</option>
                            <option value="Mindfulness">Mindfulness</option>
                            <option value="Estresse de Trabalho">Estresse de Trabalho</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-zinc-500 font-mono">Formato</label>
                          <select
                            value={eduType}
                            onChange={(e) => setEduType(e.target.value as any)}
                            className="w-full text-xs text-slate-800 bg-white border border-zinc-200 p-2.5 rounded-xl focus:border-emerald-600 focus:outline-none"
                          >
                            <option value="article">Artigo Escrito</option>
                            <option value="video">Vídeo/Clipped</option>
                            <option value="podcast">Podcast (Áudio)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-zinc-500 font-mono">Tempo Est. Leitura</label>
                          <input
                            type="text"
                            required
                            value={eduDuration}
                            onChange={(e) => setEduDuration(e.target.value)}
                            placeholder="Ex: 5 min"
                            className="w-full text-xs text-slate-800 bg-white border border-zinc-200 p-2.5 rounded-xl focus:border-emerald-600 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-zinc-500 font-mono">URL Completa</label>
                          <input
                            type="url"
                            required
                            value={eduUrl}
                            onChange={(e) => setEduUrl(e.target.value)}
                            placeholder="https://exemplo.com/artigo"
                            className="w-full text-xs text-slate-800 bg-white border border-zinc-200 p-2.5 rounded-xl focus:border-emerald-600 focus:outline-none font-sans"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-zinc-500 font-mono">Resumo Chamada</label>
                        <textarea
                          required
                          rows={2}
                          value={eduSummary}
                          onChange={(e) => setEduSummary(e.target.value)}
                          placeholder="Fale brevemente do que se trata para motivar o paciente a ler..."
                          className="w-full text-xs text-slate-800 bg-white border border-zinc-200 p-2.5 rounded-xl focus:border-emerald-600 focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-[#2F4738] hover:bg-[#1E2E24] text-white text-[10.5px] font-bold py-2.5 rounded-xl cursor-pointer"
                      >
                        Publicar Material no Acervo
                      </button>
                    </form>

                    {/* Published list of assets */}
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                      {eduList.length === 0 ? (
                        <p className="text-[11px] text-zinc-400 italic text-center py-2">Acervo vazio.</p>
                      ) : (
                        eduList.map((item) => (
                          <div key={item.id} className="p-3 bg-stone-50 rounded-xl border border-stone-100 flex items-center justify-between">
                            <div className="flex-1 pr-4 min-w-0">
                              <span className="text-[8px] uppercase tracking-wider font-mono font-bold bg-zinc-200 text-stone-700 px-1.5 py-0.5 rounded font-mono">
                                {item.type}
                              </span>
                              <h5 className="text-[11px] font-bold text-[#2F4738] pt-1 truncate font-sans">{item.title}</h5>
                              <p className="text-[9px] text-zinc-400 truncate font-mono">{item.url}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteEduContent(item.id)}
                              className="text-[9px] font-bold text-[#A45A52] hover:bg-[#A45A52]/10 bg-transparent py-1 px-2.5 rounded-md border border-[#A45A52]/20 transition-colors shrink-0 cursor-pointer font-sans"
                            >
                              Remover
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB CONTENT: NOTIFICATION SYSTEM & INTEGRATIONS AUDIT */}
            {adminTab === "logs" && (
              <motion.div
                key="logs"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 flex-1 flex flex-col"
              >
                <div className="bg-white rounded-2xl p-5 border border-zinc-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800 tracking-tight flex items-center gap-1.5">
                      <Inbox className="w-4 h-4 text-emerald-600" />
                      Auditoria de Simuladores de Integrações
                    </h3>
                    <button
                      onClick={handleClearLogs}
                      className="text-[10px] font-semibold text-rose-700 hover:underline cursor-pointer"
                    >
                      Limpar Registro
                    </button>
                  </div>

                  <p className="text-xs text-zinc-500 leading-relaxed font-sans">
                    Abaixo estão os payloads e mensagens gerados em segundo plano simulados pelo backend para as APIs do <b>Telegram</b> e <b>E-mail (SMTP)</b>. Conecte suas credenciais em produção via <code>.env</code> para disparo efetivo direto às redes!
                  </p>
                </div>

                <div className="flex-1 bg-slate-900 rounded-2xl p-4 font-mono text-[10px] overflow-y-auto max-h-[40vh] space-y-3 border border-slate-800 text-slate-300">
                  <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold block mb-2">
                    Console Logs Real-time Pipeline &gt;_
                  </span>

                  {notificationLogs.length === 0 ? (
                    <p className="text-slate-500 italic block py-4 text-center">Nenhum evento registrado no console ainda.</p>
                  ) : (
                    notificationLogs.map((log) => (
                      <div key={log.id} className="border-b border-slate-800/80 pb-2.5 last:border-0 leading-relaxed">
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold ${
                            log.type === "telegram"
                              ? "bg-sky-950 text-sky-400 border border-sky-800/40"
                              : log.type === "email"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                              : "bg-slate-800 text-slate-300"
                          }`}>
                            {log.type.toUpperCase()}
                          </span>
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-slate-200">
                          <span className="text-slate-500 font-bold">Destino: </span>
                          {log.recipient}
                        </p>
                        <p className="text-slate-300 whitespace-pre-wrap">{log.message}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* LIST: CLINICAL GDPR AUDIT TRAIL DATA LEDGER */}
                <div className="bg-white rounded-2xl p-5 border border-zinc-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800 tracking-tight flex items-center gap-1.5 font-serif">
                      <Lock className="w-4 h-4 text-[#D9B8A7]" />
                      Trilha de Auditoria Clínica e LGPD (GDPR)
                    </h3>
                    <span className="text-[9px] font-mono font-bold bg-[#2F4738]/10 text-[#2F4738] px-2 py-0.5 rounded-full animate-none">
                      Ativo • Imutável
                    </span>
                  </div>
                  
                  <p className="text-[11px] text-zinc-500 leading-normal font-sans">
                    Log regulatório oficial e obrigatório de acesso e ações a dados sensíveis de pacientes (prontuário, CPF, diagnósticos). Garante rastreabilidade sob segurança estrita.
                  </p>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {auditLogs.length === 0 ? (
                      <p className="text-[11px] text-zinc-400 italic text-center py-4">Nenhuma trilha de auditoria clínica registrada ainda.</p>
                    ) : (
                      auditLogs.map((log) => (
                        <div key={log.id} className="p-3 bg-stone-50/80 rounded-xl border border-stone-100 space-y-1 text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] uppercase font-mono tracking-wider bg-zinc-200 text-zinc-800 font-bold px-2 py-0.5 rounded">
                              {log.action}
                            </span>
                            <span className="text-[9px] font-mono text-zinc-400">
                              {new Date(log.timestamp).toLocaleDateString("pt-BR")} {new Date(log.timestamp).toLocaleTimeString("pt-BR")}
                            </span>
                          </div>
                          <p className="text-xs text-stone-800 font-sans">
                            <span className="font-semibold text-[#2F4738]">Operador: </span>{log.operatorId || log.actor || "Sistema"}
                          </p>
                          <p className="text-[11px] text-stone-600 leading-normal">
                            {log.details || log.payloadHash || "Sem detalhes"}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}
            </AnimatePresence>

            {/* Clinical Receipt Generation and Print Modal */}
            {receiptModalAppt && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
                <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-zinc-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-serif font-bold text-[#2F4738] flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#D9B8A7]" />
                      Emissão de Recibo de Reembolso
                    </h3>
                    <button
                      onClick={() => setReceiptModalAppt(null)}
                      className="p-1 rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {!generatedReceiptResult ? (
                    <form onSubmit={handleGenerateReceipt} className="space-y-4 text-left">
                      <p className="text-xs text-zinc-500 leading-normal">
                        Preencha as informações regulamentares exigidas para reembolso do plano de saúde do paciente <b>{receiptModalAppt.patientName}</b>.
                      </p>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-mono font-bold text-zinc-500">CPF do Paciente</label>
                        <input
                          type="text"
                          required
                          value={receiptCPF}
                          onChange={(e) => setReceiptCPF(e.target.value)}
                          placeholder="000.000.000-00"
                          className="w-full text-xs text-slate-800 bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl focus:border-emerald-600 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-mono font-bold text-zinc-500">CRP da Psicóloga</label>
                          <input
                            type="text"
                            required
                            value={receiptCRP}
                            onChange={(e) => setReceiptCRP(e.target.value)}
                            className="w-full text-xs text-slate-800 bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl focus:border-emerald-600 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-mono font-bold text-zinc-500">Valor da Sessão (R$)</label>
                          <input
                            type="text"
                            required
                            value={receiptValue}
                            onChange={(e) => setReceiptValue(e.target.value)}
                            className="w-full text-xs text-slate-800 bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl focus:border-emerald-600 focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-[#2F4738] hover:bg-[#1E2E24] text-white text-xs font-semibold py-3 rounded-xl shadow-xs transition-colors cursor-pointer"
                      >
                        Emitir Recibo Assinado Digitalmente
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-4 text-left">
                      <div className="p-5 border-2 border-dashed border-stone-200 rounded-2xl bg-stone-50 space-y-4 font-serif text-stone-800 relative overflow-hidden select-all">
                        {/* Stamp overlay watermark */}
                        <div className="absolute right-[-20px] bottom-[-20px] opacity-10 text-[#2F4738]/20 border-8 border-dashed border-[#2F4738]/40 rounded-full w-40 h-40 flex items-center justify-center font-bold font-sans text-center rotate-12 leading-none text-[10px] uppercase select-none pointer-events-none">
                          Dra. Elieyd<br/>Psicologia Clínica
                        </div>

                        <h4 className="text-center font-bold tracking-tight uppercase border-b border-stone-200 pb-2 text-[13px] text-stone-900">
                          Recibo de Honorários Psicológicos
                        </h4>

                        <p className="text-[11.5px] leading-relaxed font-sans text-stone-700">
                          Recebi de <b>{generatedReceiptResult.paciente}</b>, portador(a) do CPF sob o nº <b>{generatedReceiptResult.cpfPaciente}</b>, a importância de <b>R$ {generatedReceiptResult.valor}</b> referente a consulta psicoterapêutica clínica realizada online no dia <b>{new Date(generatedReceiptResult.dataSessao).toLocaleDateString("pt-BR")}</b>.
                        </p>

                        <div className="text-[11px] font-sans text-stone-600 space-y-1 border-t border-stone-200/60 pt-3">
                          <p><b>Emitente:</b> Dra. Elieyd - Psicóloga Clínica</p>
                          <p><b>CRP:</b> {generatedReceiptResult.crpEmitente}</p>
                          <p><b>Registro de Segurança:</b> {generatedReceiptResult.chaveSeguranca}</p>
                          <p><b>Data de Emissão:</b> {new Date(generatedReceiptResult.emitidoEm).toLocaleString("pt-BR")}</p>
                        </div>

                        <div className="text-[9px] font-mono text-zinc-400 bg-stone-100/50 p-2 rounded-lg border border-stone-200/40 select-all font-mono leading-tight">
                          🔒 ASSINATURA ELETRÔNICA DO EMISSOR (AES-256):<br/>
                          <span className="break-all">{generatedReceiptResult.assinaturaHash}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            window.print();
                          }}
                          className="flex-1 py-2.5 border border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 rounded-xl text-xs font-semibold cursor-pointer text-center"
                        >
                          Imprimir Recibo
                        </button>
                        <button
                          type="button"
                          onClick={() => setReceiptModalAppt(null)}
                          className="flex-1 py-2.5 bg-[#2F4738] hover:bg-[#1E2E24] text-white rounded-xl text-xs font-semibold cursor-pointer text-center"
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Rescheduling Action input Form Modal */}
            {reschedulingAppt && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
                <div className="bg-white rounded-3xl p-5 max-w-sm w-full border border-zinc-200 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase tracking-wider text-slate-400 font-mono font-semibold">
                      Novo Horário Prometido
                    </h3>
                    <button
                      onClick={() => setReschedulingAppt(null)}
                      className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-xs text-zinc-500">
                    Defina abaixo a nova data e hora acordada com o paciente <b>{reschedulingAppt.patientName}</b>. Um e-mail será disparado com o novo bilhete eletrônico.
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-mono">Nova Data:</label>
                      <input
                        type="date"
                        value={reschedDate}
                        onChange={(e) => setReschedDate(e.target.value)}
                        className="w-full text-xs text-slate-800 bg-slate-50 border p-2.5 rounded-xl transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-mono">Novo Horário (HH:MM):</label>
                      <input
                        type="text"
                        value={reschedTime}
                        onChange={(e) => setReschedTime(e.target.value)}
                        placeholder="Ex: 14:00"
                        className="w-full text-xs text-slate-800 bg-slate-50 border p-2.5 rounded-xl transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 font-mono">Observação ou Justificativa:</label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Por motivos de força maior, alterei o horário para..."
                        rows={2}
                        className="w-full text-xs text-slate-800 bg-slate-50 border p-2.5 rounded-xl transition-colors resize-none"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() =>
                          handleUpdateAppointmentStatus(
                            reschedulingAppt.id,
                            "rescheduled",
                            reschedDate,
                            reschedTime,
                            adminNotes
                          )
                        }
                        className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs rounded-xl"
                      >
                        Confirmar Reagendamento
                      </button>
                      <button
                        onClick={() => setReschedulingAppt(null)}
                        className="py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-medium text-xs rounded-xl"
                      >
                        Voltar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* WhatsApp Quick Message Action Modal */}
            {whatsappModalAppt && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs text-left">
                <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-zinc-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-serif font-bold text-[#2F4738] flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4 text-emerald-600 fill-emerald-600/10" />
                      Envio de Mensagem via WhatsApp
                    </h3>
                    <button
                      onClick={() => setWhatsappModalAppt(null)}
                      className="p-1 rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-xs text-zinc-500 leading-normal">
                    Selecione um modelo abaixo para preencher automaticamente ou digite uma mensagem livre para <b>{whatsappModalAppt.patientName}</b>.
                  </p>

                  {/* Template tabs selection */}
                  <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-50 rounded-xl border border-zinc-100">
                    <button
                      type="button"
                      onClick={() => setWhatsappTemplateType("confirm")}
                      className={`py-1.5 text-[9px] font-semibold rounded-lg transition-colors cursor-pointer text-center ${
                        whatsappTemplateType === "confirm" ? "bg-[#2F4738] text-white" : "text-zinc-500 hover:text-[#2F4738]"
                      }`}
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setWhatsappTemplateType("reminder")}
                      className={`py-1.5 text-[9px] font-semibold rounded-lg transition-colors cursor-pointer text-center ${
                        whatsappTemplateType === "reminder" ? "bg-[#2F4738] text-white" : "text-zinc-500 hover:text-[#2F4738]"
                      }`}
                    >
                      Lembrete
                    </button>
                    <button
                      type="button"
                      onClick={() => setWhatsappTemplateType("reschedule")}
                      className={`py-1.5 text-[9px] font-semibold rounded-lg transition-colors cursor-pointer text-center ${
                        whatsappTemplateType === "reschedule" ? "bg-[#2F4738] text-white" : "text-zinc-500 hover:text-[#2F4738]"
                      }`}
                    >
                      Reagendar
                    </button>
                    <button
                      type="button"
                      onClick={() => setWhatsappTemplateType("cancel")}
                      className={`py-1.5 text-[9px] font-semibold rounded-lg transition-colors cursor-pointer text-center ${
                        whatsappTemplateType === "cancel" ? "bg-[#2F4738] text-white" : "text-zinc-500 hover:text-[#2F4738]"
                      }`}
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono font-bold text-zinc-500">Celular do Paciente</label>
                      <input
                        type="text"
                        disabled
                        value={whatsappModalAppt.patientPhone}
                        className="w-full text-xs text-slate-500 bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl cursor-not-allowed opacity-80"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono font-bold text-zinc-500">Mensagem (Editável)</label>
                      <textarea
                        rows={6}
                        value={whatsappMessageText}
                        onChange={(e) => setWhatsappMessageText(e.target.value)}
                        placeholder="Escreva sua mensagem aqui..."
                        className="w-full text-xs text-slate-800 bg-white border border-zinc-200 p-3 rounded-xl focus:border-[#2F4738] focus:outline-none focus:ring-1 focus:ring-[#2F4738]/20 transition-all font-sans"
                      />
                    </div>

                    {/* Quick sending action button */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          const cleanedPhone = whatsappModalAppt.patientPhone.replace(/\D/g, "");
                          const finalPhone = cleanedPhone.length === 11 || cleanedPhone.length === 10 ? "55" + cleanedPhone : cleanedPhone;
                          const encodedMessage = encodeURIComponent(whatsappMessageText);
                          const waUrl = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodedMessage}`;
                          window.open(waUrl, "_blank");
                          setWhatsappModalAppt(null);
                        }}
                        className="flex-1 py-2.5 bg-emerald-650 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm focus:outline-none cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4 fill-white/10" />
                        Abrir WhatsApp e Enviar
                      </button>
                      <button
                        onClick={() => setWhatsappModalAppt(null)}
                        className="py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-650 text-zinc-605 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                      >
                        Voltar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Histórico Geral de Sessões (Ocorridas e Não Ocorridas) */}
            {isHistoryModalOpen && selectedHistoryPatient && (() => {
              const userAppts = appointments.filter((a) => a.userId === selectedHistoryPatient.id);
              const completedAppts = userAppts.filter((a) => a.status === "completed");
              const nonCompletedAppts = userAppts.filter((a) => a.status === "cancel" || a.status === "canceled" || a.status === "cancelled" || a.status === "noshow");
              const upcomingAppts = userAppts.filter((a) => a.status === "pending" || a.status === "confirmed" || a.status === "rescheduled");

              return (
                <div className="fixed inset-0 z-55 bg-black/65 flex items-center justify-center p-4 backdrop-blur-xs text-left animate-fade-in font-sans">
                  <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full border border-zinc-200 shadow-2xl flex flex-col max-h-[85vh]">
                    
                    {/* Header */}
                    <div className="flex items-start justify-between pb-4 border-b border-zinc-150">
                      <div>
                        <h3 className="text-base font-serif font-bold text-[#2F4738]">
                          Histórico Geral de Consultas
                        </h3>
                        <p className="text-xs text-zinc-500 font-sans mt-0.5">
                          Paciente: <strong className="text-slate-705">{selectedHistoryPatient.name}</strong> • {selectedHistoryPatient.phone}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setIsHistoryModalOpen(false);
                          setSelectedHistoryPatient(null);
                        }}
                        className="p-1.5 px-3 bg-zinc-50 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-slate-600 cursor-pointer font-bold text-xs flex items-center gap-1 border border-zinc-200 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Fechar</span>
                      </button>
                    </div>

                    {/* Summary Indicators */}
                    <div className="grid grid-cols-3 gap-3 my-4">
                      <div className="bg-[#EBF5EF] p-2.5 rounded-xl border border-emerald-150 text-center">
                        <span className="block text-[8px] uppercase tracking-wider font-mono font-bold text-emerald-800">Sessões Realizadas</span>
                        <strong className="text-lg font-bold font-mono text-[#2F4738]">{completedAppts.length}</strong>
                      </div>
                      
                      <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-center">
                        <span className="block text-[8px] uppercase tracking-wider font-mono font-bold text-rose-800">Canceladas / Faltas</span>
                        <strong className="text-lg font-bold font-mono text-rose-700">{nonCompletedAppts.length}</strong>
                      </div>

                      <div className="bg-[#FAF8F6] p-2.5 rounded-xl border border-[#D9B8A7]/30 text-center">
                        <span className="block text-[8px] uppercase tracking-wider font-mono font-bold text-[#556B5D]">Reagendadas / Futuras</span>
                        <strong className="text-lg font-bold font-mono text-[#2F4738]">{upcomingAppts.length}</strong>
                      </div>
                    </div>

                    {/* Historical Logs List */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[50vh]">
                      {/* Section: COMPARECIDAS (Ocorreram) */}
                      <div>
                        <h4 className="text-[10px] uppercase font-mono font-bold text-emerald-800 tracking-wider mb-2 flex items-center gap-1.5">
                          <span>🟢 Sessões Ocorridas ({completedAppts.length})</span>
                          <span className="h-px bg-emerald-100 flex-1" />
                        </h4>
                        
                        {completedAppts.length === 0 ? (
                          <p className="text-[10px] text-zinc-400 italic pl-3">Nenhuma sessão completada registrada até o momento.</p>
                        ) : (
                          <div className="space-y-2 pl-2">
                            {completedAppts.map((appt) => (
                              <div key={appt.id} className="bg-zinc-50/65 p-3 rounded-xl border border-zinc-200 relative text-[11px] hover:bg-zinc-50 transition-colors">
                                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                                  <span>📅 {new Date(appt.date + "T00:00:00").toLocaleDateString("pt-BR")} às {appt.time}</span>
                                  <span className="text-emerald-800 font-bold uppercase tracking-wider bg-emerald-50 px-1.5 rounded border border-emerald-200 text-[8.5px]">Realizada</span>
                                </div>
                                <div className="mt-1 flex items-center gap-2">
                                  <span className="text-[9px] bg-white text-zinc-650 px-1.5 py-0.2 rounded border border-zinc-200">
                                    {appt.modality === "online" ? "🌐 Online" : "🏢 Presencial"}
                                  </span>
                                  {appt.sessionNumber && (
                                    <span className="text-[9px] text-[#556B5D] font-bold font-mono">Sessão Nº {appt.sessionNumber}</span>
                                  )}
                                </div>
                                {appt.notes && (
                                  <p className="text-[10px] text-zinc-600 mt-2 bg-white p-2 rounded-lg border border-zinc-150 italic font-sans">
                                    "{appt.notes}"
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Section: NÃO OCORRIDAS (Canceladas ou Faltas) */}
                      <div className="pt-2">
                        <h4 className="text-[10px] uppercase font-mono font-bold text-rose-800 tracking-wider mb-2 flex items-center gap-1.5">
                          <span>🔴 Sessões Não Ocorridas / Canceladas ({nonCompletedAppts.length})</span>
                          <span className="h-px bg-rose-100 flex-1" />
                        </h4>
                        
                        {nonCompletedAppts.length === 0 ? (
                          <p className="text-[10px] text-zinc-400 italic pl-3">Nenhum registro de falta ou cancelamento.</p>
                        ) : (
                          <div className="space-y-2 pl-2">
                            {nonCompletedAppts.map((appt) => (
                              <div key={appt.id} className="bg-[#FAF8F6] p-3 rounded-xl border border-[#D9B8A7]/20 relative text-[11px] hover:bg-red-50/20 transition-colors">
                                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                                  <span>📅 {new Date(appt.date + "T00:00:00").toLocaleDateString("pt-BR")} às {appt.time}</span>
                                  <span className="text-rose-800 font-bold uppercase tracking-wider bg-rose-50 px-1.5 rounded border border-rose-200 text-[8.5px]">
                                    {appt.status === "noshow" ? "Falta" : "Cancelada"}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center gap-2">
                                  <span className="text-[9px] bg-white text-zinc-500 px-1.5 py-0.2 rounded border border-zinc-200">
                                    {appt.modality === "online" ? "🌐 Online" : "🏢 Presencial"}
                                  </span>
                                </div>
                                {appt.notes ? (
                                  <p className="text-[10px] text-rose-950 mt-2 bg-white p-2 rounded-lg border border-rose-100 italic">
                                    Motivo registrado: "{appt.notes}"
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-zinc-400 mt-2 italic font-sans pl-2">Sem justificativa registrada no prontuário.</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Professional Psychologist Session Notes & AI Dynamic Consultant Modal */}
            {isSessionNotesModalOpen && selectedSessionPatient && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs text-left">
                <div className="bg-white rounded-3xl p-6 md:p-8 max-w-5xl w-full border border-zinc-200 shadow-2xl flex flex-col max-h-[90vh]">
                  
                  {/* Header */}
                  <div className="flex items-start justify-between pb-4 border-b border-zinc-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-[#2F4738]/10 rounded-lg">
                          <Brain className="w-5 h-5 text-[#2F4738]" />
                        </span>
                        <h3 className="text-base font-serif font-bold text-[#2F4738]">
                          Supervisão & Assistência Clínica com IA
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-500 font-sans">
                        Paciente: <strong className="text-slate-700">{selectedSessionPatient.name}</strong> • Consulta Privada para Uso Clínico Exclusivo
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        stopAudioRecording();
                        setIsSessionNotesModalOpen(false);
                        setSelectedSessionPatient(null);
                      }}
                      className="p-1 px-3 bg-zinc-50 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-slate-600 cursor-pointer font-bold text-xs flex items-center gap-1 border border-zinc-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>Fechar</span>
                    </button>
                  </div>

                  {/* Legal Notice */}
                  <div className="my-3 p-3 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-xl">
                    <p className="text-[10px] text-indigo-950 leading-normal font-medium leading-relaxed">
                      💡 <strong>Aviso de Sigilo:</strong> Este painel e todos os relatórios científicos gerados abaixo são protegidos por criptografia simétrica AES-256 GCM e estão em estrito cumprimento com o <strong>Código de Ética do Psicólogo</strong> e a <strong>LGPD</strong>. Nenhuma dessas anotações fica disponível aos pacientes.
                    </p>
                  </div>

                  {/* Body Columns */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto pr-1 flex-1 py-1">
                    
                    {/* Left Column - New Session Notes */}
                    <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
                      <div className="space-y-3.5 animate-fade-in">
                        <span className="text-[10px] uppercase font-mono font-bold text-zinc-400 tracking-wider">Nova Sessão</span>
                        
                        {/* Session Date and Time Pickers */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-600 font-mono">Data da Consulta</label>
                            <input
                              type="date"
                              value={newSessionNoteDate}
                              onChange={(e) => setNewSessionNoteDate(e.target.value)}
                              className="w-full text-xs p-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-[#2F4738]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-600 font-mono">Horário</label>
                            <input
                              type="time"
                              value={newSessionNoteTime}
                              onChange={(e) => setNewSessionNoteTime(e.target.value)}
                              className="w-full text-xs p-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-[#2F4738]"
                            />
                          </div>
                        </div>

                        {/* Audio Dictation Section */}
                        <div className="bg-[#FAF8F6] p-3 rounded-2xl border border-dashed border-[#D9B8A7]/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9.5px] font-mono font-bold text-[#556B5D] uppercase tracking-wider flex items-center gap-1">
                              <Mic className="w-3.5 h-3.5 text-[#556B5D]" />
                              Gravar Ditado de Consulta
                            </span>
                            {isRecordingAudio && (
                              <span className="text-[9px] font-mono text-rose-600 flex items-center gap-1 font-bold animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                GRAVANDO • {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                            Grave observações clínicas por voz e a inteligência artificial fará a transcrição de áudio terapêutico automaticamente.
                          </p>

                          <div className="flex gap-2">
                            {isRecordingAudio ? (
                              <button
                                onClick={stopAudioRecording}
                                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[10.5px] rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <StopCircle className="w-3.5 h-3.5" />
                                Parar e Transcrever
                              </button>
                            ) : (
                              <button
                                onClick={startAudioRecording}
                                disabled={isTranscribing}
                                className="flex-1 py-2 bg-[#2F4738] hover:bg-[#203126] text-white font-semibold text-[10.5px] rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                <Mic className="w-3.5 h-3.5" />
                                {isTranscribing ? "IA Transcrevendo..." : "Iniciar Ditado de Áudio"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* TextArea Notes field */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-mono font-bold text-slate-600 uppercase">Observações da Psicoterapia</label>
                            {isTranscribing && (
                              <span className="text-[10px] text-[#2F4738] flex items-center gap-1 font-mono">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Transcrevendo áudio...
                              </span>
                            )}
                          </div>
                          <textarea
                            rows={8}
                            value={newSessionNoteText}
                            onChange={(e) => setNewSessionNoteText(e.target.value)}
                            placeholder="Escreva aqui os principais pontos discutidos nesta sessão, comportamentos, sintomas relatados ou insights do profissional..."
                            className="w-full text-xs p-3 bg-white border border-zinc-200 rounded-2xl focus:border-[#2F4738] focus:outline-none focus:ring-1 focus:ring-[#2F4738]/20 transition-all font-sans"
                          />
                        </div>
                      </div>

                      {/* Main Save & AI Analysis action */}
                      <div className="pt-2">
                        <button
                          onClick={handleSaveSessionNote}
                          disabled={isNoteSavingAndAnalyzing || isRecordingAudio}
                          className="w-full py-3 bg-[#2F4738] hover:bg-[#203126] disabled:bg-zinc-300 text-white font-semibold text-xs rounded-2xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          {isNoteSavingAndAnalyzing ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Calculando Insights & Métodos de Feedback...
                            </>
                          ) : (
                            <>
                              <Brain className="w-4 h-4" />
                              Processar com IA e Salvar Prontuário
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Right Column - Historical Timeline of Sessions with AI Feedback */}
                    <div className="lg:col-span-7 space-y-4 flex flex-col overflow-y-auto max-h-[50vh] lg:max-h-full">
                      <span className="text-[10px] uppercase font-mono font-bold text-zinc-400 tracking-wider">Histórico de Sessões ({sessionNotesHistory.length})</span>
                      
                      {sessionNotesHistory.length === 0 ? (
                        <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 text-center my-auto flex flex-col items-center justify-center space-y-2">
                          <Brain className="w-8 h-8 text-zinc-350" />
                          <h4 className="text-xs font-bold text-slate-600">Nenhum histórico registrado</h4>
                          <p className="text-[11px] text-zinc-400 max-w-xs">Use o painel ao lado para registrar observações clínicas da sessão de {selectedSessionPatient.name} e receba imediatamente um parecer científico detalhado.</p>
                        </div>
                      ) : (
                        <div className="space-y-4 pr-1 flex-1">
                          {sessionNotesHistory.map((note: any) => (
                            <div key={note.id} className="bg-zinc-50/65 rounded-2xl p-4 border border-zinc-200/80 space-y-3 font-sans">
                              {/* Header info */}
                              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-zinc-200/50">
                                <div className="text-[11px] text-slate-850 font-bold flex items-center gap-1.5">
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[9px] font-mono border border-emerald-100 uppercase font-bold">Sessão Registrada</span>
                                  <span>🗓️ {note.date.split("-").reverse().join("/")} às {note.time}h</span>
                                </div>
                                <span className="text-[9px] text-zinc-400 font-mono">Inscrito em {new Date(note.createdAt).toLocaleDateString("pt-BR")}</span>
                              </div>

                              {/* Patient Observation text */}
                              <div className="space-y-1">
                                <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">Observações do Atendimento:</p>
                                <p className="text-xs text-slate-755 leading-relaxed bg-white p-3 rounded-xl border border-zinc-200 italic">
                                  "{note.text}"
                                </p>
                              </div>

                              {/* Collapsible Action for AI Clinical Assistance */}
                              <div className="space-y-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setExpandedInsightNoteId(expandedInsightNoteId === note.id ? null : note.id)}
                                  className="w-full text-left py-2 px-3 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border border-indigo-100 rounded-xl flex items-center justify-between text-[11px] font-semibold cursor-pointer transition-colors"
                                >
                                  <span className="flex items-center gap-1.5 text-indigo-950 font-sans">
                                    <Brain className="w-3.5 h-3.5 text-indigo-600" />
                                    Visualizar Assistente Terapêutico e Parecer Científico IA
                                  </span>
                                  <span className="text-[10px] text-indigo-700 font-mono font-bold">
                                    {expandedInsightNoteId === note.id ? "▲ Ocultar Parecer" : "▼ Exibir Parecer Inteligente"}
                                  </span>
                                </button>

                                {expandedInsightNoteId === note.id && note.aiFeedback && (
                                  <div className="grid grid-cols-1 gap-3 p-3.5 bg-white border border-indigo-100 rounded-xl shadow-xs space-y-2.5 animate-fade-in text-left">
                                    
                                    {/* 1. Scientific clinical formulation */}
                                    <div className="space-y-1 text-[#2F4738] bg-emerald-50/20 p-3 rounded-xl border border-emerald-100/30">
                                      <p className="text-[10.5px] font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono text-emerald-800">
                                        <Volume2 className="w-3.5 h-3.5 text-emerald-700 font-bold" />
                                        Síntese Clínico-Científica
                                      </p>
                                      <p className="text-[11.5px] text-zinc-700 leading-relaxed font-sans">
                                        {note.aiFeedback.scientificAnalysis}
                                      </p>
                                    </div>

                                    {/* 2. Cognitive Behavioral Insights */}
                                    <div className="space-y-1 text-slate-800 bg-amber-50/10 p-3 rounded-xl border border-amber-100/30">
                                      <p className="text-[10.5px] font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono text-amber-700 font-bold">
                                        🧩 Marcadores & Processamento Cognitivo-Comportamental
                                      </p>
                                      <p className="text-[11.5px] text-zinc-700 leading-relaxed font-sans">
                                        {note.aiFeedback.cognitiveBehavioralInsights}
                                      </p>
                                    </div>

                                    {/* 3. Therapeutic Suggestions & Homework */}
                                    <div className="space-y-1 text-slate-800 bg-blue-50/10 p-3 rounded-xl border border-blue-100/30">
                                      <p className="text-[10.5px] font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono text-indigo-750 font-bold">
                                        💡 Recomendações e Métodos de Intervenção
                                      </p>
                                      <p className="text-[11.5px] text-zinc-700 leading-relaxed font-sans font-medium">
                                        {note.aiFeedback.therapeuticSuggestions}
                                      </p>
                                    </div>

                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================ */
          /* PATIENT PORTAL INTERFACES                                    */
          /* ============================================================ */
          <div className="space-y-6 flex-1 flex flex-col">
            {/* Elegant Welcome Intro */}
            <AnimatePresence mode="wait">
              {activeTab === "stories" && (
                <motion.div
                  key="stories"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="bg-gradient-to-br from-emerald-100/40 via-teal-100/20 to-white p-5 rounded-2xl border border-emerald-100/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      <span className="text-[10px] uppercase tracking-wider text-emerald-800 font-mono font-medium">
                        Meu Consultório Particular
                      </span>
                    </div>
                    <h2 className="text-md font-serif font-bold text-slate-800 leading-tight">
                      Olá, {currentUser.name.split(" ")[0]}!
                    </h2>
                    <p className="text-[11px] text-zinc-500 leading-normal font-sans mt-1">
                      Encontre no menu abaixo as ferramentas para acompanhar sua regulação de sentimentos, consultar vagas disponíveis em tempo real e receber suas reflexões guiadas e estruturadas.
                    </p>
                  </div>

                  {/* Circular Instagram Stories Reflections preview components */}
                  <InstagramReflections
                    reflections={reflections}
                    onGenerateAI={handleTriggerAIGenerator}
                    loadingAI={refGenerating}
                  />

                  {/* Primary Daily Reflection display card */}
                  {reflections.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 shadow-xs border border-zinc-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-medium">
                          ✦ Reflexão sugerida do dia
                        </span>
                        <span className="text-[9px] text-zinc-400 font-mono">Dra. Elieyd Barreto</span>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-md font-semibold text-slate-800 tracking-tight">
                          {reflections[0].title}
                        </h3>
                        <p className="text-xs text-zinc-600 leading-relaxed font-sans whitespace-pre-line">
                          {reflections[0].text}
                        </p>
                      </div>

                      {/* Instruction Box */}
                      <div className="bg-stone-50 rounded-xl p-3.5 border border-zinc-100">
                        <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-mono font-semibold block mb-1">
                          💡 Exercício de Atenção Plena:
                        </span>
                        <p className="text-xs text-zinc-700 leading-relaxed font-medium">
                          {reflections[0].instruction}
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* TAB CONTENT: DIARY WRITER */}
              {activeTab === "diary" && (
                <motion.div
                  key="diary"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <DiaryView
                    user={currentUser}
                    onUpdateUser={(updated) => setCurrentUser(updated)}
                    entries={diaryEntries}
                    onSubmitEntry={handleAddDiaryEntry}
                    loading={loading}
                  />
                </motion.div>
              )}

              {/* TAB CONTENT: CALENDAR BOOKER AND STATUS COGNITION */}
              {activeTab === "calendar" && (
                <motion.div
                  key="calendar"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <CalendarView
                    user={currentUser}
                    availabilities={availabilities}
                    myAppointments={appointments}
                    onRequestAppointment={handleBookAppointment}
                    loading={loading}
                  />
                </motion.div>
              )}

              {/* TAB CONTENT: RESOURCES HUB (SCREENINGS, LIBRARY, PRIVACY) */}
              {activeTab === "resources" && currentUser && (
                <motion.div
                  key="resources"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <ResourcesHub
                    user={currentUser}
                    onUpdateUser={(updated) => setCurrentUser(updated)}
                    onLogout={handleLogout}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

       {/* Patient Portable Bottom Navigation Bar */}
      {currentUser && (currentUser.role === "patient" || (currentUser.role === "admin" && isAdminViewingAsPatient)) && (
        <footer className="bg-[#FAF8F6] border-t border-[#D9B8A7]/25 sticky bottom-0 z-40 pb-safe">
          <div className="max-w-md mx-auto grid grid-cols-4 py-2 px-4">
            <button
              onClick={() => setActiveTab("stories")}
              className={`relative flex flex-col items-center gap-1 py-1.5 transition-colors cursor-pointer rounded-xl ${
                activeTab === "stories" ? "text-[#2F4738] font-semibold" : "text-[#8A8A8A] hover:text-[#2F4738]"
              }`}
            >
              {activeTab === "stories" && (
                <motion.span
                  layoutId="activePatientTab"
                  className="absolute inset-x-2 inset-y-0.5 bg-[#2F4738]/5 rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Heart className={`w-5 h-5 ${activeTab === "stories" ? "fill-[#2F4738]/10" : ""}`} />
              <span className="text-[10px] font-medium tracking-tight">Início</span>
            </button>

            <button
              onClick={() => setActiveTab("diary")}
              className={`relative flex flex-col items-center gap-1 py-1.5 transition-colors cursor-pointer rounded-xl ${
                activeTab === "diary" ? "text-[#2F4738] font-semibold" : "text-[#8A8A8A] hover:text-[#2F4738]"
              }`}
            >
              {activeTab === "diary" && (
                <motion.span
                  layoutId="activePatientTab"
                  className="absolute inset-x-2 inset-y-0.5 bg-[#2F4738]/5 rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <BookOpen className={`w-5 h-5 ${activeTab === "diary" ? "fill-[#2F4738]/10" : ""}`} />
              <span className="text-[10px] font-medium tracking-tight font-sans">Diário</span>
            </button>

            <button
              onClick={() => setActiveTab("calendar")}
              className={`relative flex flex-col items-center gap-1 py-1.5 transition-colors cursor-pointer rounded-xl ${
                activeTab === "calendar" ? "text-[#2F4738] font-semibold" : "text-[#8A8A8A] hover:text-[#2F4738]"
              }`}
            >
              {activeTab === "calendar" && (
                <motion.span
                  layoutId="activePatientTab"
                  className="absolute inset-x-2 inset-y-0.5 bg-[#2F4738]/5 rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Calendar className={`w-5 h-5 ${activeTab === "calendar" ? "fill-[#2F4738]/10" : ""}`} />
              <span className="text-[10px] font-medium tracking-tight font-sans">Agenda</span>
            </button>

            <button
              onClick={() => setActiveTab("resources")}
              className={`relative flex flex-col items-center gap-1 py-1.5 transition-colors cursor-pointer rounded-xl ${
                activeTab === "resources" ? "text-[#2F4738] font-semibold" : "text-[#8A8A8A] hover:text-[#2F4738]"
              }`}
            >
              {activeTab === "resources" && (
                <motion.span
                  layoutId="activePatientTab"
                  className="absolute inset-x-2 inset-y-0.5 bg-[#2F4738]/5 rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Sliders className={`w-5 h-5 ${activeTab === "resources" ? "fill-[#2F4738]/10" : ""}`} />
              <span className="text-[10px] font-medium tracking-tight font-sans">Apoio</span>
            </button>
          </div>
        </footer>
      )}

      {/* GOOGLE ACCOUNT CHOOSER WINDOW MODAL */}
      {isGoogleChooserOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-zinc-200 animate-in fade-in zoom-in-95 duration-250 flex flex-col">
            {/* Header */}
            <div className="p-6 text-center border-b border-zinc-100 relative">
              <button 
                onClick={() => {
                  setIsGoogleChooserOpen(false);
                  setAuthError("");
                }}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 transition-colors p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex justify-center mb-3">
                {/* Standard Google Multi-colored G Logo */}
                <svg className="w-8 h-8" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.54 0 2.92.53 4.01 1.58l3-3A11.96 11.96 0 0012 0C7.3 0 3.23 2.72 1.23 6.69l3.58 2.78C5.7 6.44 8.61 5.04 12 5.04z" />
                  <path fill="#4285F4" d="M23.52 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.46a5.52 5.52 0 01-2.4 3.63l3.72 2.88c2.18-2.01 3.74-4.97 3.74-8.64z" />
                  <path fill="#FBBC05" d="M4.81 9.47A7.17 7.17 0 014.5 12c0 .87.11 1.72.31 2.53l-3.58 2.78A11.94 11.94 0 010 12c0-1.92.45-3.74 1.23-5.31l3.58 2.78z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.72-2.88c-1.04.7-2.38 1.11-4.21 1.11-3.39 0-6.3-1.4-7.31-4.43l-3.58 2.78C3.23 21.28 7.3 24 12 24z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-800 font-sans">Simular Login com o Google</h3>
              <p className="text-[11px] text-[#2F4738] bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 mt-2 mx-2 font-sans text-center leading-normal">
                Pronto para o seu site! Digite sua conta abaixo para conectar com total autonomia.
              </p>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {authError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-800 text-[10px] font-sans flex items-center gap-2">
                  <AlertCircle className="w-4.5 h-4.5 text-red-600 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const emailVal = customGoogleEmail.trim() || "jefferson.videira@gmail.com";
                  const nameVal = customGoogleName.trim() || "Jefferson Videira";
                  handleGoogleCheck(nameVal, emailVal);
                }}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold block">
                    Seu E-mail Google
                  </label>
                  <input
                    type="email"
                    required
                    value={customGoogleEmail}
                    onChange={(e) => setCustomGoogleEmail(e.target.value)}
                    placeholder="jefferson.videira@gmail.com"
                    className="w-full text-xs text-slate-800 bg-slate-50 border border-zinc-200 p-3 rounded-2xl focus:border-blue-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500/20 font-sans font-medium"
                  />
                </div>

                <div className="space-y-1 font-sans">
                  <label className="text-[9px] uppercase tracking-wider text-slate-400 font-mono font-bold block">
                    Nome Completo do Perfil
                  </label>
                  <input
                    type="text"
                    required
                    value={customGoogleName}
                    onChange={(e) => setCustomGoogleName(e.target.value)}
                    placeholder="Jefferson Videira"
                    className="w-full text-xs text-slate-800 bg-slate-50 border border-zinc-200 p-3 rounded-2xl focus:border-blue-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500/20 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-full transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/25 active:scale-98"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Autenticar com Google</span>
                  )}
                </button>
              </form>


            </div>

            {/* Footer disclaimer */}
            <div className="bg-zinc-50 p-4 border-t border-zinc-100">
              <p className="text-[9px] text-zinc-400 leading-relaxed font-sans">
                Para continuar, o Google compartilhará seu nome, endereço de e-mail e foto do perfil com a plataforma de consulta de agendamentos. Consulte a política de privacidade.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}