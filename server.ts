import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import bcrypt from "bcryptjs";
import { 
  User, 
  JournalEntry, 
  Appointment, 
  AvailabilityDay, 
  ReflectiveMessage, 
  SystemNotification,
  AuditLog,
  EducationalContent,
  EmailTemplate
} from "./src/types";

// Setup
const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "database.json");

app.use(express.json());

// AES-256-GCM Symetric Encryption key from string for LGPD compliance in repouso
const ENCRYPTION_KEY = Buffer.alloc(32, "elieyd_secure_gcm_passphrase_32_chars_long");

function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");
    return `${iv.toString("hex")}:${tag}:${encrypted}`;
  } catch (err) {
    console.error("Erro ao criptografar:", err);
    return text; // Fallback
  }
}

function decrypt(encryptedText: string): string {
  try {
    if (!encryptedText || !encryptedText.includes(":")) {
      return encryptedText || ""; // was not encrypted or legacy
    }
    const parts = encryptedText.split(":");
    if (parts.length !== 3) return encryptedText;
    const iv = Buffer.from(parts[0], "hex");
    const tag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    return encryptedText;
  }
}

// Upgraded bcrypt password hashing with legacy check
function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

function verifyPassword(password: string, hash: string): boolean {
  if (hash.length === 64 && !hash.startsWith("$2a$") && !hash.startsWith("$2b$")) {
    const legacyHash = crypto.createHash("sha256").update(password + "elieyd_salt_key").digest("hex");
    return legacyHash === hash;
  }
  try {
    return bcrypt.compareSync(password, hash);
  } catch (err) {
    return false;
  }
}

// Dynamic configuration helper (prioritizes database config, falls back to process.env)
function getConfigValue(key: string): string {
  if (typeof db !== "undefined" && db && db.config && db.config[key] !== undefined) {
    return db.config[key];
  }
  return process.env[key] || "";
}

// Lazy-loaded Gemini AI client
let aiInstance: GoogleGenAI | null = null;
let currentApiKey: string | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getConfigValue("GEMINI_API_KEY");
  if (apiKey) {
    if (!aiInstance || currentApiKey !== apiKey) {
      aiInstance = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      currentApiKey = apiKey;
    }
  } else {
    // If key cleared
    aiInstance = null;
    currentApiKey = null;
  }
  return aiInstance;
}

// Database state
interface DBState {
  users: User[];
  passwords: Record<string, string>; // userId -> passwordHash
  diary: JournalEntry[];
  appointments: Appointment[];
  availabilities: AvailabilityDay[];
  reflections: ReflectiveMessage[];
  notifications: SystemNotification[];
  config?: Record<string, string>;
  auditLogs?: AuditLog[];
  educationalContents?: EducationalContent[];
  emailTemplates?: EmailTemplate[];
}

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Generate future dates in format YYYY-MM-DD
function getFutureDateString(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Seed Availabilities dynamically based on current date
const SEED_SLOTS = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];

const DEFAULT_REFLECTIONS: ReflectiveMessage[] = [
  {
    id: "ref-1",
    title: "O Respiro no Caos",
    text: "Em momentos de estresse, tendemos a respirar de forma superficial, sinalizando perigo para o corpo. Dedique os próximos minutos para expandir seu pulmão de forma consciente. Sinta o ar entrando e saindo. Você está no controle do agora.",
    instruction: "Prática: Faça 5 respirações lentas e profundas. Inspire em 4 segundos, segure por 4 e expire lentamente em 6 segundos.",
    category: "Mindfulness",
    imageUrl: "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "ref-2",
    title: "Acolhendo suas Emoções",
    text: "Toda emoção tem uma função. Em vez de resistir à tristeza ou ansiedade, trate-as como visitas temporárias que trazem uma mensagem. Resistir apenas prolonga o sofrimento; acolher abre espaço para a regulação.",
    instruction: "Prática: Escreva no diário o nome da emoção que você sente agora e onde você a percebe fisicamente (ex: nó na garganta, peso nos ombros).",
    category: "Autoaceitação",
    imageUrl: "https://images.unsplash.com/photo-1515003197213-e4cd08592c6c?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "ref-3",
    title: "O Poder dos Micro-Passos",
    text: "Mudanças profundas não acontecem do dia para a noite. Elas são a soma de pequenas escolhas diárias consistentes. Se a montanha parece alta demais para escalar hoje, o que você consegue fazer em apenas 5 minutos?",
    instruction: "Prática: Escolha uma tarefa pendente que está te gerando ansiedade e dedique exatamente 5 minutos focados nela agora.",
    category: "Resiliência",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "ref-4",
    title: "Praticando a Autocompaixão",
    text: "Como você falaria com um amigo de infância que estivesse passando por essa situação difícil? Certamente com gentileza e carinho. Por que, então, julgamos a nós mesmos com tanta dureza? Seja gentil consigo hoje.",
    instruction: "Prática: Olhe-se no espelho de forma suave ou abrace a si mesmo e repita: 'Eu fiz o melhor que pude, e tudo bem.'",
    category: "Autocompaixão",
    imageUrl: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=600&q=80"
  }
];

const DEFAULT_EDUCATIONAL_CONTENT: EducationalContent[] = [
  {
    id: "edu-1",
    title: "Entendendo a Ansiedade: Guia do Ministério da Saúde",
    category: "Ansiedade",
    type: "article",
    duration: "5 min",
    summary: "Uma explicação oficial e neurocientífica de como a ansiedade atua no nosso corpo, suas causas, sintomas corporais e tratamentos.",
    url: "https://www.gov.br/saude/pt-br/assuntos/saude-de-a-z/a/ansiedade",
    createdAt: new Date().toISOString()
  },
  {
    id: "edu-2",
    title: "Mindfulness para Iniciantes: Guia de Exercícios e Prática",
    category: "Mindfulness",
    type: "podcast",
    duration: "10 min",
    summary: "Aprenda a acalmar a mente e focar no momento presente com este guia de exercícios práticos validados do portal UOL VivaBem.",
    url: "https://www.uol.com.br/vivabem/faq/mindfulness-o-que-e-para-que-serve-e-exercicios-para-iniciantes.htm",
    createdAt: new Date().toISOString()
  },
  {
    id: "edu-3",
    title: "Higiene do Sono: Como Dormir Melhor Naturalmente",
    category: "Sono",
    type: "video",
    duration: "12 min",
    summary: "Orientações oficiais do Ministério da Saúde do Brasil para reestruturar seus hábitos, ambiente e alimentação antes de dormir.",
    url: "https://bvsms.saude.gov.br/higiene-do-sono/",
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "tpl-welcome",
    name: "welcome",
    subject: "Seja muito bem-vindo(a) ao Consultório de Psicoterapia!",
    body: `<h2>Olá, {{patient_name}}!</h2>
<p>Seu perfil foi cadastrado com sucesso no consultório da <strong>Dra. Elieyd Barreto</strong>.</p>
<p>Dicas para a sua primeira teleconsulta:</p>
<ul>
  <li>Prepare um ambiente privado, silencioso e confortável.</li>
  <li>Use fones de ouvido para garantir seu sigilo e melhor áudio.</li>
  <li>Acesse o link do Google Meet alguns minutos antes.</li>
</ul>
<p>Sua saúde mental é nossa prioridade absoluta.</p>
<p>Atenciosamente,<br/><strong>Dra. Elieyd Barreto</strong><br/>CRP 11/XXXXX</p>`,
    updatedAt: new Date().toISOString()
  },
  {
    id: "tpl-1st-reminder",
    name: "first_reminder",
    subject: "Nossa sessão se aproxima - Lembrete Importante",
    body: `<h2>Olá, {{patient_name}}!</h2>
<p>Este é o primeiro lembrete de que sua consulta agendada está chegando.</p>
<p><strong>Detalhes:</strong> {{appointment_date}} às {{appointment_time}} (Horário de Brasília).</p>
<p><strong>Link da Teleconsulta:</strong> <a href="{{meet_link}}">{{meet_link}}</a></p>
<p><em>Parágrafo de acolhimento ético:</em> Lembro que todo o nosso atendimento está estritamente protegido pelo <strong>Código de Ética Profissional do Psicólogo</strong>, garantindo sigilo absoluto. Este é um espaço seguro e livre de julgamentos, focado no seu bem-estar e no desenvolvimento da sua saúde mental.</p>
<p>Atenciosamente,<br/><strong>Dra. Elieyd Barreto</strong><br/>CRP 11/XXXXX</p>`,
    updatedAt: new Date().toISOString()
  },
  {
    id: "tpl-2nd-reminder",
    name: "second_reminder",
    subject: "Sua consulta inicia em breve",
    body: `<h2>Olá, {{patient_name}}, falta muito pouco!</h2>
<p>Nossa consulta começa em breve.</p>
<p><strong>Link de Acesso Direto:</strong> <a href="{{meet_link}}">{{meet_link}}</a></p>
<p><strong>Observação de Sintonização complementar:</strong></p>
<blockquote style="background: #FAF8F6; border-left: 4px solid #D9B8A7; padding: 10px; margin: 10px 0;">
  {{theoretical_note}}
</blockquote>
<p>Prepare sua água, sente-se confortavelmente e respire fundo. Estou te aguardando!</p>
<p>Atenciosamente,<br/><strong>Dra. Elieyd Barreto</strong></p>`,
    updatedAt: new Date().toISOString()
  }
];

function performBackupAndRotation() {
  try {
    const backupDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    const today = getTodayString();
    const backupFile = path.join(backupDir, `database-${today}.json`);
    
    // Copy current state
    if (fs.existsSync(DB_FILE)) {
      fs.copyFileSync(DB_FILE, backupFile);
    }
    
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith("database-") && f.endsWith(".json"))
      .map(f => path.join(backupDir, f));
      
    if (files.length > 7) {
      files.sort((a, b) => {
        const statA = fs.statSync(a);
        const statB = fs.statSync(b);
        return statA.mtime.getTime() - statB.mtime.getTime();
      });
      while (files.length > 7) {
        const toDelete = files.shift();
        if (toDelete) {
          fs.unlinkSync(toDelete);
          console.log(`LGPD Backup expurgado por rotação: ${toDelete}`);
        }
      }
    }
  } catch (err) {
    console.error("Falha no backup/rotação LGPD:", err);
  }
}

function loadDatabase(): DBState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(data);
      
      // Decrypt sensitive CPF and clinicalNotes from disk representation
      if (parsed.users) {
        parsed.users = parsed.users.map((u: any) => {
          let anamneseDecrypted = u.anamnese;
          if (u.anamnese && u.anamnese._encrypted) {
            try {
              anamneseDecrypted = JSON.parse(decrypt(u.anamnese._encrypted));
            } catch (e) {
              anamneseDecrypted = u.anamnese;
            }
          }
          let sessionNotesDecrypted = u.sessionNotes;
          if (u.sessionNotes && u.sessionNotes._encrypted) {
            try {
              sessionNotesDecrypted = JSON.parse(decrypt(u.sessionNotes._encrypted));
            } catch (e) {
              sessionNotesDecrypted = u.sessionNotes;
            }
          }
          return {
            ...u,
            cpf: u.cpf ? decrypt(u.cpf) : undefined,
            clinicalNotes: u.clinicalNotes ? decrypt(u.clinicalNotes) : undefined,
            anamnese: anamneseDecrypted,
            sessionNotes: sessionNotesDecrypted || []
          };
        });
      }
      
      if (parsed.diary) {
        parsed.diary = parsed.diary.map((d: any) => {
          return {
            ...d,
            text: decrypt(d.text)
          };
        });
      }

      // Initialize defaults if missing
      if (!parsed.auditLogs) parsed.auditLogs = [];
      if (!parsed.educationalContents) parsed.educationalContents = DEFAULT_EDUCATIONAL_CONTENT;
      if (!parsed.emailTemplates) parsed.emailTemplates = DEFAULT_EMAIL_TEMPLATES;
      
      return parsed;
    }
  } catch (error) {
    console.error("Erro interpretando banco de dados, resetando...", error);
  }

  // Initial seed state
  const state: DBState = {
    users: [],
    passwords: {},
    diary: [],
    appointments: [],
    availabilities: [],
    reflections: DEFAULT_REFLECTIONS,
    notifications: [],
    auditLogs: [],
    educationalContents: DEFAULT_EDUCATIONAL_CONTENT,
    emailTemplates: DEFAULT_EMAIL_TEMPLATES
  };

  // Pre-seed an Admin account for Elieyd Barreto
  const adminId = "admin-1";
  state.users.push({
    id: adminId,
    name: "Elieyd Barreto",
    email: "admin@elieyd.com.br",
    phone: "(85) 99999-9999",
    role: "admin",
    createdAt: new Date().toISOString(),
    authorizedForDiary: true
  });
  state.passwords[adminId] = hashPassword("elieyd123");

  // Pre-seed dynamic availabilities for next 14 days
  for (let i = 1; i <= 14; i++) {
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + i);
    if (testDate.getDay() !== 0) {
      const year = testDate.getFullYear();
      const month = String(testDate.getMonth() + 1).padStart(2, "0");
      const day = String(testDate.getDate()).padStart(2, "0");
      state.availabilities.push({
        date: `${year}-${month}-${day}`,
        slots: [...SEED_SLOTS]
      });
    }
  }

  // Pre-seed a patient
  const patientId = "patient-1";
  state.users.push({
    id: patientId,
    name: "Paciente de Teste",
    email: "paciente@teste.com",
    phone: "(85) 98888-8888",
    role: "patient",
    createdAt: new Date().toISOString(),
    authorizedForDiary: true
  });
  state.passwords[patientId] = hashPassword("senha123");

  // Pre-seed a journal entry for the patient
  state.diary.push({
    id: "journal-1",
    userId: patientId,
    patientName: "Paciente de Teste",
    date: getTodayString(),
    time: "10:30",
    mood: "Ansioso",
    text: "Hoje acordei com um aperto no peito pensando nas reuniões do trabalho. Mas fiz a respiração guiada e sinto que ajudou a diminuir o batimento cardíaco. Vou anotar isso para conversar na sessão com a Elieyd."
  });

  // Pre-seed notifications
  state.notifications.push({
    id: `notif-${Date.now()}-seed`,
    timestamp: new Date().toISOString(),
    type: "system",
    recipient: "Elieyd Barreto",
    message: "Sistema inicializado com sucesso. Contas de Elieyd e Paciente de Teste pré-cadastradas para validação rápida."
  });

  saveDatabase(state);
  return state;
}

