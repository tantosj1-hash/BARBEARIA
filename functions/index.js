/**
 * Misael Barbearia — avisa o barbeiro no WhatsApp a cada novo agendamento.
 *
 * Envio pelo CallMeBot (gratuito). A mensagem leva só o primeiro nome e o final
 * do telefone do cliente; os dados completos ficam no painel protegido (/admin).
 *
 * Configuração (uma vez):
 *   firebase functions:secrets:set CALLMEBOT_APIKEY
 */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

// Mesma região do banco Firestore (São Paulo).
setGlobalOptions({ region: "southamerica-east1", maxInstances: 2 });

const CALLMEBOT_APIKEY = defineSecret("CALLMEBOT_APIKEY");
const WHATSAPP_BARBEIRO = defineString("WHATSAPP_BARBEIRO", { default: "+556283213862" });

const SERVICOS = { corte: "Corte", barba: "Barba", alisamento: "Alisamento" };
const COMBOS = { classico: "Clássico", liso: "Liso", completo: "Completo" };
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const pad = (n) => String(n).padStart(2, "0");
const hhmm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

exports.avisarBarbeiro = onDocumentCreated(
  { document: "agendamentos/{id}", secrets: [CALLMEBOT_APIKEY] },
  async (event) => {
    const a = event.data && event.data.data();
    if (!a) return;

    const [y, m, d] = a.dia.split("-").map(Number);
    const semana = SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    const primeiroNome = String(a.nome).trim().split(/\s+/)[0];
    const servicos = a.servicos.map((s) => SERVICOS[s] || s).join(" + ");
    const site = `https://${process.env.GCLOUD_PROJECT}.web.app/admin`;

    const texto = [
      "✂️ *Novo agendamento*",
      `${semana} ${pad(d)}/${pad(m)} · ${hhmm(a.inicio)}–${hhmm(a.inicio + a.duracao)}`,
      `${servicos}${a.combo ? ` (combo ${COMBOS[a.combo] || a.combo})` : ""} · R$ ${a.total}`,
      `Cliente: ${primeiroNome} · tel. final ${String(a.telefone).slice(-4)}`,
      `Código: ${a.codigo}`,
      `Detalhes: ${site}`,
    ].join("\n");

    const url = "https://api.callmebot.com/whatsapp.php?" + new URLSearchParams({
      phone: WHATSAPP_BARBEIRO.value(),
      text: texto,
      apikey: CALLMEBOT_APIKEY.value(),
    });

    const res = await fetch(url);
    // não registra nome/telefone nos logs
    if (!res.ok) logger.error("Falha ao enviar WhatsApp", { status: res.status, codigo: a.codigo });
    else logger.info("Barbeiro avisado", { codigo: a.codigo });
  }
);
