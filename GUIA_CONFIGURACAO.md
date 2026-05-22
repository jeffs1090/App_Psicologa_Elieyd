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

---

## 4. Guia de Publicação e Hospedagem Externa (Full-Stack)

Nossa aplicação é **Full-Stack** (composta por um cliente em Frontend React e um servidor Backend Express em Node.js). Ela **não** pode ser hospedada apenas como um site de arquivos estáticos (como GitHub Pages clássico) sem que o servidor também esteja rodando, pois o servidor é responsável por armazenar os dados em `database.json`, enviar os Pix, enviar os e-mails e lidar com a autenticação.

Existem duas formas principais de você hospedar esta aplicação externamente com sucesso:

### Opção A: Hospedagem Unificada (Altamente Recomendado)
Neste modelo, o seu servidor backend e o frontend rodam juntos na mesma máquina/serviço. Plataformas excelentes para isso são: **Render.com**, **Railway.app**, **Fly.io** ou **Heroku**.
1. **Como Funciona:** Você sobe todo o repositório fonte para estes serviços.
2. **Build & Start:** A plataforma lerá o arquivo `package.json` e executará automaticamente:
   * **Script de Build:** `npm run build` (compila o frontend e agrupa o servidor no arquivo compactado `dist/server.cjs`).
   * **Script de Start:** `npm run start` (executa `node dist/server.cjs` iniciando o servidor).
3. **Porta Dinâmica:** O servidor foi atualizado para ler dinamicamente a porta dada pela hospedagem (`process.env.PORT`), garantindo que a comunicação não apresente erros.
4. **Sem configurações extras de rede:** Como o frontend e o backend rodam na mesma URL, as chamadas com caminhos relativos (ex: `/api/auth/login`) funcionam perfeitamente de primeira!

### Opção B: Hospedagem Separada (Frontend no Vercel/Netlify + Backend no Render/Railway)
Caso você queira hospedar a interface visual em plataformas estáticas otimizadas (como **Vercel** ou **Netlify**) e o servidor de processamento e dados em outra (como **Render** ou **Railway**):
1. No painel da hospedagem do **Frontend** (Vercel/Netlify), configure a seguinte variável de ambiente:
   * `VITE_API_URL` = link completo da URL de onde o seu servidor backend foi publicado (ex: `https://meu-consultorio-api.onrender.com`).
2. No painel de hospedagem do **Backend** (Render/Railway), assegure-se de subir o projeto normalmente com o comando de build e start padrões.
3. **CORS Ativo:** O nosso servidor Express já vem equipado com uma política robusta de CORS integrada nativamente que aceitará conexões vindas do seu domínio do Vercel/Netlify garantindo o funcionamento suave.

---

## 5. Credenciais de Teste / Acesso Padrão (Pré-cadastrados no `database.json`)

Para validar as principais funções instantaneamente, utilize os seguintes dados de demonstração:

* **Conta Administrativa (Dra. Elieyd Barreto):**
  * **E-mail:** `admin@elieyd.com.br`
  * **Senha:** `elieyd123`
  
* **Conta de Paciente Simulado (Paciente de Teste):**
  * **E-mail:** `paciente@teste.com`
  * **Senha:** `senha123`

