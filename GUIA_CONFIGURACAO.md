# Guia de Configuração das Variáveis de Ambiente
### Elieyd Barreto — Psicologia Clínica (Full-Stack Mobile-First)

Este documento orienta de maneira simples e profissional como preencher as variáveis de ambiente necessárias para ativar o disparo de e-mails reais via Gmail e as notificações do Telegram na plataforma.

As variáveis devem ser configuradas no painel **Secrets** (Configurações / Secrets) do Google AI Studio para que reflitam em tempo de execução no servidor.

---

## 1. Integração com Telegram

### `TELEGRAM_BOT_TOKEN`
O Token de autorização gerado ao criar o seu robô (bot).
* **Como obter:**
  1. No Telegram, converse com o [@BotFather](https://t.me/BotFather).
  2. Envie o comando `/newbot` e escolha o nome de exibição e usuário do bot (ex: `AtendimentoElieydBot`).
  3. O BotFather fornecerá um token no formato: `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`.
  4. Copie esse valor integralmente.

### `TELEGRAM_CHAT_ID`
O identificador numérico único do chat ou grupo para onde as notificações de novos cadastros e agendamentos serão enviadas de forma instantânea.
* **Como obter:**
  1. No Telegram, abra uma conversa com o seu bot recém-criado e clique em **Começar** (`/start`).
  2. Envie qualquer mensagem teste para ele.
  3. No seu navegador, acesse o seguinte endereço substituindo `<SEU_BOT_TOKEN>` pelo seu token real:
     `https://api.telegram.org/bot<SEU_BOT_TOKEN>/getUpdates`
  4. Você verá um código em formato JSON. Procure pelo objeto `"chat"` e copie o campo `"id"` correspondente (ele costuma ser uma sequência numérica como `987654321`).
  5. *Dica para Grupos:* Se você deseja receber as notificações em um grupo privado com o bot adicionado, use um bot como o `@userinfobot` dentro do grupo para descobrir o ID do grupo (IDs de grupos geralmente começam com o sinal de menos, ex: `-100123456789`).

---

## 2. Integração com E-mail (Gmail SPF/SMTP)

Como você já configurou a **Senha de App de 16 dígitos** na segurança da sua conta Google, aqui estão as variáveis exatas para sintonizar o Gmail:

### `SMTP_HOST`
O servidor SMTP oficial do Gmail.
* **Valor para inserir:** `smtp.gmail.com`

### `SMTP_PORT`
A porta segura para transferência de correio.
* **Valor para inserir:** `587` (ou `465` caso decida por conexão SSL direta).

### `SMTP_USER`
A sua conta de e-mail completa que enviará as confirmações e agendamentos.
* **Valor para inserir:** `seu_email@gmail.com`

### `SMTP_PASS`
A senha secreta estrita dedicada para segurança e aplicações.
* **Valor para inserir:** A senha especial de **16 caracteres em letras minúsculas** sem espaços (ex: `abcd efgh ijkl mnop`) gerada no menu de *Segurança > Senhas de App* da sua Conta Google.
* *Nota:* Nunca utilize a sua senha principal do e-mail.

### `SMTP_FROM`
O e-mail de exibição do remetente (geralmente idêntico ao seu endereço de usuário para fins de autenticação anti-spam).
* **Valor para inserir:** `seu_email@gmail.com`

---

## 3. Configurações Compartilhadas pela Plataforma

### `APP_URL`
A URL principal gerada automaticamente onde sua aplicação está rodando. O servidor do app usa este link para compor os botões interativos enviados aos pacientes nos e-mails.

### `GEMINI_API_KEY`
A chave de validação oficial do Google AI Studio, injetada dinamicamente, permitindo que a Inteligência Artificial formule mensagens reflexivas autorais e práticas baseadas na sua linha psicológica e no humor indicado pelo paciente.
