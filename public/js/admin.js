/* ==========================================================
   Misael Barbearia — painel do barbeiro
   Lê os agendamentos (só contas cadastradas em admins/{uid}).
   Dados do cliente são inseridos com textContent (nunca innerHTML).
   ========================================================== */

const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const hhmm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEK = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const SERVICOS = { corte: "Corte", barba: "Barba", alisamento: "Alisamento" };
const COMBOS = { classico: "Clássico", liso: "Liso", completo: "Completo" };
const fmtDay = (k) => { const [y, m, d] = k.split("-").map(Number); const dt = new Date(y, m - 1, d); return `${WEEK[dt.getDay()]}, ${pad(d)}/${pad(m)}`; };
const fmtPhone = (p) => p.length === 11 ? `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}` : `(${p.slice(0, 2)}) ${p.slice(2, 6)}-${p.slice(6)}`;

function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  children.flat().forEach((c) => c != null && n.append(c));
  return n;
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("is-on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("is-on"), 3000);
}

if (!window.firebase || !firebase.apps.length) {
  $("#login").hidden = true;
  $("#offline").hidden = false;
} else {
  start();
}

function start() {
  const auth = firebase.auth();
  const db = firebase.firestore();
  let unsub = null;
  let docs = [];
  let range = "hoje";
  let firstLoad = true;
  const fresh = new Set();

  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#login-err").textContent = "";
    try {
      await auth.signInWithEmailAndPassword($("#l-email").value.trim(), $("#l-pass").value);
    } catch {
      $("#login-err").textContent = "E-mail ou senha incorretos.";
    }
  });

  $("#btn-logout").addEventListener("click", () => auth.signOut());

  $("#btn-alerts").addEventListener("click", async () => {
    if (!("Notification" in window)) { toast("Este navegador não suporta alertas."); return; }
    const p = await Notification.requestPermission();
    toast(p === "granted" ? "Alertas ativados com o painel aberto." : "Alertas bloqueados no navegador.");
  });

  document.querySelectorAll("[data-range]").forEach((b) => b.addEventListener("click", () => {
    range = b.dataset.range;
    document.querySelectorAll("[data-range]").forEach((x) => x.classList.toggle("is-on", x === b));
    render();
  }));

  auth.onAuthStateChanged(async (user) => {
    if (unsub) { unsub(); unsub = null; }
    if (!user) { show(false); return; }
    const admin = await db.doc(`admins/${user.uid}`).get().catch(() => null);
    if (!admin || !admin.exists) {
      await auth.signOut();
      $("#login-err").textContent = "Esta conta não tem acesso ao painel.";
      return;
    }
    show(true);
    firstLoad = true;
    unsub = db.collection("agendamentos").where("dia", ">=", dateKey(new Date()))
      .onSnapshot((snap) => {
        if (!firstLoad) {
          snap.docChanges().filter((c) => c.type === "added").forEach((c) => {
            fresh.add(c.doc.id);
            notify(c.doc.data());
          });
        }
        firstLoad = false;
        docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.dia + pad(a.inicio)).localeCompare(b.dia + pad(b.inicio)));
        render();
      }, () => toast("Sem permissão para ler a agenda."));
  });

  function show(logged) {
    $("#login").hidden = logged;
    $("#agenda").hidden = !logged;
    $("#session").hidden = !logged;
  }

  function render() {
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const want = range === "hoje" ? dateKey(today) : range === "amanha" ? dateKey(tomorrow) : null;
    const list = docs.filter((a) => !want || a.dia === want);
    const active = list.filter((a) => a.status !== "cancelado");
    $("#agenda-info").textContent = `${active.length} atendimento(s) · R$ ${active.reduce((s, a) => s + a.total, 0)} previstos`;

    const box = $("#list");
    box.replaceChildren();
    if (!list.length) { box.append(el("p", { className: "muted", textContent: "Nenhum agendamento." })); return; }

    let lastDay = null;
    list.forEach((a) => {
      if (range === "todos" && a.dia !== lastDay) {
        box.append(el("div", { className: "admin__day", textContent: fmtDay(a.dia) }));
        lastDay = a.dia;
      }
      const servicos = a.servicos.map((s) => SERVICOS[s] || s).join(" + ") + (a.combo ? ` (combo ${COMBOS[a.combo] || a.combo})` : "");
      const cancelled = a.status === "cancelado";
      const actions = el("div", { className: "appt__actions" });
      if (!cancelled) {
        actions.append(
          el("a", { className: "btn btn--ghost-dark btn--sm", href: `tel:+55${a.telefone}`, textContent: "Ligar" }),
          el("a", { className: "btn btn--ghost-dark btn--sm", href: `https://wa.me/55${a.telefone}`, target: "_blank", rel: "noopener", textContent: "WhatsApp" }),
          el("button", { className: "btn btn--dark btn--sm", type: "button", textContent: "Cancelar", onclick: () => cancel(a) }),
        );
      } else {
        actions.append(el("span", { className: "mono muted", textContent: "cancelado" }));
      }
      box.append(el("article", { className: `appt${fresh.has(a.id) ? " is-new" : ""}${cancelled ? " is-cancel" : ""}` },
        el("div", { className: "appt__time" }, hhmm(a.inicio), el("small", { textContent: `até ${hhmm(a.inicio + a.duracao)}` })),
        el("div", { className: "appt__who" },
          el("strong", { textContent: a.nome }),
          el("span", { textContent: `${fmtPhone(a.telefone)} · ${servicos} · R$ ${a.total}` }),
          a.obs ? el("em", { textContent: `“${a.obs}”` }) : null,
          el("em", { textContent: a.codigo }),
        ),
        actions,
      ));
    });
  }

  async function cancel(a) {
    if (!confirm(`Cancelar o horário de ${a.nome} (${fmtDay(a.dia)}, ${hhmm(a.inicio)})? O horário volta a ficar livre no site.`)) return;
    try {
      const blocos = await db.collection("blocos").where("ref", "==", a.id).get();
      const batch = db.batch();
      blocos.forEach((b) => batch.delete(b.ref));
      batch.update(db.doc(`agendamentos/${a.id}`), { status: "cancelado" });
      await batch.commit();
      toast("Horário cancelado e liberado.");
    } catch {
      toast("Não foi possível cancelar. Tente de novo.");
    }
  }

  function notify(a) {
    beep();
    const body = `${fmtDay(a.dia)} · ${hhmm(a.inicio)} — ${String(a.nome).split(" ")[0]}`;
    toast(`Novo agendamento: ${body}`);
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification("Novo agendamento", { body }); } catch {}
    }
  }

  function beep() {
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.setValueAtTime(.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .6);
      o.start(); o.stop(ctx.currentTime + .6);
    } catch {}
  }
}