function saveDatabase(state: DBState) {
  try {
    const cloned: DBState = JSON.parse(JSON.stringify(state));
    if (cloned.users) {
      cloned.users = cloned.users.map((u: any) => ({
        ...u,
        cpf: u.cpf ? encrypt(u.cpf) : undefined,
        clinicalNotes: u.clinicalNotes ? encrypt(u.clinicalNotes) : undefined,
        anamnese: u.anamnese ? { _encrypted: encrypt(JSON.stringify(u.anamnese)) } : undefined,
        sessionNotes: u.sessionNotes ? { _encrypted: encrypt(JSON.stringify(u.sessionNotes)) } : undefined
      }));
    }
    if (cloned.diary) {
      cloned.diary = cloned.diary.map((d: any) => ({
        ...d,
        text: d.text ? encrypt(d.text) : ""
      }));
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(cloned, null, 2), "utf-8");
    performBackupAndRotation();
  } catch (err) {
    console.error("Erro ao salvar base de dados:", err);
  }
}

const db = loadDatabase();

// Notification helpers (Telegram & Email)
async function triggerTelegramNotification(message: string) {
  const token = getConfigValue("TELEGRAM_BOT_TOKEN");
  const chatId = getConfigValue("TELEGRAM_CHAT_ID");

  const notification: SystemNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    type: "telegram",
    recipient: chatId || "Canais de Teste (não configurado)",
    message
  };

  db.notifications.unshift(notification);
  saveDatabase(db);

  if (token && chatId) {
    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🔔 *Elieyd Barreto Psicologia*\n\n${message}`,
          parse_mode: "Markdown"
        })
      });
      console.log("Telegram notification sent successfully.");
    } catch (err) {
      console.error("Falha ao enviar notificação Telegram:", err);
    }
  } else {
    console.log(`[Simulação Telegram] Mensagem: "${message}"`);
  }
}

async function triggerEmailNotification(toEmail: string, subject: string, htmlContent: string) {
  const notification: SystemNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    type: "email",
    recipient: toEmail,
    message: `[Assunto: ${subject}] ${htmlContent.replace(/<[^>]*>/g, "").substring(0, 150)}...`
  };

  db.notifications.unshift(notification);
  saveDatabase(db);

  const smtpHost = getConfigValue("SMTP_HOST");
  const smtpPortStr = getConfigValue("SMTP_PORT");
  const smtpPort = smtpPortStr ? parseInt(smtpPortStr, 10) : 587;
  const smtpUser = getConfigValue("SMTP_USER");
  const smtpPass = getConfigValue("SMTP_PASS");
  const smtpFrom = getConfigValue("SMTP_FROM") || smtpUser || "contato@elieydbarreto.com.br";

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for port 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      await transporter.sendMail({
        from: `"${smtpFrom === smtpUser ? "Elieyd Barreto Psicologia" : smtpFrom}" <${smtpFrom}>`,
        to: toEmail,
        subject: subject,
        html: htmlContent
      });

      console.log(`E-mail real enviado com sucesso para ${toEmail} via SMTP.`);
    } catch (err) {
      console.error("Falha ao enviar e-mail real via SMTP, usando fallback de simulação:", err);
      console.log(`[Simulação de E-mail enviado para ${toEmail}]`);
      console.log(`Assunto: ${subject}`);
      console.log(`Mensagem: ${htmlContent.substring(0, 200)}...`);
    }
  } else {
    console.log(`[Simulação de E-mail enviado para ${toEmail}] (Configuração SMTP ausente)`);
    console.log(`Assunto: ${subject}`);
    console.log(`Mensagem: ${htmlContent.substring(0, 200)}...`);
  }
}

function generateStaticPix(key: string, amount: number, name: string, city: string, txid: string = "***"): string {
  let cleanedKey = key.trim();
  if (cleanedKey.includes("@")) {
    // Email - keep as is
  } else if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanedKey)) {
    // Random Key UUID - keep as is
  } else {
    const digits = cleanedKey.replace(/\D/g, "");
    if (digits.length === 11 && (cleanedKey.includes(".") || cleanedKey.includes("-"))) {
      cleanedKey = digits;
    } else if (digits.length === 14 && (cleanedKey.includes(".") || cleanedKey.includes("/") || cleanedKey.includes("-"))) {
      cleanedKey = digits;
    } else if (digits.length >= 10 && digits.length <= 11) {
      cleanedKey = `+55${digits}`;
    } else {
      cleanedKey = digits || cleanedKey;
    }
  }

  const cleanString = (str: string, maxLength: number) => {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .toUpperCase()
      .substring(0, maxLength)
      .trim();
  };

  const cleanName = cleanString(name || "Dra Elieyd Barreto", 25);
  const cleanCity = cleanString(city || "Sao Paulo", 15);

  const pad = (num: number) => String(num).padStart(2, "0");

  const tag00 = "000201";
  const tag01 = "010212";

  const gui = "0014br.gov.bcb.pix";
  const subkey = `01${pad(cleanedKey.length)}${cleanedKey}`;
  const tag26Content = gui + subkey;
  const tag26 = `26${pad(tag26Content.length)}${tag26Content}`;

  const tag52 = "52040000";
  const tag53 = "5303986";

  const formattedAmount = Number(amount).toFixed(2);
  const tag54 = `54${pad(formattedAmount.length)}${formattedAmount}`;

  const tag58 = "5802BR";
  const tag59 = `59${pad(cleanName.length)}${cleanName}`;
  const tag60 = `60${pad(cleanCity.length)}${cleanCity}`;

  const cleanTxid = cleanString(txid || "***", 25) || "***";
  const subtxid = `05${pad(cleanTxid.length)}${cleanTxid}`;
  const tag62 = `62${pad(subtxid.length)}${subtxid}`;

  const payloadWithoutCRC = tag00 + tag01 + tag26 + tag52 + tag53 + tag54 + tag58 + tag59 + tag60 + tag62 + "6304";
  const crc = crc16ccitt(payloadWithoutCRC);
  
  return payloadWithoutCRC + crc;
}

function crc16ccitt(str: string): string {
  let crc = 0xFFFF;
  const polynomial = 0x1021;

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    crc ^= (code << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

async function sendBillingEmailHelper(apptId: string): Promise<{ success: boolean; message: string; value: number }> {
  const appt = db.appointments.find(a => a.id === apptId);
  if (!appt) {
    throw new Error("Agendamento não localizado para cobrança.");
  }

  const patient = db.users.find(u => u.id === appt.userId);
  const sessionValue = patient && patient.sessionPrice !== undefined ? patient.sessionPrice : 150;

  const pixKey = getConfigValue("PIX_KEY") || "014.225.889-00";
  const pixName = getConfigValue("PIX_BENEFICIARY_NAME") || "Elieyd Barreto";
  const pixCity = getConfigValue("PIX_CITY") || "Sao Paulo";

  const rawTxid = `REC${appt.id.replace(/\W/g, "").toUpperCase()}`;
  const txid = rawTxid.substring(0, 25);
  
  const pixPayload = generateStaticPix(pixKey, sessionValue, pixName, pixCity, txid);

  const appUrl = process.env.APP_URL || getConfigValue("APP_URL") || "http://localhost:3000";
  const checkoutUrl = `${appUrl}/?pay=${appt.id}`;

  const subject = `Cobrança Digital: Sessão de Psicoterapia - Dra. Elieyd Barreto`;
  const formattedDate = new Date(appt.date + "T00:00:00").toLocaleDateString('pt-BR');
  
  const mailContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 16px rgba(47,71,56,0.08);">
      <div style="background-color: #2F4738; padding: 32px 24px; text-align: center; color: white;">
        <h2 style="margin: 0; font-family: sans-serif; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">Dra. Elieyd Barreto</h2>
        <p style="margin: 6px 0 0 0; font-size: 11px; opacity: 0.85; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500;">Psicoterapia & Formulações Clínicas Avançadas</p>
      </div>
      <div style="padding: 32px 28px; color: #334155; font-size: 14.5px; line-height: 1.6; background-color: #ffffff;">
        <p>Olá, <strong>${appt.patientName}</strong>,</p>
        <p>Espero que este contato lhe encontre bem.</p>
        <p>Seguem detalhados os dados para emissão e quitação de honorários clínicos referentes ao seu último atendimento psicoterápico:</p>
        
        <div style="background-color: #FAF8F6; border-radius: 16px; border: 1px solid #E9D2C4; padding: 20px; margin: 24px 0; text-align: center;">
          <span style="font-size: 10px; color: #556B5D; text-transform: uppercase; font-weight: bold; letter-spacing: 1.2px;">Consulta Clínico-Terapêutica</span>
          <h3 style="margin: 8px 0; font-size: 28px; color: #2F4738; font-weight: bold;">R$ ${Number(sessionValue).toFixed(2)}</h3>
          <p style="margin: 0; font-size: 12.5px; color: #64748b; font-family: monospace;">📅 Realizada em: ${formattedDate} às ${appt.time}h</p>
        </div>

        <div style="margin: 28px 0; text-align: center;">
          <p style="font-weight: bold; color: #2F4738; font-size: 13.5px; margin-bottom: 12px; text-transform: uppercase; font-family: monospace; tracking-wide">Opção 1: Escanear Pix QR Code</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&color=2e4738&data=${encodeURIComponent(pixPayload)}" alt="Pix QR Code" style="border: 4px solid #FAF8F6; border-radius: 16px; display: inline-block; box-shadow: 0 4px 8px rgba(0,0,0,0.02);" />
          
          <div style="margin-top: 16px; text-align: left;">
            <p style="font-size: 11px; color: #556B5D; margin-bottom: 4px; font-family: sans-serif;">Chave Pix: <strong>${pixKey}</strong> • Beneficiário: <strong>${pixName}</strong></p>
            <label style="font-size: 11px; font-weight: bold; color: #556B5D; font-family: monospace; display: block; margin-bottom: 6px;">Código Copia e Cola:</label>
            <textarea readonly style="width: 100%; height: 60px; font-family: monospace; font-size: 10px; border: 1px solid #e2e8f5; border-radius: 10px; padding: 8px; background-color: #f8fafc; resize: none; text-align: left; outline: none; box-sizing: border-box; color: #334155;">${pixPayload}</textarea>
          </div>
        </div>

        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;" />

        <div style="text-align: center; margin: 24px 0;">
          <p style="font-weight: bold; color: #2F4738; font-size: 13.5px; margin-bottom: 4px;">Opção 2: Cartão de Crédito</p>
          <p style="font-size: 12.5px; color: #64748b; margin-top: 0; margin-bottom: 16px;">Para efetuar o pagamento via cartão de crédito em ambiente blindado ou emitir recibo oficial, utilize nosso link:</p>
          <a href="${checkoutUrl}" target="_blank" style="background-color: #2F4738; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 30px; font-weight: bold; font-family: sans-serif; font-size: 13.5px; display: inline-block; box-shadow: 0 4px 12px rgba(47,71,56,0.2); transition: all 0.2s;">💳 Pagar da Forma que Preferir</a>
        </div>

        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 36px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          Esta cobrança é direcionada eletronicamente. Suas informações são protegidas sob a Lei Geral de Proteção de Dados (LGPD).<br/>
          <strong>Dra. Elieyd Barreto</strong> • CRP 11/XXXXX • Psicóloga Clínico-Jurídica
        </p>
      </div>
    </div>
  `;

  await triggerEmailNotification(appt.patientEmail, subject, mailContent);

  if (!appt.notes || !appt.notes.includes("Cobrança emitida")) {
    appt.notes = appt.notes ? appt.notes + " (Cobrança emitida por e-mail)" : "Cobrança de sessão transmitida ao e-mail.";
  }
  (appt as any).paymentSentAt = new Date().toISOString();
  (appt as any).paymentSentValue = sessionValue;
  (appt as any).paymentLinkSent = true;
  if ((appt as any).paymentStatus !== "pago") {
    (appt as any).paymentStatus = "pendente";
  }

  saveDatabase(db);
  addAuditLog("admin@elieyd.com.br", "EMITIR_COBRANCA_EMAIL", appt.userId, `Envio de e-mail de cobrança de R$ ${sessionValue} referente ao atendimento de ${appt.date}`);

  return { success: true, message: "Aviso de cobrança gerado e encaminhado com sucesso por e-mail!", value: sessionValue };
}

