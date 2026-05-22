export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'patient' | 'admin';
  createdAt: string;
  authorizedForDiary: boolean; // Patient explicitly authorizes the psychologist to view their diary if true (e.g., toggle-able for privacy)
  gender?: string; // e.g. 'Masculino' | 'Feminino' | 'Outro'
  sessionType?: 'presencial' | 'online';
  discoverySource?: string; // e.g. 'Google', 'Indicação', 'Instagram', etc
  clinicalNotes?: string;

  // New Clinical & LGPD Fields:
  socialName?: string;
  pronouns?: string;
  birthDate?: string; // ISO format (YYYY-MM-DD)
  cpf?: string; // Criptografado em repouso
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  consentLgpd?: {
    accepted: boolean;
    version: string;
    acceptedAt: string;
  };
  consentTerapeutico?: {
    accepted: boolean;
    version: string;
    acceptedAt: string;
  };
  anamnese?: {
    queixaPrincipal?: string;
    historico?: string;
    medicacoes?: string;
    habitos?: string;
    redeApoio?: string;
    [key: string]: any;
  };
  screeningHistory?: Array<{
    instrument: 'PHQ-9' | 'GAD-7' | 'PSS-10' | 'AUDIT';
    score: number;
    classification?: string;
    takenAt: string;
  }>;
  safetyPlan?: {
    triggers?: string;
    warningSigns?: string;
    copingStrategies?: string;
    supportContacts?: string;
  };
  mfaEnabled?: boolean;
  mfaCode?: string;
  accessibilityPrefs?: {
    fontScale: number; // e.g., 1 for baseline, 0.9, 1.1, 1.2
    highContrast: boolean;
    reduceMotion: boolean;
    lowDataMode?: boolean;
  };
  sessionNotes?: SessionNote[];
  sessionPrice?: number;
  paymentStatus?: 'em_dia' | 'devendo';
  manualStatus?: 'ativo' | 'sem_sessao' | 'agendado' | 'ausente' | 'desistiu';
  forceProfileUpdate?: boolean;
  isTemporaryPassword?: boolean;
}

export interface SessionNote {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  text: string;
  audioUrl?: string; // local simulation or audio reference
  aiFeedback?: {
    scientificAnalysis: string; // clinical/theoretical formulation of presentation
    cognitiveBehavioralInsights: string; // cognitive behavior or psychological markers identified
    therapeuticSuggestions: string; // therapeutic recommendations, exercises, behaviors
    createdAt: string;
  };
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  patientName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  mood: string; // 'Calmo' | 'Ansioso' | 'Feliz' | 'Triste' | 'Estressado' | 'Cansado' | 'Esperançoso' ou número (1-10) em string
  text: string;

  // New detailed entries:
  moodScore?: number; // 1-10 scale
  emotions?: string[]; // e.g., ['Alegria', 'Medo', 'Raiva']
  triggers?: string[]; // e.g., ['Trabalho', 'Família']
  sleepHours?: number;
  medicationTaken?: boolean;
  sharedWithProfessional?: boolean;
}

// Alias for DiaryEntry as specified
export type DiaryEntry = JournalEntry;

export interface Appointment {
  id: string;
  userId: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: 'pending' | 'confirmed' | 'canceled' | 'cancelled' | 'rescheduled' | 'completed' | 'noshow';
  notes?: string;
  rescheduledDate?: string;
  rescheduledTime?: string;
  createdAt: string;
  googleEventId?: string;
  meetLink?: string;
  firstReminderSent?: boolean;
  secondReminderSent?: boolean;
  
  // New Specification Fields:
  modality?: 'online' | 'presencial';
  sessionNumber?: number;
  theoreticalNote?: string;
  feedbackNps?: number; // 0-10, pós-sessão
  recurrence?: {
    frequency: 'weekly' | 'biweekly';
    until?: string; // YYYY-MM-DD
  };
}

export interface AvailabilityDay {
  date: string; // YYYY-MM-DD
  slots: string[]; // ['08:00', '09:00', ...]
}

export interface ReflectiveMessage {
  id: string;
  title: string;
  text: string;
  instruction: string;
  category: string;
  imageUrl?: string;
}

export interface SystemNotification {
  id: string;
  timestamp: string;
  type: 'telegram' | 'email' | 'system';
  recipient: string;
  message: string;
}

export interface EducationalContent {
  id: string;
  title: string;
  category: string; // e.g., 'Ansiedade', 'Sono', 'Relacionamentos'
  type: 'article' | 'video' | 'podcast';
  duration: string; // e.g., '5 min', '20 min'
  summary: string;
  url: string; // clickable link
  createdAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string; // e.g., 'welcome', 'first_reminder', 'second_reminder', 'followup_nps'
  subject: string;
  body: string; // HTML supports standard placeholders like {{patient_name}}, {{meet_link}}, etc.
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actor?: string; // e.g., email or 'system' or user id
  operatorId?: string;
  action: string; // e.g., 'VISUALIZAR_DIARIO', 'EXPORTAR_DADOS', 'ANONIMIZAR'
  target?: string; // name or user id affected
  patientId?: string | null;
  payloadHash?: string; // sha256 hash or simple description for GDPR audits
  timestamp: string;
  details?: string;
}
