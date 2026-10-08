# Misael Barbearia

Site de agendamento da Misael Barbearia — HTML, CSS e JavaScript puros, sem build.

## Estrutura
```
public/          ← site (é o que vai para o ar)
  index.html
  css/ js/ assets/
firebase.json    ← configuração do Firebase Hosting
.firebaserc      ← ID do projeto Firebase ("barbearia")
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

Para testar localmente: `firebase serve` ou abra `public/index.html` no navegador.

## O que tem
- Tabela de valores: Corte R$ 50 (1h), Barba R$ 30 (1h), Alisamento R$ 150 (1h45), Coloração sob avaliação
- Combos com desconto e duração própria, aplicados automaticamente: Corte + Barba (1h15), Corte + Alisamento (2h), Corte + Barba + Alisamento (2h15)
- Agendamento em 4 passos: serviços → dia → horário → nome e telefone
- Horários calculados pela duração somada dos serviços, sem sobreposição
- Confirmação com envio pelo WhatsApp e arquivo `.ics` para a agenda
- "Meus horários": consulta e cancelamento pelo telefone

## Configurar
Tudo fica no objeto `CONFIG` no início de `public/js/app.js`: número do WhatsApp, horário de funcionamento,
preços, durações e combos.

> Os agendamentos ficam salvos no navegador (localStorage). Para o barbeiro ver todos os
> agendamentos em um só lugar, preencha `CONFIG.whatsapp` (cada cliente envia a confirmação para
> esse número) ou conecte um backend.

## Imagens
As ilustrações em `public/assets/` (interior da barbearia, navalha, tesoura e pente) foram desenhadas em SVG
para este projeto — sem uso de fotos de terceiros, sem risco de direitos autorais.