// --- GOOGLE CALENDAR & TESTING UTILITIES ---

async function getGoogleCalendarAccessToken(): Promise<string | null> {
  if (!db.config) return null;
  const accessToken = db.config.google_access_token;
  const refreshToken = db.config.google_refresh_token;
  const expiry = db.config.google_token_expiry ? parseInt(db.config.google_token_expiry, 10) : 0;

  if (!accessToken || !refreshToken) return null;

  // Let's refresh if expired or within 5 minutes of expiring
  if (Date.now() + 300000 >= expiry) {
    console.log("Renovando token do Google Calendar...");
    const clientId = db.config.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = db.config.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";

    if (!clientId || !clientSecret) {
      console.warn("Client ID ou Client Secret do Google ausentes da configuração. Falha ao renovar token.");
      return null;
    }

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token"
        })
      });

      const data = await tokenRes.json();
      if (data.access_token) {
        db.config.google_access_token = data.access_token;
        db.config.google_token_expiry = String(Date.now() + data.expires_in * 1000);
        saveDatabase(db);
        console.log("Token OAuth do Google Calendar renovado com sucesso.");
        return data.access_token;
      } else {
        console.error("Falha ao renovar token OAuth Google:", data);
        return null;
      }
    } catch (err) {
      console.error("Erro na rede ao renovar token Google:", err);
      return null;
    }
  }

  return accessToken;
}

function getGoogleCalendarTemplateLink(dateStr: string, timeStr: string): string {
  const dateParts = dateStr.split("-");
  const timeParts = timeStr.split(":");
  if (dateParts.length === 3 && timeParts.length >= 2) {
    const year = dateParts[0];
    const month = dateParts[1];
    const day = dateParts[2];
    const hour = timeParts[0];
    const minute = timeParts[1];

    const startStr = `${year}${month}${day}T${hour}${minute}00`;

    const startObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10));
    const endObj = new Date(startObj.getTime() + 50 * 60 * 1000);

    const endYear = String(endObj.getFullYear());
    const endMonth = String(endObj.getMonth() + 1).padStart(2, "0");
    const endDay = String(endObj.getDate()).padStart(2, "0");
    const endHour = String(endObj.getHours()).padStart(2, "0");
    const endMinute = String(endObj.getMinutes()).padStart(2, "0");

    const endStr = `${endYear}${endMonth}${endDay}T${endHour}${endMinute}00`;

    const title = encodeURIComponent("Sessão de Psicoterapia - Dra. Elieyd Barreto");
    const details = encodeURIComponent("Sua sessão de psicoterapia individual com a Dra. Elieyd Barreto. Prepare um local calmo e acolhedor.");
    const ctz = "America/Sao_Paulo";
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&ctz=${ctz}`;
  }
  return "";
}

function getGoogleMeetLink(apptId: string): string {
  const hash = crypto.createHash("md5").update(apptId).digest("hex").substring(0, 10);
  const chunk1 = hash.substring(0, 3);
  const chunk2 = hash.substring(3, 7);
  const chunk3 = hash.substring(7, 10);
  return `https://meet.google.com/${chunk1}-${chunk2}-${chunk3}`;
}

async function syncAppointmentToGoogleCalendar(appt: Appointment, action: "insert" | "update" | "delete") {
  const isGoogleConfigured = db.config?.google_refresh_token;
  const meetLink = appt.meetLink || getGoogleMeetLink(appt.id);
  appt.meetLink = meetLink;

  if (!isGoogleConfigured) {
    console.log(`[Google Calendar Simulação] ${action.toUpperCase()} Consulta p/ ${appt.patientName} em ${appt.date} às ${appt.time} [Meet: ${meetLink}]`);
    return;
  }

  const token = await getGoogleCalendarAccessToken();
  if (!token) {
    console.error("Falha ao recuperar token do Google Calendar para sincronização.");
    return;
  }

  const calendarId = db.config?.GOOGLE_CALENDAR_ID || "primary";

  // Construct start/end Date Times
  // Date is YYYY-MM-DD, Time is HH:MM
  const startDateTime = `${appt.date}T${appt.time}:00`;
  
  // Appts last 50 minutes
  const [hours, minutes] = appt.time.split(":").map(Number);
  const endMin = (minutes + 50) % 60;
  const extraHour = Math.floor((minutes + 50) / 60);
  const endHour = (hours + extraHour) % 24;
  
  const endHourStr = String(endHour).padStart(2, "0");
  const endMinStr = String(endMin).padStart(2, "0");
  const endDateTime = `${appt.date}T${endHourStr}:${endMinStr}:00`;

  const statusLabel = appt.status === "confirmed" ? "Confirmada" : 
                      appt.status === "pending" ? "Pendente" : 
                      appt.status === "canceled" ? "Cancelada" : "Reagendada";

  const eventRequestBody = {
    summary: `Psicoterapia [${statusLabel}] - ${appt.patientName}`,
    description: `Consulta de Psicoterapia agendada na plataforma Dra. Elieyd Barreto Psicologia.\n\nPaciente: ${appt.patientName}\nContato: ${appt.patientPhone}\nE-mail: ${appt.patientEmail}\nStatus do Agendamento: ${statusLabel}\n\nLink do Google Meet: ${meetLink}\n\nLink Administrativo: ${getConfigValue("APP_URL") || "https://elieydbarreto.com.br"}`,
    location: meetLink,
    start: {
      dateTime: startDateTime,
      timeZone: "America/Fortaleza"
    },
    end: {
      dateTime: endDateTime,
      timeZone: "America/Fortaleza"
    }
  };

  try {
    if (action === "insert") {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(eventRequestBody)
      });
      const data = await response.json();
      if (data.id) {
        appt.googleEventId = data.id;
        console.log(`Evento de consulta inserido no Google Calendar com ID: ${data.id}`);
      } else {
        console.error("Erro do Google Calendar ao inserir evento:", data);
      }
    } else if (action === "update" && appt.googleEventId) {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${appt.googleEventId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(eventRequestBody)
      });
      const data = await response.json();
      console.log(`Evento de consulta atualizado no Google Calendar: ${appt.googleEventId}`);
    } else if (action === "delete" && appt.googleEventId) {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${appt.googleEventId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log(`Evento de consulta deletado no Google Calendar: ${appt.googleEventId}`);
      appt.googleEventId = undefined;
    }
  } catch (err) {
    console.error("Erro ao sincronizar consulta com Google Calendar:", err);
  }
}

async function testSMTPConnection() {
  const host = getConfigValue("SMTP_HOST");
  const portStr = getConfigValue("SMTP_PORT");
  const port = portStr ? parseInt(portStr, 10) : 587;
  const user = getConfigValue("SMTP_USER");
  const pass = getConfigValue("SMTP_PASS");

  if (!host || !user || !pass) {
    return { status: "missing", message: "SMTP indisponível ou incompleto do painel." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 5000
    });
    await transporter.verify();
    return { status: "success", message: "SMTP conectado e autenticado com sucesso!" };
  } catch (err: any) {
    return { status: "error", message: `Falha de conexão SMTP: ${err.message}` };
  }
}

