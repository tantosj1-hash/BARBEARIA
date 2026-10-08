# Misael Barbearia

Site de agendamento da Misael Barbearia — HTML, CSS e JavaScript puros, sem build.

## Como abrir
Abra `index.html` no navegador, ou publique a pasta no GitHub Pages / Netlify / Vercel.

## O que tem
- Tabela de valores: Corte R$ 50 (1h), Barba R$ 30 (1h), Alisamento R$ 150 (1h45), Coloração sob avaliação
- Combos com desconto aplicado automaticamente
- Agendamento em 4 passos: serviços → dia → horário → nome e telefone
- Horários calculados pela duração somada dos serviços, sem sobreposição
- Confirmação com envio pelo WhatsApp e arquivo `.ics` para a agenda
- "Meus horários": consulta e cancelamento pelo telefone

## Configurar
Tudo fica no objeto `CONFIG` no início de `js/app.js`: número do WhatsApp, horário de funcionamento,
preços, durações e combos.

> Os agendamentos ficam salvos no navegador (localStorage). Para o barbeiro ver todos os
> agendamentos em um só lugar, preencha `CONFIG.whatsapp` (cada cliente envia a confirmação para
> esse número) ou conecte um backend.

## Imagens
As ilustrações em `assets/` (interior da barbearia, navalha, tesoura e pente) foram desenhadas em SVG
para este projeto — sem uso de fotos de terceiros, sem risco de direitos autorais.
