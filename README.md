# Misael Barbearia

Site de agendamento da Misael Barbearia — HTML, CSS e JavaScript puros, sem build.

## Estrutura
```
public/            ← site (é o que vai para o ar)
  index.html       ← página de agendamento
  admin.html       ← painel do barbeiro (login)
  css/ js/ assets/
firestore.rules    ← regras de segurança do banco de dados
functions/         ← aviso automático no WhatsApp do barbeiro
firebase.json      ← configuração do Firebase (hosting, cabeçalhos de segurança)
.firebaserc        ← ID do projeto Firebase ("barbearia")
```

## Publicar no Firebase Hosting
1. Instale o Node.js (https://nodejs.org) e depois a CLI do Firebase:
   `npm install -g firebase-tools`
2. Entre na sua conta: `firebase login`
3. Confira o ID do projeto: `firebase projects:list`.
   Se o ID não for exatamente `barbearia` (ex.: `barbearia-1a2b3`), troque em `.firebaserc`
   ou rode `firebase use --add` e escolha o projeto.
4. Na pasta do repositório, publique: `firebase deploy --only hosting`

O site fica em `https://<id-do-projeto>.web.app`.
Não rode `firebase init hosting` — a configuração já está pronta e o init pode sobrescrever o `index.html`.

## Segurança dos dados (nome e telefone)
- Os agendamentos ficam no **Firestore**. Pelas regras (`firestore.rules`), **ninguém** consegue ler
  nome ou telefone pelo site; só a conta do barbeiro, logada no painel `/admin`.
- O público só enxerga quais horários estão ocupados (dia + hora), sem dados pessoais.
- Cada horário é reservado em blocos de 15 min que não podem ser sobrescritos: dois clientes nunca
  ficam com o mesmo horário.
- O banco recusa dados fora do padrão (nome com símbolos/código, telefone inválido, campos extras,
  datas no passado, horários fora do expediente).
- O aparelho do cliente guarda só o código e o horário, sem nome nem telefone.
- Consentimento (LGPD) obrigatório, campo-isca contra robôs e cabeçalhos de segurança HTTP
  (CSP, HSTS, anti-iframe etc.) em `firebase.json`.
- O aviso no WhatsApp leva só o primeiro nome e o final do telefone; o resto fica no painel.

## Configurar o Firebase (uma vez)
1. **Firestore:** Console → Firestore Database → Criar banco → modo **produção** →
   local **southamerica-east1 (São Paulo)**.
2. **Login do barbeiro:** Console → Authentication → Começar → ative **E-mail/senha** →
   aba Usuários → Adicionar usuário (e-mail e senha do barbeiro). Copie o **UID** do usuário.
3. **Liberar o painel:** Firestore → Iniciar coleção `admins` → ID do documento = **UID copiado** →
   adicione um campo qualquer (ex.: `nome` = `Misael`) → Salvar.
4. **Aviso no WhatsApp (+55 62 8321-3862):**
   - O Cloud Functions exige o plano **Blaze** (pago por uso; o volume de uma barbearia fica na cota grátis).
   - No celular do barbeiro, siga https://www.callmebot.com/blog/free-api-whatsapp-messages/ para
     receber a *apikey* (é só mandar uma mensagem de autorização para o número indicado lá).
   - No Prompt de Comando, dentro da pasta do projeto:
     `firebase functions:secrets:set CALLMEBOT_APIKEY` (cole a apikey)
5. Publique regras e função: `firebase deploy --only firestore,functions`

Sem o passo 4, o site funciona normalmente e o cliente ainda pode mandar a confirmação pelo
botão de WhatsApp; o barbeiro também recebe alerta com som no painel `/admin` aberto.

## Publicação automática (GitHub → Firebase)
O arquivo `.github/workflows/firebase-deploy.yml` publica o site sozinho sempre que uma alteração
chega ao GitHub. Configuração (uma vez só):
1. Firebase Console → ⚙️ Configurações do projeto → **Contas de serviço** → **Gerar nova chave privada**
   (baixa um arquivo `.json`).
2. GitHub → repositório → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: cole todo o conteúdo do arquivo `.json`
3. Pronto. Acompanhe as publicações na aba **Actions** do repositório.

Para testar localmente: `firebase serve` ou abra `public/index.html` no navegador.

## O que tem
- Tabela de valores: Corte R$ 50 (1h), Barba R$ 30 (1h), Alisamento R$ 150 (1h45), Coloração sob avaliação
- Combos com desconto e duração própria, aplicados automaticamente: Corte + Barba (1h15), Corte + Alisamento (2h), Corte + Barba + Alisamento (2h15)
- Agendamento em 4 passos: serviços → dia → horário → nome e telefone
- Horários calculados pela duração somada dos serviços, sem sobreposição
- Confirmação com envio pelo WhatsApp e arquivo `.ics` para a agenda
- "Meus horários": horários marcados neste aparelho, com pedido de cancelamento pelo WhatsApp
- Painel do barbeiro (`/admin`): agenda do dia, contato do cliente, cancelamento e alerta de novos horários

## Configurar
Tudo fica no objeto `CONFIG` no início de `public/js/app.js`: número do WhatsApp, horário de funcionamento,
preços, durações e combos.

> Os agendamentos ficam salvos no navegador (localStorage). Para o barbeiro ver todos os
> agendamentos em um só lugar, preencha `CONFIG.whatsapp` (cada cliente envia a confirmação para
> esse número) ou conecte um backend.

## Imagens
As ilustrações em `public/assets/` (interior da barbearia, navalha, tesoura e pente) foram desenhadas em SVG
para este projeto — sem uso de fotos de terceiros, sem risco de direitos autorais.