async function testTelegramConnection() {
  const token = getConfigValue("TELEGRAM_BOT_TOKEN");
  const chatId = getConfigValue("TELEGRAM_CHAT_ID");

  if (!token || !chatId) {
    return { status: "missing", message: "Token de bot ou Chat ID ausente." };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok) {
      // Send dynamic test connection message
      const msgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🔍 *Elieyd Barreto Psicologia*\n\nTeste de saúde do ambiente: bot conectado com sucesso! 🚀`,
          parse_mode: "Markdown"
        })
      });
      const msgData = await msgRes.json();
      if (msgData.ok) {
        return { status: "success", message: `Bot @${data.result.username} conectado e mensagem de teste enviada!` };
      } else {
        return { status: "warning", message: `Bot @${data.result.username} ativo, mas falha ao entregar mensagem para Chat ID: ${msgData.description}` };
      }
    } else {
      return { status: "error", message: `Token inválido ou expirado: ${data.description}` };
    }
  } catch (err: any) {
    return { status: "error", message: `Erro de rede Telegram webhook check: ${err.message}` };
  }
}

async function testGeminiConnection() {
  const client = getGeminiClient();
  if (!client) {
    return { status: "missing", message: "GEMINI_API_KEY ausente ou em branco." };
  }

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Diga 'Ativo' em uma palavra."
    });
    if (response && response.text) {
      return { status: "success", message: `Gemini conectado e respondendo: "${response.text.trim()}"` };
    }
    return { status: "warning", message: "Conectado à API, mas resposta vazia." };
  } catch (err: any) {
    return { status: "error", message: `Erro da API Gemini: ${err.message}` };
  }
}

async function testGoogleCalendarConnection() {
  const isGoogleConfigured = db.config?.google_refresh_token;
  if (!isGoogleConfigured) {
    return { status: "missing", message: "Conta do Google Agenda não está conectada." };
  }

  const token = await getGoogleCalendarAccessToken();
  if (!token) {
    return { status: "error", message: "Refresh token inválido, favor re-vincular a sua conta Google." };
  }

  const calendarId = db.config?.GOOGLE_CALENDAR_ID || "primary";

  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.id) {
      return { status: "success", message: `Conectado com sucesso! Sincronizando com a agenda "${data.summary || data.id}".` };
    }
    return { status: "error", message: `Google Calendar retornou erro: ${data.error?.message || "Detalhes indisponíveis"}` };
  } catch (err: any) {
    return { status: "error", message: `Erro de rede Google API: ${err.message}` };
  }
}

// REST API Endpoints

// 1. Auth & Registry
app.post("/api/auth/register", async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !phone || !password) {
    return res.status(400).json({ error: "Favor preencher todos os campos obrigatórios." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const exists = db.users.find((u) => u.email.toLowerCase().trim() === normalizedEmail);
  if (exists) {
    return res.status(400).json({ error: "Este endereço de e-mail já está cadastrado." });
  }

  const userId = `patient-${Date.now()}`;
  const newUser: User = {
    id: userId,
    name: name.trim(),
    email: normalizedEmail,
    phone: phone.trim(),
    role: "patient",
    createdAt: new Date().toISOString(),
    authorizedForDiary: true
  };

  db.users.push(newUser);
  db.passwords[userId] = hashPassword(password);
  saveDatabase(db);

  // Notify psychologist about new patient via Telegram
  await triggerTelegramNotification(
    `Novo cadastro de paciente!\n\n*Nome:* ${newUser.name}\n*E-mail:* ${newUser.email}\n*Telefone:* ${newUser.phone}\n*Cadastrado em:* ${new Date().toLocaleDateString("pt-BR")}`
  );

  res.status(201).json({ user: newUser });
});

// Verifica se um e-mail vindo do Google já está cadastrado
app.post("/api/auth/google-check", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "E-mail do Google é obrigatório." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = db.users.find((u) => u.email.toLowerCase().trim() === normalizedEmail);

  if (user) {
    return res.json({ exists: true, user });
  }

  return res.json({ exists: false });
});

// Registra um paciente autenticado via Google (pede apenas o telefone no fluxo final)
app.post("/api/auth/google-register", async (req, res) => {
  const { name, email, phone } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: "Favor preencher todos os dados para finalizar." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const exists = db.users.find((u) => u.email.toLowerCase().trim() === normalizedEmail);
  if (exists) {
    return res.status(400).json({ error: "Este endereço de e-mail já está cadastrado." });
  }

  const userId = `patient-google-${Date.now()}`;
  const newUser: User = {
    id: userId,
    name: name.trim(),
    email: normalizedEmail,
    phone: phone.trim(),
    role: "patient",
    createdAt: new Date().toISOString(),
    authorizedForDiary: true
  };

  db.users.push(newUser);
  // Gera uma senha aleatória segura para que não possa ser acessada via login padrão sem redefinir
  db.passwords[userId] = hashPassword(crypto.randomUUID());
  saveDatabase(db);

  // Envia notificação por Telegram sobre a nova conta criada com o Google
  await triggerTelegramNotification(
    `Novo paciente cadastrado via Google! 🎉\n\n*Nome:* ${newUser.name}\n*E-mail:* ${newUser.email}\n*Telefone:* ${newUser.phone}\n*Origem:* Google Auth\n*Data:* ${new Date().toLocaleDateString("pt-BR")}`
  );

  res.status(201).json({ user: newUser });
});

// Retorna se as credenciais de autenticação Google estão configuradas
app.get("/api/auth/google/status", (req, res) => {
  const clientId = db.config?.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = db.config?.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  res.json({ configured: !!(clientId && clientSecret) });
});

// Gera a URL de login do Google para pacientes
app.get("/api/auth/google/auth-url", (req, res) => {
  const clientId = db.config?.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(400).json({ error: "GOOGLE_CLIENT_ID não configurado." });
  }
  const hostUrl = getConfigValue("APP_URL") || `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${hostUrl}/api/auth/google/callback`;
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email"
  ].join(" ");

  const url = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    prompt: "select_account"
  }).toString();

  res.json({ url });
});

// Endpoint de Callback de redirecionamento para o fluxo do paciente Google
app.get("/api/auth/google/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; color: #721c24; background-color: #f8d7da;">
          <h2>Erro na Autenticação Google</h2>
          <p>${error}</p>
          <button onclick="window.close()" style="padding: 10px 20px; background-color: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">Fechar Aba</button>
        </body>
      </html>
    `);
  }
  if (!code) {
    return res.status(400).send("Código não recebido.");
  }

  const clientId = db.config?.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = db.config?.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(400).send("Configuração Google (Client ID / Client Secret) ausente.");
  }

  const hostUrl = getConfigValue("APP_URL") || `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${hostUrl}/api/auth/google/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    if (!tokenRes.ok) {
      const errTxt = await tokenRes.text();
      console.error("Token exchange failed:", errTxt);
      throw new Error("Falha ao obter tokens do Google.");
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token;
    if (!accessToken) {
      throw new Error("Access token não retornado.");
    }

    // Busca dados do perfil do usuário
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userInfoRes.ok) {
      throw new Error("Falha ao obter dados do perfil do Google.");
    }

    const googleProfile = await userInfoRes.json();
    const email = googleProfile.email;
    const name = googleProfile.name || googleProfile.given_name || "Usuário Google";

    if (!email) {
      throw new Error("E-mail não retornado pelo perfil do Google.");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = db.users.find((u) => u.email.toLowerCase().trim() === normalizedEmail);

    let scriptContent = "";
    if (user) {
      scriptContent = `
        window.opener.postMessage({ 
          type: 'GOOGLE_SIGNIN_SUCCESS', 
          user: ${JSON.stringify(user)} 
        }, '*');
      `;
    } else {
      scriptContent = `
        window.opener.postMessage({ 
          type: 'GOOGLE_SIGNIN_NEW_USER', 
          googleUser: { name: ${JSON.stringify(name)}, email: ${JSON.stringify(normalizedEmail)} } 
        }, '*');
      `;
    }

    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; background-color: #f7f2ee; color: #2f4738;">
          <h2 style="font-weight: 600;">Autenticação Concluída</h2>
          <p>Sua conta Google foi autenticada com sucesso.</p>
          <p style="font-size: 13px; color: #8a8a8a;">Esta janela será fechada automaticamente em instantes.</p>
          <script>
            if (window.opener) {
              ${scriptContent}
              window.close();
            } else {
              window.location.href = "/";
            }
          </script>
        </body>
      </html>
    `);

  } catch (err: any) {
    console.error("Google login callback error:", err);
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; color: #721c24; background-color: #f8d7da;">
          <h2>Erro na Autenticação</h2>
          <p>${err.message || "Erro desconhecido."}</p>
          <button onclick="window.close()" style="padding: 10px 20px; background-color: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">Fechar Aba</button>
        </body>
      </html>
    `);
  }
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são requeridos." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = db.users.find((u) => u.email.toLowerCase().trim() === normalizedEmail);
  if (!user) {
    return res.status(401).json({ error: "Credenciais incorretas." });
  }

  const correctHash = db.passwords[user.id];

  if (!correctHash || !verifyPassword(password, correctHash)) {
    return res.status(401).json({ error: "Credenciais incorretas." });
  }

  res.json({ user });
});

// 2. Patient List (Admin Private)
app.get("/api/patients", (req, res) => {
  // Filters out the admin user from patients view
  const patients = db.users.filter((u) => u.role !== "admin");
  res.json(patients);
});

app.post("/api/patients/:id/diary-authorization", (req, res) => {
  const { id } = req.params;
  const { authorized } = req.body;

  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: "Paciente não localizado." });
  }

  user.authorizedForDiary = !!authorized;
  saveDatabase(db);
  res.json({ message: "Autorização de visualização atualizada.", user });
});

app.post("/api/patients/:id", (req, res) => {
  const { id } = req.params;
  const { name, phone, gender, sessionType, discoverySource, clinicalNotes, sessionPrice, paymentStatus, manualStatus } = req.body;

  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: "Paciente não localizado." });
  }

  if (name !== undefined) user.name = String(name).trim();
  if (phone !== undefined) user.phone = String(phone).trim();
  if (gender !== undefined) user.gender = String(gender).trim();
  if (sessionType !== undefined) user.sessionType = sessionType;
  if (discoverySource !== undefined) user.discoverySource = String(discoverySource).trim();
  if (clinicalNotes !== undefined) user.clinicalNotes = String(clinicalNotes).trim();
  
  if (sessionPrice !== undefined) user.sessionPrice = Number(sessionPrice) || 0;
  if (paymentStatus !== undefined) user.paymentStatus = paymentStatus;
  if (manualStatus !== undefined) user.manualStatus = manualStatus;

  saveDatabase(db);
  res.json({ message: "Cadastro do paciente atualizado com sucesso.", user });
});

// 2b. Professional Psychologist Session Notes & Gemini AI Analysis Endpoints
app.post("/api/patients/:id/transcribe-audio", async (req, res) => {
  const { id } = req.params;
  const { audioBase64, mimeType } = req.body;

  if (!audioBase64) {
    return res.status(400).json({ error: "Dados de áudio não fornecidos em formato base64." });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      transcription: "Erro de Configuração: Por favor, configure sua GEMINI_API_KEY no menu 'Variáveis' antes de prosseguir com a transcrição por áudio."
    });
  }

  try {
    const audioPart = {
      inlineData: {
        data: audioBase64,
        mimeType: mimeType || "audio/webm"
      }
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          audioPart,
          {
            text: "Você é um transcritor de áudio de alta precisão que atua como assistente ético de uma psicóloga. Transcreva integralmente o conteúdo deste áudio de sessão terapêutica ou notas clínicas da profissional em português do Brasil. Purifique o texto eliminando preenchimentos de fala inadequados como 'hum', 'eh', 'né', 'tipo', gagueiras e vícios de linguagem. Organize o resultado com pontuação correta e parágrafos estruturados para fins de prontuário, assegurando integridade e fidelidade aos fatos expressados."
          }
        ]
      }
    });

    res.json({
      transcription: response.text || "Transcrição vazia ou não processável."
    });
  } catch (err: any) {
    console.error("Erro na transcrição de áudio Gemini:", err);
    res.status(500).json({ error: "Falha na transcrição inteligente do áudio: " + err.message });
  }
});

app.post("/api/patients/:id/session-notes", async (req, res) => {
  const { id } = req.params;
  const { text, date, time } = req.body;

  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: "Paciente não localizado." });
  }

  if (!user.sessionNotes) {
    user.sessionNotes = [];
  }

  const ai = getGeminiClient();
  let aiFeedback = null;

  if (ai) {
    try {
      // Build a chronological summary of previous notes to feed to Gemini
      const previousNotes = user.sessionNotes || [];
      const historySummary = previousNotes.length > 0
        ? previousNotes.map((note: any, idx: number) => `Atendimento ${idx + 1} (${note.date}):\n- Anotação clínica: "${note.text}"\n- Síntese IA da época: "${note.aiFeedback?.scientificAnalysis || "Sem síntese registrada"}"`).join("\n\n")
        : "Nenhuma sessão clínica registrada anteriormente.";

      const prompt = `Aja como um Supervisor Clínico e Assistente Psicoterapêutico de elite, amparando de forma estritamente confidencial o trabalho da psicóloga Dra. Elieyd Barreto para o paciente ${user.name}.

Sua missão é realizar uma análise longitudinal cuidadosa do histórico do paciente, correlacionando o último relato clínico com as sessões anteriores para diagnosticar evoluções, padrões repetitivos, retrocessos ou novas barreiras psicológicas.

--- HISTÓRICO DAS CONSULTAS ANTERIORES DO PACIENTE ---
${historySummary}
------------------------------------------------------

--- ANOTAÇÕES CLÍNICAS DO ATENDIMENTO ATUAL ---
${text}
-----------------------------------------------

Sua tarefa é fornecer uma formulação teórica de alto nível e hipóteses com métodos psicológicos práticos para amparar a psicóloga no seu raciocínio clínico profissional baseado tanto na sessão atual quanto na evolução longitudinal temporal do histórico clínico.
O retorno deve ser estritamente formatado em JSON válido em português do Brasil, contendo unicamente as chaves exatas descritas abaixo:
{
  "scientificAnalysis": "Uma análise clínico-científica pautada em teorias psicológicas adequadas. Descreva sinteticamente a evolução do caso, o estado afetivo, defesas, dinâmicas intrapessoais e se houve progresso, estagnação ou recaída em relação às sessões anteriores.",
  "cognitiveBehavioralInsights": "Identificação de processos cognitivos e comportamentais contínuos. Destaque distorções cognitivas recorrentes (ex: catastrofização, pensamento tudo-ou-nada), crenças intermediárias/nucleares arraigadas reativadas, e o progresso da reestruturação com o passar do tempo.",
  "therapeuticSuggestions": "Recomendações técnicas detalhadas e novos planos de intervenção terapêutica adaptados para as próximas sessões, consolidando ou ajustando as tarefas das sessões passadas de forma evolutiva e pedagógica."
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const textOutput = response.text || "{}";
      const cleanedOutput = textOutput.trim().substring(textOutput.indexOf("{"), textOutput.lastIndexOf("}") + 1);
      const parsed = JSON.parse(cleanedOutput);

      aiFeedback = {
        scientificAnalysis: parsed.scientificAnalysis || "Não foi possível formular a análise clínica teórica no momento.",
        cognitiveBehavioralInsights: parsed.cognitiveBehavioralInsights || "Nenhuma hipótese cognitiva marcante foi inferida.",
        therapeuticSuggestions: parsed.therapeuticSuggestions || "Acompanhamento geral regular e escuta qualificada contínua.",
        createdAt: new Date().toISOString()
      };
    } catch (e: any) {
      console.error("Erro analisando anotação de prontuário com Gemini:", e);
    }
  }

  if (!aiFeedback) {
    aiFeedback = {
      scientificAnalysis: "Anotação gravada com sucesso no histórico. Para habilitar formulações clínicas e insights científicos retrospectivos gerados pela IA de forma segura, ative sua Chave do Gemini nas Configurações.",
      cognitiveBehavioralInsights: "Identificação de dinâmicas latentes suspensa.",
      therapeuticSuggestions: "Incentive o paciente na continuidade do diário de sentimentos estruturado e monitoramento de distorções preventivas.",
      createdAt: new Date().toISOString()
    };
  }

  const newNote = {
    id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    date: date || getTodayString(),
    time: time || "14:00",
    text,
    aiFeedback,
    createdAt: new Date().toISOString()
  };

  user.sessionNotes.push(newNote);

  // Hook de Finalização Automática de Sessão via Evolução Clínica
  const noteTargetDate = date || getTodayString();
  const matchedAppt = db.appointments.find((a) => 
    a.userId === id && 
    a.date === noteTargetDate && 
    (a.status === "confirmed" || a.status === "rescheduled" || a.status === "pending")
  );

  if (matchedAppt) {
    matchedAppt.status = "completed";
    await syncAppointmentToGoogleCalendar(matchedAppt, matchedAppt.googleEventId ? "update" : "insert");
    try {
      await sendBillingEmailHelper(matchedAppt.id);
    } catch (billingErr) {
      console.error("Falha ao disparar cobrança automática no registro de evolução clínica:", billingErr);
    }
  }

  saveDatabase(db);

  res.status(201).json({
    message: "Anotação de sessão registrada e analisada com sucesso.",
    note: newNote,
    user
  });
});

// 3. Journal Endpoints
app.get("/api/diary", (req, res) => {
  const { userId, requesterId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "O parâmetro userId é requerido." });
  }

  // Validate permission
  const targetUser = db.users.find((u) => u.id === userId);
  if (!targetUser) {
    return res.status(404).json({ error: "Paciente de destino não encontrado." });
  }

  // If therapist is requesting
  if (requesterId && requesterId !== userId) {
    const requester = db.users.find((u) => u.id === requesterId);
    if (!requester || requester.role !== "admin") {
      return res.status(403).json({ error: "Você não tem permissão para visualizar este diário." });
    }
    if (!targetUser.authorizedForDiary) {
      return res.status(403).json({ error: "O próprio paciente desautorizou a exibição de seus registros emocionais à psicóloga no momento." });
    }
  }

  const entries = db.diary.filter((entry) => entry.userId === userId);
  // Sort in descending chronological order
  entries.sort((a, b) => b.id.localeCompare(a.id));
  res.json(entries);
});

app.post("/api/diary", (req, res) => {
  const { userId, text, mood } = req.body;

  if (!userId || !text || !mood) {
    return res.status(400).json({ error: "Campos do diário incompletos." });
  }

  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "Paciente inválido." });
  }

  // Date and Time helpers
  const d = new Date();
  const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const newEntry: JournalEntry = {
    id: `journal-${Date.now()}`,
    userId,
    patientName: user.name,
    date: getTodayString(),
    time: timeStr,
    mood,
    text: text.trim()
  };

  db.diary.push(newEntry);
  saveDatabase(db);

  res.status(201).json(newEntry);
});

// 4. Appointment Calendars
app.get("/api/availabilities", (req, res) => {
  res.json(db.availabilities);
});

app.post("/api/availabilities", (req, res) => {
  const { availabilities } = req.body; // Array list of AvailabilityDay
  if (!Array.isArray(availabilities)) {
    return res.status(400).json({ error: "Formato de disponibilidades inválido." });
  }

  db.availabilities = availabilities;
  saveDatabase(db);
  res.json({ message: "Agenda de disponibilidades atualizada com sucesso.", availabilities: db.availabilities });
});

// Appointments lists
app.get("/api/appointments", (req, res) => {
  const { userId } = req.query;
  if (userId) {
    const filtered = db.appointments.filter((a) => a.userId === userId);
    res.json(filtered);
  } else {
    // Return all for Admin
    res.json(db.appointments);
  }
});

// Get single appointment details for billing / checkout
app.get("/api/appointments/:id", (req, res) => {
  const { id } = req.params;
  const appt = db.appointments.find((a) => a.id === id);
  if (!appt) {
    return res.status(404).json({ error: "Agendamento não localizado." });
  }
  
  // Find associated patient to retrieve their custom session price
  const patient = db.users.find((u) => u.id === appt.userId);
  const sessionPrice = patient && patient.sessionPrice !== undefined ? patient.sessionPrice : 150;

  // Retrieve custom Pix configurations
  const pixKey = getConfigValue("PIX_KEY") || "014.225.889-00";
  const pixName = getConfigValue("PIX_BENEFICIARY_NAME") || "Elieyd Barreto";
  const pixCity = getConfigValue("PIX_CITY") || "Sao Paulo";

  // Generate dynamic Pix copy-paste payload
  const rawTxid = `REC${appt.id.replace(/\W/g, "").toUpperCase()}`;
  const txid = rawTxid.substring(0, 25);
  const pixPayload = generateStaticPix(pixKey, sessionPrice, pixName, pixCity, txid);
  
  res.json({
    ...appt,
    sessionPrice,
    pixKey,
    pixPayload,
    paymentStatus: (appt as any).paymentStatus || "pendente",
    paymentDate: (appt as any).paymentDate || null,
    paymentMethod: (appt as any).paymentMethod || null,
    paidAmount: (appt as any).paidAmount || null,
    paymentSentValue: (appt as any).paymentSentValue || null,
  });
});

// Request Slot with validation safeguards!
app.post("/api/appointments", async (req, res) => {
  const { userId, date, time } = req.body;

  if (!userId || !date || !time) {
    return res.status(400).json({ error: "Dados para agendamento incompletos." });
  }

  const patient = db.users.find((u) => u.id === userId);
  if (!patient) {
    return res.status(404).json({ error: "Paciente inválido." });
  }

  // 1. Validation: Max 1 slot per day
  const dailyExisting = db.appointments.filter(
    (a) => a.userId === userId && a.date === date && a.status !== "canceled"
  );
  if (dailyExisting.length > 0) {
    return res.status(400).json({
      error: "Você já possui uma sessão agendada ou solicitada para este dia. É permitido agendar apenas 1 horário por dia."
    });
  }

  // 2. Validation: Max 2 slots per week
  // Calculate relative week (7 days envelope or target week logic)
  const targetDate = new Date(date);
  const startOfWeek = new Date(targetDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust to get Monday
  const monday = new Date(startOfWeek.setDate(diff));
  monday.setHours(0,0,0,0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23,59,59,999);

  const startOfWeekStr = monday.toISOString().split("T")[0];
  const endOfWeekStr = sunday.toISOString().split("T")[0];

  const weeklyExisting = db.appointments.filter(
    (a) =>
      a.userId === userId &&
      a.date >= startOfWeekStr &&
      a.date <= endOfWeekStr &&
      a.status !== "canceled"
  );

  if (weeklyExisting.length >= 2) {
    return res.status(400).json({
      limitExceeded: true,
      error: "Para agendar mais de dois horários na semana, entre em contato diretamente com a Elieyd para combinar uma disponibilidade especial."
    });
  }

  // 3. Ensure the slot is actually free
  const slotTaken = db.appointments.find(
    (a) => a.date === date && a.time === time && (a.status === "confirmed" || a.status === "pending")
  );
  if (slotTaken) {
    return res.status(400).json({ error: "Esse horário já está reservado ou em processo de aprovação por outro paciente." });
  }

  // Create new appointment request
  const newAppointment: Appointment = {
    id: `appt-${Date.now()}`,
    userId,
    patientName: patient.name,
    patientPhone: patient.phone,
    patientEmail: patient.email,
    date,
    time,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  db.appointments.push(newAppointment);

  // Remove booked slot from psychologist's availability array list
  const dayAvail = db.availabilities.find((av) => av.date === date);
  if (dayAvail) {
    dayAvail.slots = dayAvail.slots.filter((s) => s !== time);
  }

  // Sincroniza com o Google Calendar
  await syncAppointmentToGoogleCalendar(newAppointment, "insert");

  saveDatabase(db);

  // Send notifications to psychologist: bot and SMTP
  const ptDate = new Date(date).toLocaleDateString("pt-BR");
  await triggerTelegramNotification(
    `🆕 *Nova Solicitação de Consulta*\n\n*Paciente:* ${patient.name}\n*Contato:* ${patient.phone}\n*Data:* ${ptDate}\n*Horário:* ${time}h\n\n_Por favor, acesse a Área Administrativa para aprovar ou reagendar._`
  );

  await triggerEmailNotification(
    "admin@elieyd.com.br",
    "Solicitação de Consulta - Elieyd Barreto Psicologia",
    `Olá Elieyd, <br/><br/>O paciente <b>${patient.name}</b> (${patient.phone}) solicitou um horário de atendimento em <b>${ptDate} às ${time}h</b>.<br/>A solicitação está aguardando sua validação.<br/><br/><a href="${process.env.APP_URL || "http://localhost:3000"}">Clique aqui para acessar o painel administrativo</a>.`
  );

  res.status(201).json(newAppointment);
});

// Update appointment state (Approve, Cancel, Reschedule)
app.post("/api/appointments/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status, rescheduledDate, rescheduledTime, notes } = req.body;

  const appt = db.appointments.find((a) => a.id === id);
  if (!appt) {
    return res.status(404).json({ error: "Agendamento não localizado." });
  }

  const originalDate = appt.date;
  const originalTime = appt.time;
  const oldStatus = appt.status;

  appt.status = status;
  if (notes) appt.notes = notes;

  if (status === "rescheduled") {
    if (!rescheduledDate || !rescheduledTime) {
      return res.status(400).json({ error: "Novos valores de data e horário de reagendamento são necessários." });
    }
    appt.rescheduledDate = rescheduledDate;
    appt.rescheduledTime = rescheduledTime;
    appt.date = rescheduledDate;
    appt.time = rescheduledTime;
  }

  // Database updates
  if (status === "canceled") {
    // Return original slot to availability
    const dayAvail = db.availabilities.find((av) => av.date === originalDate);
    if (dayAvail) {
      if (!dayAvail.slots.includes(originalTime)) {
        dayAvail.slots.push(originalTime);
        dayAvail.slots.sort();
      }
    } else {
      db.availabilities.push({ date: originalDate, slots: [originalTime] });
    }
  } else if (status === "rescheduled") {
    // Return original slot to availability
    const oldDayAvail = db.availabilities.find((av) => av.date === originalDate);
    if (oldDayAvail) {
      if (!oldDayAvail.slots.includes(originalTime)) {
        oldDayAvail.slots.push(originalTime);
        oldDayAvail.slots.sort();
      }
    }

    // Remove the newly occupied slot from target date availability
    const newDayAvail = db.availabilities.find((av) => av.date === rescheduledDate);
    if (newDayAvail) {
      newDayAvail.slots = newDayAvail.slots.filter((s) => s !== rescheduledTime);
    }
  }

  // Sincroniza o novo status com o Google Calendar
  if (status === "canceled") {
    await syncAppointmentToGoogleCalendar(appt, "delete");
  } else {
    await syncAppointmentToGoogleCalendar(appt, appt.googleEventId ? "update" : "insert");
  }

  saveDatabase(db);

  // Notify patient via email
  const formattedOrig = `${new Date(originalDate).toLocaleDateString("pt-BR")} às ${originalTime}h`;
  const formattedNew = rescheduledDate ? `${new Date(rescheduledDate).toLocaleDateString("pt-BR")} às ${rescheduledTime}h` : "";

  let patientMsg = "";
  let subject = "";

  if (status === "confirmed") {
    const gCalLink = getGoogleCalendarTemplateLink(appt.date, appt.time);
    const meetLink = appt.meetLink || getGoogleMeetLink(appt.id);
    appt.meetLink = meetLink;
    subject = "Consulta Confirmada! - Elieyd Barreto Psicologia";
    patientMsg = `Olá <b>${appt.patientName}</b>,<br/><br/>Temos ótimas notícias! Sua consulta agendada para o dia <b>${formattedOrig}</b> foi <b>confirmada</b> pela psicóloga Elieyd Barreto.<br/><br/><b>Link da sua Sala Virtual do Google Meet:</b><br/><a href="${meetLink}" target="_blank" style="color: #2F4738; font-weight: bold; text-decoration: underline;">${meetLink}</a><br/><br/>Esperamos você com carinho para nossa sessão de acolhimento.<br/><br/><div style="margin: 24px 0;"><a href="${gCalLink}" target="_blank" style="background-color: #2F4738; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 30px; font-weight: bold; font-family: sans-serif; font-size: 13px; display: inline-block; box-shadow: 0 4px 6px rgba(47,71,56,0.15);">📅 Adicionar ao meu Google Agenda</a></div><br/>Dica: Se você utiliza o Gmail, basta clicar no botão acima para carregar e salvar este atendimento na sua agenda pessoal com apenas um clique!`;
  } else if (status === "canceled") {
    subject = "Alteração na Consulta - Elieyd Barreto Psicologia";
    patientMsg = `Olá <b>${appt.patientName}</b>,<br/><br/>Sua consulta para o dia <b>${formattedOrig}</b> precisou ser <b>cancelada</b>. <br/>Se houver alguma dúvida ou se quiser escolher um outro horário, sinta-se à vontade para enviar um registro no seu diário ou acessar o calendário novamente.`;
  } else if (status === "rescheduled") {
    const gCalLink = getGoogleCalendarTemplateLink(appt.date, appt.time);
    const meetLink = appt.meetLink || getGoogleMeetLink(appt.id);
    appt.meetLink = meetLink;
    subject = "Consulta Reagendada - Elieyd Barreto Psicologia";
    patientMsg = `Olá <b>${appt.patientName}</b>,<br/><br/>Sua consulta originalmente marcada para o dia <b>${formattedOrig}</b> foi <b>reagendada</b> pela psicóloga Elieyd Barreto.<br/><br/>O novo horário confirmado é: <b>${formattedNew}</b>.<br/><br/><b>Novo Link da sua Sala Virtual do Google Meet:</b><br/><a href="${meetLink}" target="_blank" style="color: #2F4738; font-weight: bold; text-decoration: underline;">${meetLink}</a><br/><br/>Se precisar alterar ou se não puder comparecer, entre em contato direto pelo painel de agendamentos.<br/><br/><div style="margin: 24px 0;"><a href="${gCalLink}" target="_blank" style="background-color: #2F4738; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 30px; font-weight: bold; font-family: sans-serif; font-size: 13px; display: inline-block; box-shadow: 0 4px 6px rgba(47,71,56,0.15);">📅 Atualizar no meu Google Agenda</a></div><br/>Dica: Ao clicar no botão acima, você poderá adicionar este novo horário diretamente na sua agenda pessoal rápido e fácil!`;
  }

  if (patientMsg) {
    await triggerEmailNotification(appt.patientEmail, subject, patientMsg);
  }

  if (status === "completed") {
    try {
      await sendBillingEmailHelper(appt.id);
    } catch (billingErr) {
      console.error("Falha ao disparar cobrança automática no encerramento da sessão:", billingErr);
    }
  }

  res.json({ message: "Status de consulta atualizado com sucesso.", appointment: appt });
});

// 5. Daily Reflections
app.get("/api/reflective-messages", (req, res) => {
  res.json(db.reflections);
});

// Gemini Dynamic Reflection message creation!
app.post("/api/reflective-messages/generate", async (req, res) => {
  const { moodContext } = req.body;
  const ai = getGeminiClient();

  if (!ai) {
    // Fallback if key missing or client initialized with empty
    const fallbackId = `ref-gen-${Date.now()}`;
    const fallbackRef: ReflectiveMessage = {
      id: fallbackId,
      title: "Cuidado e Presença " + (moodContext ? `(${moodContext})` : ""),
      text: "As pausas constroem nossa resiliência. Quando o ritmo do dia parecer acelerado demais, acolha seus batimentos e lembre-se que você não precisa resolver tudo imediatamente. A caminhada terapêutica consiste em respeitar seu próprio tempo.",
      instruction: "Prática: Desligue as telas por 3 minutos agora. Feche os olhos e ouça os sons ao seu redor sem julgá-los.",
      category: moodContext || "Autocuidado complementar",
      imageUrl: "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=600&q=80"
    };

    db.reflections.push(fallbackRef);
    saveDatabase(db);
    return res.json({
      generated: true,
      message: fallbackRef,
      warning: "Gemini Key não configurada. Foi fornecida uma mensagem curada reflexiva padrão acolhedora com base no humor."
    });
  }

  try {
    const prompt = `Aja como Elieyd Barreto, uma psicóloga doce, ética, sutil, extremamente acolhedora e inspiradora. 
Crie uma Breve Mensagem Reflexiva Diária para o seu paciente. 
Considere que o paciente indicou estar se sentindo atualmente: "${moodContext || "neutro / precisando de acolhimento"}".
A mensagem deve ser otimizada para acalmar a mente e incentivar um bem-estar gentil.

O retorno deve ser obrigatoriamente formatado em formato JSON simples com quatro chaves textuais estritas em português do Brasil:
{
  "title": "Título curto e poético",
  "text": "Texto reflexivo profundo e acolhedor (máximo 3 parágrafos curtos). Seja empático e transmita paz.",
  "instruction": "Uma Prática sugerida muito simples e concreta (ex: de respiração, autoanálise ou descompressão no ambiente).",
  "category": "Uma palavra-chave categorizadora (ex: Mindfulness, Resiliência, Calma, Autocuidado)"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const textOutput = response.text || "{}";
    const cleanedOutput = textOutput.trim().substring(textOutput.indexOf("{"), textOutput.lastIndexOf("}") + 1);
    const parsedData = JSON.parse(cleanedOutput);

    const generatedId = `ref-gen-${Date.now()}`;
    const newRef: ReflectiveMessage = {
      id: generatedId,
      title: parsedData.title || "Reflexão Generativa",
      text: parsedData.text || "Continue focado no seu crescimento emocional. A psicoterapia é o seu espaço seguro.",
      instruction: parsedData.instruction || "Prática: Faça um registro sincero no seu diário emocional sobre suas expectativas para hoje.",
      category: parsedData.category || "Crescimento pessoal",
      imageUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80"
    };

    db.reflections.push(newRef);
    saveDatabase(db);

    res.json({ generated: true, message: newRef });
  } catch (error: any) {
    console.error("Falha ao gerar reflexão com Gemini:", error);
    res.status(500).json({ error: "Falha ao gerar mensagem via Inteligência Artificial.", details: error.message });
  }
});

// --- PRE-SESSION REMINDERS INTEGRATION SERVICES ---

async function sendPreSessionReminders() {
  const now = new Date();
  const config = db.config || {};
  const qty = parseInt(config.reminder_qty || "1", 10);
  const minutesOffset1 = qty === 2 ? 40 : parseInt(config.reminder_minutes || "30", 10);
  const minutesOffset2 = 15;
  const additionalMsg = config.reminder_additional_msg || "";
  const compulsoryMsg2 = config.reminder_compulsory_msg || "";

  for (const appt of db.appointments) {
    if (appt.status !== "confirmed" && appt.status !== "rescheduled") {
      continue;
    }

    // Combine date and time
    // appt.date is YYYY-MM-DD, appt.time is HH:MM
    const apptDateTime = new Date(`${appt.date}T${appt.time}:00`);
    const diffMs = apptDateTime.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    // Ensure we have a meetLink configured
    const meetLink = appt.meetLink || getGoogleMeetLink(appt.id);
    appt.meetLink = meetLink;

    // First reminder check
    if (diffMins > 0 && diffMins <= minutesOffset1 && !appt.firstReminderSent) {
      appt.firstReminderSent = true;
      saveDatabase(db);

      // Determine session count for the patient
      const sessionCount = db.appointments.filter(
        (a) => a.patientEmail.toLowerCase().trim() === appt.patientEmail.toLowerCase().trim() && 
               (a.status === "confirmed" || a.status === "rescheduled") &&
               new Date(`${a.date}T${a.time}:00`).getTime() <= apptDateTime.getTime()
      ).length;

      const isFirst = sessionCount <= 1;

      const safetyConfidentialityText = isFirst
        ? `<b>Sua primeira sessão com a psicóloga:</b> gostaríamos de ressaltar que este é um espaço de absoluto acolhimento e <b>sigilo profissional absoluto (Código de Ética)</b>. Falar abertamente sobre suas dores é corajoso e essencial para romper com antigos tabus sobre saúde mental. Você está em um ambiente totalmente seguro e confidencial.`
        : `<b>Sua jornada de autodescoberta:</b> parabéns por persistir no seu autocuidado e desenvolvimento pessoal! Cada sessão de psicoterapia é um degrau construtivo na reabilitação emocional e no autoconhecimento continuado.`;

      const patientPrep = `
        <div style="background-color: #FAF8F6; padding: 16px; border-radius: 12px; margin-top: 18px; border: 1px solid rgba(217,184,167,0.3); font-family: sans-serif;">
          <h4 style="color: #2F4738; margin-top: 0; font-size: 14px; border-bottom: 1px solid rgba(217,184,167,0.2); padding-bottom: 6px;">📋 Dicas de Preparação pré-sessão para Paciente:</h4>
          <ul style="padding-left: 20px; font-size: 13px; color: #4A5D4E; line-height: 1.6; margin-bottom: 0;">
            <li>Encontre um cômodo isolado e confortável para garantir sua privacidade de fala.</li>
            <li>Tenha um copo ou garrafa de água fresca por perto.</li>
            <li>Acesse o link da sala virtual com 3-5 minutos de antecedência para calibrar sua câmera e áudio.</li>
            <li>Feche abas de redes sociais e respire fundo por 2 minutos para aliviar ruídos da rotina.</li>
          </ul>
        </div>
      `;

      const dynamicTechniques = [
        "Faça uma respiração lenta em quatro tempos (aspire em 4s, retenha em 4s, expire em 4s) para se sintonizar com o momento.",
        "Reflita brevemente: sobre qual desconforto ou insight da última semana você mais gostaria de falar hoje?",
        "Considere: na psicoterapia não há julgamento ou expectativas sobre sua fala. Permita-se apenas 'ser'.",
        "Aproveite este tempo para se desligar do celular e das notificações de trabalho. Dê-se essa pausa generosa."
      ];
      const technique = dynamicTechniques[appt.id.charCodeAt(0) % dynamicTechniques.length];

      const htmlPatient = `
        <div style="font-family: sans-serif; color: #1E2822; max-width: 600px; margin: 0 auto; line-height: 1.6; background-color: #FAF8F6; padding: 30px; border-radius: 20px; border: 1px solid rgba(217,184,167,0.2);">
          <h2 style="color: #2F4738; margin-top: 0; font-family: serif; font-size: 22px;">Lembrete de Pré-Sessão - Elieyd Barreto</h2>
          <p style="font-size: 14px;">Olá, <b>${appt.patientName}</b>,</p>
          <p style="font-size: 14px;">Lembramos que o seu atendimento de psicoterapia individual começará daqui a aproximadamente <b>${diffMins} minutos</b>, às <b>${appt.time}</b> de hoje (dia ${appt.date.split("-").reverse().join("/")}).</p>
          
          <div style="background-color: rgba(47,71,56,0.05); border-left: 4px solid #2F4738; padding: 14px; margin: 18px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; font-size: 13.5px; color: #1E2822;">${safetyConfidentialityText}</p>
          </div>

          ${additionalMsg ? `<p style="font-size: 13.5px; background-color: rgba(0,0,0,0.03); padding: 10px; border-radius: 6px; border-left: 3px solid #2F4738;"><b>Mensagem especial da psicóloga:</b> <i>"${additionalMsg}"</i></p>` : ""}

          <div style="background-color: rgba(217, 184, 167, 0.15); padding: 14px; border-radius: 10px; margin: 16px 0; border: 1px dashed #D9B8A7;">
            <p style="margin: 0; font-weight: bold; color: #2F4738; font-size: 13px;">💡 Sintonização para sua Pré-Sessão:</p>
            <p style="margin: 4px 0 0; font-size: 13px; color: #4F5E52;">${technique}</p>
          </div>

          ${patientPrep}

          <div style="margin: 30px 0; text-align: center;">
            <a href="${meetLink}" target="_blank" style="background-color: #2F4738; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 30px; font-weight: bold; font-family: sans-serif; font-size: 14px; display: inline-block; box-shadow: 0 4px 10px rgba(47,71,56,0.25);">💻 Acessar Reunião no Google Meet</a>
          </div>

          <p style="font-size: 11px; color: #8C8C8C; text-align: center; border-top: 1px solid rgba(217,184,167,0.1); padding-top: 15px; margin-top: 25px;">
            Este é um e-mail de acolhimento automático enviado em prol de sua segurança e preparo ambiental.
          </p>
        </div>
      `;

      await triggerEmailNotification(appt.patientEmail, `Seu Atendimento com Dra. Elieyd em ${diffMins} min`, htmlPatient);

      // Reminder for Psychologist
      const htmlPsych = `
        <div style="font-family: sans-serif; color: #1E2822; max-width: 600px; margin: 0 auto; line-height: 1.6; background-color: #FAF8F6; padding: 30px; border-radius: 20px; border: 1px solid rgba(217,184,167,0.2);">
          <h2 style="color: #2F4738; margin-top: 0; font-family: serif; font-size: 20px;">Lembrete de Atendimento - Dra. Elieyd Barreto</h2>
          <p>Olá Dra. Elieyd,</p>
          <p>Sua consulta de psicoterapia com o paciente <b>${appt.patientName}</b> começará em aproximadamente <b>${diffMins} minutos</b> (às ${appt.time}).</p>
          
          <div style="background-color: #EBF1ED; padding: 16px; border-radius: 12px; border: 1px solid #D1E0D7; margin-top: 15px;">
            <h4 style="color: #2F4738; margin-top: 0; font-size: 13.5px;">📋 Preparação da Psicóloga:</h4>
            <ul style="padding-left: 20px; font-size: 12px; color: #4A5D4E; margin-bottom: 0;">
              <li>Revise as e-fichas ou registros de diário compartilhados pelo paciente.</li>
              <li>Estruture as metas da sessão atual com base na última evolução clínica.</li>
              <li>Verifique sua iluminação e isolamento de áudio antes de conectar.</li>
            </ul>
          </div>

          <p style="font-size: 13px; margin-top: 15px;"><b>Paciente E-mail:</b> ${appt.patientEmail}<br/><b>Paciente Telefone:</b> ${appt.patientPhone}</p>

          <div style="margin: 25px 0; text-align: center;">
            <a href="${meetLink}" target="_blank" style="background-color: #2F4738; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 35px; font-weight: bold; font-family: sans-serif; font-size: 13px; display: inline-block; box-shadow: 0 4px 6px rgba(47,71,56,0.15);">💻 Entrar no Google Meet</a>
          </div>
        </div>
      `;

      const psychAdmin = db.users.find((u) => u.role === "admin");
      if (psychAdmin?.email) {
        await triggerEmailNotification(psychAdmin.email, `Sessão em ${diffMins} min - Paciente: ${appt.patientName}`, htmlPsych);
      }
    }

    // Second reminder check
    if (qty === 2 && diffMins > 0 && diffMins <= minutesOffset2 && !appt.secondReminderSent) {
      appt.secondReminderSent = true;
      saveDatabase(db);

      const htmlPatient2 = `
        <div style="font-family: sans-serif; color: #1E2822; max-width: 600px; margin: 0 auto; line-height: 1.6; background-color: #FAF8F6; padding: 25px; border-radius: 16px; border: 1px solid rgba(164,90,82,0.2);">
          <h3 style="color: #A45A52; margin-top: 0; font-size: 16px;">⚠️ Último aviso: Sua consulta inicia em ${diffMins} minutos!</h3>
          <p style="font-size: 13.5px;">Olá, <b>${appt.patientName}</b>,</p>
          <p style="font-size: 13.5px;">Este é o lembrete final complementar avisando que nossa sessão começa virtualmente às <b>${appt.time}</b>.</p>
          
          <div style="background-color: #FFFDFC; border-left: 4px solid #A45A52; padding: 12px; margin: 15px 0; border-radius: 4px; box-shadow: inset 0 0 5px rgba(0,0,0,0.02)">
            <p style="margin: 0; font-size: 13px; font-weight: bold; color: #A45A52;">Observação Complementar da Psicóloga:</p>
            <p style="margin: 5px 0 0; font-size: 13px; color: #5A4A4A; font-style: italic;">"${compulsoryMsg2 || "Dra. Elieyd Barreto já está aguardando você. Acesse a sala pelo link do Google Meet abaixo."}"</p>
          </div>

          <div style="margin: 25px 0; text-align: center;">
            <a href="${meetLink}" target="_blank" style="background-color: #A45A52; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 30px; font-weight: bold; font-family: sans-serif; font-size: 13px; display: inline-block; box-shadow: 0 4px 8px rgba(164,90,82,0.25);">💻 Acessar Sala do Meet Agora</a>
          </div>

          <p style="font-size: 10.5px; color: #8F8F8F; line-height: normal; text-align: center; margin-top: 15px;">
            Enviamos este alerta final curto para assegurar a pontualidade clínica e a excelência no seu atendimento terapêutico.
          </p>
        </div>
      `;

      await triggerEmailNotification(appt.patientEmail, `⚠️ Último Alerta: Seu Atendimento começa em ${diffMins} min`, htmlPatient2);

      // Short notification to psychologist
      const htmlPsych2 = `
        <div style="font-family: sans-serif; color: #1E2822; max-width: 600px; margin: 0 auto; line-height: 1.6; background-color: #FAF8F6; padding: 25px; border-radius: 16px;">
          <h3 style="color: #A45A52; margin-top: 0;">⚠️ Segundo Lembrete Disparado - ${appt.patientName}</h3>
          <p>Dra. Elieyd,</p>
          <p>O paciente <b>${appt.patientName}</b> começará a sessão em <b>${diffMins} minutos</b> às ${appt.time}.</p>
          <p>O aviso final com sua nota de observação complementar obrigatória foi devidamente enviado ao e-mail dele.</p>

          <div style="margin: 20px 0; text-align: center;">
            <a href="${meetLink}" target="_blank" style="background-color: #2F4738; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 20px; font-weight: bold; font-size: 12.5px; display: inline-block;">💻 Abrir Minha Sala do Google Meet</a>
          </div>
        </div>
      `;

      const psychAdmin = db.users.find((u) => u.role === "admin");
      if (psychAdmin?.email) {
        await triggerEmailNotification(psychAdmin.email, `⚠️ 2º Lembrete enviado: ${appt.patientName} em ${diffMins} min`, htmlPsych2);
      }
    }
  }
}

// Background scheduler interval (Every 60s)
setInterval(() => {
  sendPreSessionReminders().catch((err) => {
    console.error("Erro no processamento automático de lembretes:", err);
  });
}, 60000);

app.post("/api/admin/reminders/trigger-check", async (req, res) => {
  try {
    const initialCount = db.notifications.length;
    await sendPreSessionReminders();
    const endingCount = db.notifications.length;
    const sent = endingCount - initialCount;
    res.json({
      success: true,
      message: `Auditoria de lembretes de pré-sessão concluída. Foram enviados ${sent} novos e-mails de alerta!`,
      notifications: db.notifications
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Logs for notifications sending so user can audit
app.get("/api/admin/notifications", (req, res) => {
  res.json(db.notifications);
});

// Reset simulation logs API
app.post("/api/admin/notifications/clear", (req, res) => {
  db.notifications = [
    {
      id: `notif-${Date.now()}-reset`,
      timestamp: new Date().toISOString(),
      type: "system",
      recipient: "Admin",
      message: "Registro de simulações limpo pelo usuário administrativo."
    }
  ];
  saveDatabase(db);
  res.json({ status: "success", notifications: db.notifications });
});

// --- ADMIN CONFIGURATION & GOOGLE OAUTH ENDPOINTS ---

app.get("/api/admin/config", (req, res) => {
  const config = db.config || {};
  const maskedConfig = {
    SMTP_HOST: config.SMTP_HOST || process.env.SMTP_HOST || "",
    SMTP_PORT: config.SMTP_PORT || process.env.SMTP_PORT || "587",
    SMTP_USER: config.SMTP_USER || process.env.SMTP_USER || "",
    SMTP_PASS: config.SMTP_PASS || (process.env.SMTP_PASS ? "••••••••" : ""),
    SMTP_FROM: config.SMTP_FROM || process.env.SMTP_FROM || "",
    TELEGRAM_BOT_TOKEN: config.TELEGRAM_BOT_TOKEN || (process.env.TELEGRAM_BOT_TOKEN ? "••••••••" : ""),
    TELEGRAM_CHAT_ID: config.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "",
    GEMINI_API_KEY: config.GEMINI_API_KEY || (process.env.GEMINI_API_KEY ? "••••••••" : ""),
    GOOGLE_CLIENT_ID: config.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "",
    GOOGLE_CLIENT_SECRET: config.GOOGLE_CLIENT_SECRET || (process.env.GOOGLE_CLIENT_SECRET ? "••••••••" : ""),
    GOOGLE_CALENDAR_ID: config.GOOGLE_CALENDAR_ID || process.env.GOOGLE_CALENDAR_ID || "primary",
    google_connected: !!config.google_refresh_token,
    reminder_minutes: config.reminder_minutes || "30",
    reminder_additional_msg: config.reminder_additional_msg || "",
    reminder_qty: config.reminder_qty || "1",
    reminder_compulsory_msg: config.reminder_compulsory_msg || "",
    PIX_KEY: config.PIX_KEY || "014.225.889-00",
    PIX_BENEFICIARY_NAME: config.PIX_BENEFICIARY_NAME || "Elieyd Barreto",
    PIX_CITY: config.PIX_CITY || "Sao Paulo"
  };
  res.json(maskedConfig);
});

app.post("/api/admin/config", (req, res) => {
  const {
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM,
    TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GEMINI_API_KEY,
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALENDAR_ID,
    reminder_minutes, reminder_additional_msg, reminder_qty, reminder_compulsory_msg,
    PIX_KEY, PIX_BENEFICIARY_NAME, PIX_CITY
  } = req.body;

  if (!db.config) db.config = {};

  const updateField = (key: string, value: any) => {
    if (value === "••••••••") return; // skip masked
    if (value !== undefined) {
      db.config![key] = String(value).trim();
    }
  };

  updateField("SMTP_HOST", SMTP_HOST);
  updateField("SMTP_PORT", SMTP_PORT);
  updateField("SMTP_USER", SMTP_USER);
  updateField("SMTP_PASS", SMTP_PASS);
  updateField("SMTP_FROM", SMTP_FROM);
  updateField("TELEGRAM_BOT_TOKEN", TELEGRAM_BOT_TOKEN);
  updateField("TELEGRAM_CHAT_ID", TELEGRAM_CHAT_ID);
  updateField("GEMINI_API_KEY", GEMINI_API_KEY);
  updateField("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID);
  updateField("GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET);
  updateField("GOOGLE_CALENDAR_ID", GOOGLE_CALENDAR_ID);
  updateField("reminder_minutes", reminder_minutes);
  updateField("reminder_additional_msg", reminder_additional_msg);
  updateField("reminder_qty", reminder_qty);
  updateField("reminder_compulsory_msg", reminder_compulsory_msg);
  updateField("PIX_KEY", PIX_KEY);
  updateField("PIX_BENEFICIARY_NAME", PIX_BENEFICIARY_NAME);
  updateField("PIX_CITY", PIX_CITY);

  saveDatabase(db);
  res.json({ message: "Configurações atualizadas com sucesso!" });
});

app.post("/api/admin/config/test", async (req, res) => {
  const [smtp, telegram, gemini, calendar] = await Promise.all([
    testSMTPConnection(),
    testTelegramConnection(),
    testGeminiConnection(),
    testGoogleCalendarConnection()
  ]);

  res.json({
    smtp,
    telegram,
    gemini,
    calendar
  });
});

app.get("/api/auth/google-calendar/auth-url", (req, res) => {
  const clientId = db.config?.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(400).json({ error: "GOOGLE_CLIENT_ID não está configurado." });
  }

  const hostUrl = getConfigValue("APP_URL") || `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${hostUrl}/api/auth/google-calendar/callback`;
  const scopes = "https://www.googleapis.com/auth/calendar.events";

  const url = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent"
  }).toString();

  res.json({ url });
});

app.get("/api/auth/google-calendar/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; color: #721c24; background-color: #f8d7da;">
          <h2>Erro na Autorização</h2>
          <p>${error}</p>
          <button onclick="window.close()" style="padding: 10px 20px; background-color: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">Fechar Aba</button>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send("Código não fornecido.");
  }

  const clientId = db.config?.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = db.config?.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(400).send("Configuração Google (Client ID / Client Secret) ausente.");
  }

  const hostUrl = getConfigValue("APP_URL") || `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${hostUrl}/api/auth/google-calendar/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    const data = await tokenRes.json();
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    if (!db.config) db.config = {};
    db.config.google_access_token = data.access_token;
    if (data.refresh_token) {
      db.config.google_refresh_token = data.refresh_token;
    }
    db.config.google_token_expiry = String(Date.now() + data.expires_in * 1000);
    saveDatabase(db);

    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; color: #155724; background-color: #d4edda;">
          <h2 style="color: #28a745;">Google Agenda Conectada! 🎉</h2>
          <p>O consultório da Dra. Elieyd Barreto foi vinculado com sucesso à sua conta do Google Calendar.</p>
          <p>Os novos agendamentos e atualizações sincronizarão de forma totalmente automática a partir de agora.</p>
          <br/>
          <button onclick="window.close()" style="padding: 12px 24px; background-color: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px;">Fechar esta aba</button>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("Erro ao negociar tokens com o Google:", err);
    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; color: #721c24; background-color: #f8d7da;">
          <h2>Erro de Negociação de Token</h2>
          <p>${err.message || err}</p>
          <br/>
          <button onclick="window.close()" style="padding: 10px 20px; background-color: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">Fechar Aba</button>
        </body>
      </html>
    `);
  }
});

app.post("/api/auth/google-calendar/disconnect", (req, res) => {
  if (db.config) {
    delete db.config.google_access_token;
    delete db.config.google_refresh_token;
    delete db.config.google_token_expiry;
    saveDatabase(db);
  }
  res.json({ message: "Sincronização com o Google Agenda desconectada com sucesso!" });
});

// --- CLINICAL AUDITING, MEDICAL SCREENINGS & LGPD COMPLIANCE ---

function addAuditLog(operatorIdOrEmail: string, action: string, patientId: string | null, details: string) {
  if (!db.auditLogs) db.auditLogs = [];
  const log: AuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    operatorId: operatorIdOrEmail,
    action,
    patientId,
    details
  };
  db.auditLogs.unshift(log);
  saveDatabase(db);
}

app.get("/api/admin/audit-logs", (req, res) => {
  if (!db.auditLogs) db.auditLogs = [];
  res.json(db.auditLogs);
});

app.get("/api/crisis-resources", (req, res) => {
  res.json({
    phoneEmergency: "188",
    nameEmergency: "CVV - Centro de Valorização da Vida",
    urlEmergency: "https://www.cvv.org.br",
    phoneSamu: "192",
    descriptionSamu: "SAMU (Serviço de Atendimento Móvel de Urgência) - Pronto Socorro Geral",
    capsInfo: "CAPS (Centro de Atenção Psicossocial). Procure a unidade mais próxima de sua residência.",
    legalNotice: "Atenção (Resolução CFP 09/2024): Este aplicativo não atende urgências e emergências de saúde mental ou situações de violência. Em caso de crise extrema iminente, busque socorro imediato via SAMU (192) ou compareça ao pronto-atendimento hospitalar mais próximo."
  });
});

app.post("/api/patients/:id/screenings", (req, res) => {
  const { id } = req.params;
  const { instrument, score, classification } = req.body;
  
  if (!instrument || score === undefined) {
    return res.status(400).json({ error: "Dados para rastreio incompletos." });
  }
  
  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: "Paciente inválido." });
  }
  
  if (!user.screeningHistory) {
    user.screeningHistory = [];
  }
  
  const entry = {
    instrument,
    score: Number(score),
    classification: String(classification || ""),
    takenAt: new Date().toISOString()
  };
  
  user.screeningHistory.push(entry);
  saveDatabase(db);
  
  addAuditLog(user.email, "SUBMETER_RASTREIO", user.id, `Preencheu instrumento ${instrument} com escore ${score} (${classification})`);
  
  res.status(201).json({ message: "Rastreio emocional registrado com sucesso.", screening: entry, user });
});

app.get("/api/educational-contents", (req, res) => {
  if (!db.educationalContents) db.educationalContents = DEFAULT_EDUCATIONAL_CONTENT;
  res.json(db.educationalContents);
});

app.post("/api/educational-contents", (req, res) => {
  const { title, category, type, duration, summary, url } = req.body;
  if (!title || !category || !type || !url) {
    return res.status(400).json({ error: "Dados de material educativo incompletos." });
  }
  if (!db.educationalContents) db.educationalContents = [...DEFAULT_EDUCATIONAL_CONTENT];
  
  const newContent: EducationalContent = {
    id: `edu-${Date.now()}`,
    title: String(title).trim(),
    category: String(category).trim(),
    type: type as any,
    duration: String(duration || "5 min").trim(),
    summary: String(summary || "").trim(),
    url: String(url).trim(),
    createdAt: new Date().toISOString()
  };
  
  db.educationalContents.push(newContent);
  saveDatabase(db);
  res.status(201).json(newContent);
});

app.delete("/api/educational-contents/:id", (req, res) => {
  const { id } = req.params;
  if (!db.educationalContents) db.educationalContents = [...DEFAULT_EDUCATIONAL_CONTENT];
  db.educationalContents = db.educationalContents.filter(item => item.id !== id);
  saveDatabase(db);
  res.json({ success: true, message: "Material removido do acervo." });
});

app.get("/api/admin/email-templates", (req, res) => {
  if (!db.emailTemplates) db.emailTemplates = DEFAULT_EMAIL_TEMPLATES;
  res.json(db.emailTemplates);
});

app.post("/api/admin/email-templates/:id", (req, res) => {
  const { id } = req.params;
  const { subject, body } = req.body;
  
  if (!db.emailTemplates) db.emailTemplates = [...DEFAULT_EMAIL_TEMPLATES];
  const template = db.emailTemplates.find(tpl => tpl.id === id || tpl.name === id);
  if (!template) {
    return res.status(404).json({ error: "Template não localizado." });
  }
  
  if (subject !== undefined) template.subject = String(subject).trim();
  if (body !== undefined) template.body = String(body);
  template.updatedAt = new Date().toISOString();
  
  saveDatabase(db);
  res.json({ message: "Template de e-mail atualizado com sucesso.", template });
});

app.get("/api/patients/:id/export", (req, res) => {
  const { id } = req.params;
  const user = db.users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: "Paciente não localizado." });
  }
  
  const userDiary = db.diary.filter(d => d.userId === id);
  const userAppointments = db.appointments.filter(a => a.userId === id);
  
  const exportPayload = {
    title: "Relatório de Portabilidade de Dados de Saúde - LGPD",
    clinica: "Consultório de Psicoterapia Dra. Elieyd Barreto",
    generatedAt: new Date().toISOString(),
    regulatoryNotice: "Este documento contém dados pessoais protegidos sob a Lei Geral de Proteção de Dados (Lei 13.709/18).",
    personalData: user,
    diaryEntries: userDiary,
    appointments: userAppointments
  };
  
  addAuditLog("admin@elieyd.com.br", "EXPORTAR_DADOS_PORTABILIDADE", user.id, `Exportação de dados completa do paciente ${user.name}`);
  
  res.setHeader("Content-Disposition", `attachment; filename=export-dados-paciente-${user.id}.json`);
  res.json(exportPayload);
});

app.post("/api/patients/:id/anonymize", (req, res) => {
  const { id } = req.params;
  const user = db.users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: "Paciente não localizado." });
  }
  
  const originalName = user.name;
  
  // Replace sensitive identifiers with unique hashes
  user.name = "Paciente Anonimizado (Direito de Esquecimento)";
  user.phone = "(00) 00000-0000";
  user.email = `${crypto.createHash("md5").update(user.id).digest("hex").substring(0, 8)}@anonimizado.lgpd.br`;
  user.socialName = undefined;
  user.birthDate = "1970-01-01";
  user.cpf = encrypt("000.000.000-00");
  user.emergencyContact = undefined;
  user.clinicalNotes = "[DADO CLINICO ANONIMIZADO POR SOLICITAÇÃO DO TITULAR - LGPD]";
  user.anamnese = undefined;
  
  // Clear the journal text content to preserve statistics but eliminate written personal messages
  db.diary.forEach(entry => {
    if (entry.userId === id) {
      entry.text = "[Mensagem textualmente apagada e anonimizada por requisição de esquecimento do paciente sob regulamento LGPD]";
    }
  });
  
  // Remove future and past detailed notes from appointment history
  db.appointments.forEach(appt => {
    if (appt.userId === id) {
      appt.patientName = "Paciente Anonimizado";
      appt.patientEmail = user.email;
      appt.patientPhone = user.phone;
      appt.notes = undefined;
      appt.theoreticalNote = undefined;
    }
  });
  
  saveDatabase(db);
  
  addAuditLog("admin@elieyd.com.br", "ANONIMIZAR_ESQUECIMENTO", id, `Solicitação LGPD - Anonimização de registros do usuário`);
  
  res.json({ message: "Dados pessoais do paciente foram completamente apagados e anonimizados do sistema com sucesso, em estrita conformidade com a LGPD.", user });
});

app.post("/api/appointments/:id/receipt", (req, res) => {
  const { id } = req.params;
  const { valor, emissorCpf, emissorNome } = req.body;
  
  const appt = db.appointments.find(a => a.id === id);
  if (!appt) {
    return res.status(404).json({ error: "Consulta não localizada." });
  }
  
  const receiptId = `rec-${Date.now()}`;
  const receipt = {
    id: receiptId,
    apptId: id,
    patientName: appt.patientName,
    patientEmail: appt.patientEmail,
    date: appt.date,
    time: appt.time,
    valor: valor || "150.00",
    emissorNome: emissorNome || "Dra. Elieyd Barreto",
    emissorCpf: emissorCpf || "123.456.789-00",
    emissorCrp: "CRP 11/XXXXX",
    generatedAt: new Date().toISOString()
  };
  
  addAuditLog("admin@elieyd.com.br", "GERAR_RECIBO_IMPOSTO", appt.userId, `Geração de recibo financeiro de R$ ${receipt.valor}`);
  
  res.json({
    success: true,
    message: "Recibo digital emitido com sucesso.",
    receipt
  });
});

app.post("/api/appointments/:id/send-billing-email", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await sendBillingEmailHelper(id);
    res.json({ success: true, message: result.message });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Falha ao encaminhar cobrança." });
  }
});

app.post("/api/appointments/:id/confirm-payment", (req, res) => {
  const { id } = req.params;
  const { paymentMethod, paidValue } = req.body;

  const appt = db.appointments.find(a => a.id === id);
  if (!appt) {
    return res.status(404).json({ error: "Agendamento correspondente não foi localizado para compensação." });
  }

  const patient = db.users.find(u => u.id === appt.userId);
  const finalValue = paidValue !== undefined ? Number(paidValue) : (patient?.sessionPrice !== undefined ? patient.sessionPrice : 150);

  // Register completion
  (appt as any).paymentStatus = 'pago';
  (appt as any).paymentMethod = paymentMethod || 'cartao';
  (appt as any).paymentDate = new Date().toISOString();
  (appt as any).paidAmount = finalValue;
  
  if (patient) {
    patient.paymentStatus = 'em_dia';
  }

  saveDatabase(db);

  // Trigger system notification
  const notification: SystemNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    type: "system",
    recipient: "admin@elieyd.com.br",
    message: `🌟 Pagamento Confirmado! Paciente ${appt.patientName} quitou a sessão de ${new Date(appt.date + "T00:00:00").toLocaleDateString('pt-BR')} no valor de R$ ${finalValue.toFixed(2)} via ${paymentMethod === "pix" ? "Pix" : "Cartão de Crédito"}.`
  };
  db.notifications.unshift(notification);
  saveDatabase(db);

  addAuditLog(appt.patientEmail, "PAGAMENTO_EFETUADO", appt.userId, `Pagamento de atendimento compensado com sucesso via ${paymentMethod}. Valor: R$ ${finalValue}`);

  res.json({ success: true, message: "Pagamento recebido e registrado em prontuário com sucesso!", appointment: appt });
});

app.post("/api/audit-logs/add", (req, res) => {
  const { action, patientName, details } = req.body;
  addAuditLog("admin@elieyd.com.br", action || "REGISTRAR_EVENTO", null, details || `Evento registrado para ${patientName}`);
  res.json({ success: true });
});

app.post("/api/auth/mfa/toggle", (req, res) => {
  const { userId, mfaEnabled } = req.body;
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "Usuário não localizado." });
  }
  user.mfaEnabled = !!mfaEnabled;
  saveDatabase(db);
  
  addAuditLog(user.email, "CONFIGURAR_MFA", user.id, `MFA ${user.mfaEnabled ? "Ativado" : "Desativado"}`);
  
  res.json({ success: true, mfaEnabled: user.mfaEnabled });
});

// Vite Setup for static assets
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Elieyd Barreto] Express server running on port ${PORT}`);
  });
}

setupServer();
