/* ==========================================================
   Misael Barbearia — agendamento
   Tudo configurável no objeto CONFIG abaixo.
   ========================================================== */

const CONFIG = {
  // Número que recebe as confirmações (DDI + DDD + número, só dígitos). Ex.: "5511999999999"
  // Vazio = o WhatsApp abre para o cliente escolher o contato.
  whatsapp: "",

  // Intervalo entre horários de início, em minutos
  slotStep: 30,

  // Dias de agendamento disponíveis a partir de hoje
  daysAhead: 21,

  // Funcionamento (0 = domingo ... 6 = sábado). null = fechado
  hours: {
    0: null,
    1: null,
    2: ["09:00", "19:00"],
    3: ["09:00", "19:00"],
    4: ["09:00", "19:00"],
    5: ["09:00", "20:00"],
    6: ["08:00", "17:00"],
  },

  services: [
    { id: "corte",      cat: "cortes",  name: "Corte",       price: 50,  duration: 60,  desc: "Tesoura e/ou máquina, lavagem e finalização." },
    { id: "barba",      cat: "barba",   name: "Barba",       price: 30,  duration: 60,  desc: "Toalha quente, navalha e balm hidratante." },
    { id: "alisamento", cat: "quimica", name: "Alisamento",  price: 150, duration: 105, desc: "Redução de volume com acabamento natural." },
  ],

  // Serviços apenas com avaliação presencial (não entram no agendamento online)
  consult: [
    { cat: "quimica", name: "Coloração / Pigmentação", desc: "Valor definido após avaliação do fio." },
  ],

  categories: [
    { id: "cortes",  name: "Cortes" },
    { id: "barba",   name: "Barba" },
    { id: "quimica", name: "Química & Coloração" },
  ],

  combos: [
    { id: "classico", tag: "O mais pedido", name: "Clássico",      italic: "corte + barba",              items: ["corte", "barba"],               price: 70 },
    { id: "liso",     tag: "Química",       name: "Liso",          italic: "corte + alisamento",         items: ["corte", "alisamento"],          price: 180 },
    { id: "completo", tag: "Dia do noivo",  name: "Completo",      italic: "corte + barba + alisamento", items: ["corte", "barba", "alisamento"], price: 200 },
  ],
};

const STORAGE_KEY = "misael_agendamentos_v1";

/* ---------- utilidades ---------- */
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const brl = (v) => "R$ " + v.toLocaleString("pt-BR");
const pad = (n) => String(n).padStart(2, "0");
const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const toHHMM = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const fmtDuration = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h${pad(m)}` : `${h}h`;
};
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WEEK_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtDay = (k) => { const d = parseKey(k); return `${WEEK_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const digits = (s) => s.replace(/\D/g, "");
const maskPhone = (v) => {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const svc = (id) => CONFIG.services.find((s) => s.id === id);

const store = {
  all() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } },
  save(list) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {} },
};

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("is-on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("is-on"), 2600);
}

/* ---------- estado ---------- */
const state = {
  step: 1,
  selected: new Set(),
  day: null,
  time: null,
  dayOffset: 0,
};

/* preço: aplica o combo que bate exatamente com a seleção */
function pricing() {
  const items = [...state.selected].map(svc).filter(Boolean)
    .sort((a, b) => CONFIG.services.indexOf(a) - CONFIG.services.indexOf(b));
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const duration = items.reduce((s, i) => s + i.duration, 0);
  const ids = items.map((i) => i.id).sort().join("|");
  const combo = CONFIG.combos.find((c) => [...c.items].sort().join("|") === ids) || null;
  const total = combo ? combo.price : subtotal;
  return { items, subtotal, duration, combo, total, discount: subtotal - total };
}

/* ---------- render: tabela ---------- */
function renderMenu() {
  const menu = $("#menu");
  menu.innerHTML = CONFIG.categories.map((cat) => {
    const list = CONFIG.services.filter((s) => s.cat === cat.id);
    const cons = CONFIG.consult.filter((s) => s.cat === cat.id);
    return `
      <div class="menu__col reveal">
        <div class="menu__cat"><h3>${cat.name}</h3><span>${pad(list.length + cons.length)} ${list.length + cons.length > 1 ? "itens" : "item"}</span></div>
        ${list.map((s) => `
          <div class="menu__item">
            <div class="menu__line">
              <span class="menu__name">${s.name}</span><span class="menu__dots"></span>
              <span class="menu__price"><small>R$</small>${s.price}</span>
            </div>
            <div class="menu__meta">
              <p class="menu__desc">${s.desc}</p>
              <button type="button" class="menu__add" data-add="${s.id}" aria-label="Adicionar ${s.name} ao agendamento" aria-pressed="false">+</button>
            </div>
            <span class="menu__time">≈ ${fmtDuration(s.duration)}</span>
          </div>`).join("")}
        ${cons.map((s) => `
          <div class="menu__item menu__item--consult">
            <div class="menu__line">
              <span class="menu__name">${s.name}</span><span class="menu__dots"></span>
              <span class="menu__price">sob avaliação</span>
            </div>
            <div class="menu__meta"><p class="menu__desc">${s.desc}</p></div>
          </div>`).join("")}
      </div>`;
  }).join("");

  menu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (!b) return;
    toggleService(b.dataset.add);
    const on = state.selected.has(b.dataset.add);
    toast(on ? `${svc(b.dataset.add).name} adicionado ao agendamento` : `${svc(b.dataset.add).name} removido`);
  });
}

/* ---------- render: combos ---------- */
function renderCombos() {
  $("#combos-list").innerHTML = CONFIG.combos.map((c) => {
    const items = c.items.map(svc);
    const full = items.reduce((s, i) => s + i.price, 0);
    const dur = items.reduce((s, i) => s + i.duration, 0);
    return `
      <article class="combo reveal">
        <span class="combo__tag">${c.tag}</span>
        <span class="combo__save">−${brl(full - c.price)}</span>
        <h3>${c.name}<br><em>${c.italic}</em></h3>
        <ul class="combo__list">
          ${items.map((i) => `<li><span>${i.name}</span><span>${brl(i.price)}</span></li>`).join("")}
        </ul>
        <div class="combo__price"><s>${brl(full)}</s><strong>${brl(c.price)}</strong></div>
        <div class="combo__foot">
          <span class="mono">≈ ${fmtDuration(dur)} de cadeira</span>
          <button type="button" class="btn btn--ghost btn--sm" data-combo="${c.id}">Escolher</button>
        </div>
      </article>`;
  }).join("");

  $("#combos-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-combo]");
    if (!b) return;
    const c = CONFIG.combos.find((x) => x.id === b.dataset.combo);
    state.selected = new Set(c.items);
    resetFrom(2);
    goStep(1);
    syncAll();
    $("#agendar").scrollIntoView({ behavior: "smooth" });
    toast(`Combo ${c.name} selecionado`);
  });
}

/* ---------- passo 1: serviços ---------- */
function renderChoices() {
  $("#service-choices").innerHTML = CONFIG.services.map((s) => `
    <label class="choice">
      <input type="checkbox" value="${s.id}">
      <span class="choice__box">
        <span class="choice__check"></span>
        <span><span class="choice__title">${s.name}</span><span class="choice__sub">${fmtDuration(s.duration)}</span></span>
        <span class="choice__price">${brl(s.price)}</span>
      </span>
    </label>`).join("");

  $("#service-choices").addEventListener("change", (e) => {
    if (e.target.type !== "checkbox") return;
    toggleService(e.target.value, e.target.checked);
  });
}

function toggleService(id, force) {
  const on = force ?? !state.selected.has(id);
  on ? state.selected.add(id) : state.selected.delete(id);
  resetFrom(2);
  syncAll();
}

/* zera escolhas posteriores quando a duração muda */
function resetFrom(step) {
  if (step <= 3) state.time = null;
  if (step <= 2 && state.day && !dayHasSlots(state.day)) state.day = null;
}

/* ---------- passo 2: dias ---------- */
function availableDays() {
  const out = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < CONFIG.daysAhead; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    out.push(dateKey(d));
  }
  return out;
}

function renderDays() {
  const per = window.matchMedia("(max-width: 640px)").matches ? CONFIG.daysAhead : 7;
  const all = availableDays();
  const view = all.slice(state.dayOffset, state.dayOffset + per);
  $("#days").innerHTML = view.map((k) => {
    const d = parseKey(k);
    const open = CONFIG.hours[d.getDay()];
    const has = open && dayHasSlots(k);
    const label = !open ? "Fechado" : !has ? "Lotado" : "";
    return `
      <button type="button" class="day ${state.day === k ? "is-selected" : ""}" data-day="${k}" ${has ? "" : "disabled"}
        role="option" aria-selected="${state.day === k}" title="${label}">
        <span class="day__w">${WEEK[d.getDay()]}</span>
        <span class="day__d">${d.getDate()}</span>
        <span class="day__m">${label || MONTHS[d.getMonth()]}</span>
      </button>`;
  }).join("");
  $$(".days-nav").forEach((b) => {
    const dir = +b.dataset.dir;
    b.disabled = dir < 0 ? state.dayOffset === 0 : state.dayOffset + per >= all.length;
  });
}

/* ---------- passo 3: horários ---------- */
function bookedRanges(dayKey) {
  return store.all().filter((b) => b.day === dayKey && !b.cancelled).map((b) => [toMin(b.time), toMin(b.time) + b.duration]);
}

function slotsFor(dayKey) {
  const d = parseKey(dayKey);
  const open = CONFIG.hours[d.getDay()];
  if (!open) return [];
  const dur = pricing().duration || 60;
  const [start, end] = open.map(toMin);
  const taken = bookedRanges(dayKey);
  const now = new Date();
  const isToday = dayKey === dateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes() + 30; // antecedência mínima de 30min
  const out = [];
  for (let t = start; t + dur <= end; t += CONFIG.slotStep) {
    const clash = taken.some(([a, b]) => t < b && t + dur > a);
    const past = isToday && t < nowMin;
    out.push({ time: toHHMM(t), free: !clash && !past, past });
  }
  return out;
}

function dayHasSlots(k) { return slotsFor(k).some((s) => s.free); }

function renderSlots() {
  const box = $("#slots");
  if (!state.day) { box.innerHTML = ""; return; }
  const list = slotsFor(state.day).filter((s) => !s.past);
  const { duration } = pricing();
  $("#slot-hint").innerHTML = `${fmtDay(state.day)} · seu atendimento dura <strong>${fmtDuration(duration)}</strong>. Horários riscados já estão ocupados.`;
  if (!list.some((s) => s.free)) {
    box.innerHTML = `<div class="slot-empty">Sem horários livres neste dia para ${fmtDuration(duration)}. Tente outro dia.</div>`;
    return;
  }
  const groups = [["Manhã", 0, 720], ["Tarde", 720, 1080], ["Noite", 1080, 1440]];
  box.innerHTML = groups.map(([name, a, b]) => {
    const g = list.filter((s) => toMin(s.time) >= a && toMin(s.time) < b);
    if (!g.length) return "";
    return `<div class="slot-group">${name}</div>` + g.map((s) => `
      <button type="button" class="slot ${state.time === s.time ? "is-selected" : ""}" data-time="${s.time}" ${s.free ? "" : "disabled"}
        role="option" aria-selected="${state.time === s.time}">${s.time}</button>`).join("");
  }).join("");
}

/* ---------- resumo ---------- */
function renderSummary() {
  const p = pricing();
  $("#sum-items").innerHTML = p.items.length
    ? p.items.map((i) => `<li><span>${i.name}</span><span>${brl(i.price)}</span></li>`).join("")
    : `<li class="muted">Nenhum serviço selecionado</li>`;
  $("#sum-duration").textContent = p.duration ? fmtDuration(p.duration) : "—";
  $("#sum-day").textContent = state.day ? fmtDay(state.day) : "—";
  $("#sum-time").textContent = state.time ? `${state.time} – ${toHHMM(toMin(state.time) + p.duration)}` : "—";
  $("#sum-discount-row").hidden = !p.combo;
  if (p.combo) {
    $("#sum-discount-label").textContent = `Combo ${p.combo.name}`;
    $("#sum-discount").textContent = `−${brl(p.discount)}`;
  }
  const tot = $("#sum-total");
  const txt = brl(p.total);
  if (tot.textContent !== txt) {
    tot.textContent = txt;
    tot.classList.remove("bump"); void tot.offsetWidth; tot.classList.add("bump");
  }
  $("#sum-code").textContent = p.combo ? p.combo.name.toUpperCase() : p.items.length ? `${p.items.length} SERV.` : "—";

  const hint = $("#combo-hint");
  const near = !p.combo && p.items.length ? CONFIG.combos.find((c) => p.items.every((i) => c.items.includes(i.id)) && c.items.length === p.items.length + 1) : null;
  if (p.combo) {
    hint.hidden = false;
    hint.innerHTML = `Combo <strong>${p.combo.name}</strong> aplicado — você economiza <strong>${brl(p.discount)}</strong>.`;
  } else if (near) {
    const missing = svc(near.items.find((id) => !state.selected.has(id)));
    hint.hidden = false;
    hint.innerHTML = `Dica: adicione <strong>${missing.name}</strong> e feche o combo ${near.name} por <strong>${brl(near.price)}</strong>.`;
  } else {
    hint.hidden = true;
  }
}

/* ---------- navegação entre passos ---------- */
function canAdvance(step) {
  if (step === 1) return state.selected.size > 0;
  if (step === 2) return !!state.day;
  if (step === 3) return !!state.time;
  return true;
}

function goStep(n) {
  state.step = n;
  $$(".pane").forEach((p) => p.classList.toggle("is-active", +p.dataset.pane === n));
  $$("#steps li").forEach((li) => {
    const s = +li.dataset.step;
    li.classList.toggle("is-active", s === n);
    li.classList.toggle("is-done", s < n);
  });
  $("#btn-back").hidden = n === 1;
  $("#btn-next").textContent = n === 4 ? "Confirmar agendamento" : "Continuar";
  if (n === 2) renderDays();
  if (n === 3) renderSlots();
  if (n === 4) setTimeout(() => $("#f-name").focus(), 50);
  updateNext();
}

function updateNext() { $("#btn-next").disabled = !canAdvance(state.step); }

function syncAll() {
  $$("#service-choices input").forEach((i) => (i.checked = state.selected.has(i.value)));
  $$("[data-add]").forEach((b) => {
    const on = state.selected.has(b.dataset.add);
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-pressed", on);
  });
  if (state.step === 2) renderDays();
  if (state.step === 3) renderSlots();
  if (state.step > 1 && !state.selected.size) goStep(1);
  else if (state.step === 3 && !state.day) goStep(2);
  renderSummary();
  updateNext();
}

/* ---------- validação ---------- */
function validate() {
  const name = $("#f-name").value.trim();
  const phone = digits($("#f-phone").value);
  const errs = {};
  if (name.length < 3) errs["f-name"] = "Informe seu nome.";
  else if (!/^[\p{L}' .-]+$/u.test(name)) errs["f-name"] = "Use apenas letras no nome.";
  if (phone.length < 10 || phone.length > 11) errs["f-phone"] = "Telefone com DDD, ex.: (11) 98765-4321.";
  ["f-name", "f-phone"].forEach((id) => {
    $(`.err[data-for="${id}"]`).textContent = errs[id] || "";
    $(`#${id}`).closest(".field").classList.toggle("has-error", !!errs[id]);
  });
  return Object.keys(errs).length ? null : { name, phone };
}

/* ---------- confirmar ---------- */
function confirmBooking() {
  const data = validate();
  if (!data) return;
  const p = pricing();
  // checagem final de conflito (outra aba pode ter marcado)
  if (!slotsFor(state.day).find((s) => s.time === state.time && s.free)) {
    toast("Esse horário acabou de ser ocupado. Escolha outro.");
    state.time = null; goStep(3); renderSummary();
    return;
  }
  const booking = {
    id: "MB-" + Math.random().toString(36).slice(2, 7).toUpperCase(),
    name: data.name,
    phone: data.phone,
    note: $("#f-note").value.trim(),
    services: p.items.map((i) => i.id),
    combo: p.combo ? p.combo.id : null,
    total: p.total,
    duration: p.duration,
    day: state.day,
    time: state.time,
    createdAt: new Date().toISOString(),
  };
  const all = store.all(); all.push(booking); store.save(all);
  openModal(booking);

  // reinicia o fluxo
  state.selected.clear(); state.day = null; state.time = null; state.dayOffset = 0;
  $("#booking-form").reset();
  goStep(1); syncAll();
}

function bookingLines(b) {
  const names = b.services.map((id) => svc(id)?.name).filter(Boolean).join(" + ");
  const combo = b.combo ? CONFIG.combos.find((c) => c.id === b.combo) : null;
  return {
    names, combo,
    end: toHHMM(toMin(b.time) + b.duration),
  };
}

function openModal(b) {
  const { names, combo, end } = bookingLines(b);
  $("#m-name").textContent = b.name.split(" ")[0];
  $("#m-ticket").innerHTML = `
    <div><span>Código</span><strong class="mono">${b.id}</strong></div>
    <div><span>Serviço</span><strong>${names}${combo ? ` (combo ${combo.name})` : ""}</strong></div>
    <div><span>Dia</span><strong>${fmtDay(b.day)}</strong></div>
    <div><span>Horário</span><strong>${b.time} – ${end}</strong></div>
    <div><span>Telefone</span><strong>${maskPhone(b.phone)}</strong></div>
    <div><span>Total</span><strong>${brl(b.total)}</strong></div>`;
  const msg = `Olá! Agendei na Misael Barbearia:%0A` +
    encodeURIComponent(`• ${names}${combo ? ` (combo ${combo.name})` : ""}\n• ${fmtDay(b.day)}, ${b.time}–${end}\n• Total: ${brl(b.total)}\n• Nome: ${b.name}\n• Código: ${b.id}`);
  $("#m-whats").href = `https://wa.me/${CONFIG.whatsapp}?text=${msg}`;
  $("#m-ics").onclick = () => downloadICS(b);
  $("#modal").hidden = false;
  document.body.style.overflow = "hidden";
  $(".modal__close").focus();
}

function closeModal() {
  $("#modal").hidden = true;
  document.body.style.overflow = "";
}

function downloadICS(b) {
  const { names, end } = bookingLines(b);
  const stamp = (k, t) => k.replace(/-/g, "") + "T" + t.replace(":", "") + "00";
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Misael Barbearia//PT-BR",
    "BEGIN:VEVENT",
    `UID:${b.id}@misaelbarbearia`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART:${stamp(b.day, b.time)}`,
    `DTEND:${stamp(b.day, end)}`,
    `SUMMARY:Misael Barbearia — ${names}`,
    `DESCRIPTION:Código ${b.id} · Total ${brl(b.total)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `misael-barbearia-${b.day}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- meus horários ---------- */
function renderMine(phone) {
  const box = $("#my-list");
  const list = store.all().filter((b) => b.phone === phone && !b.cancelled)
    .sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
  if (!list.length) {
    box.innerHTML = `<p class="muted">Nenhum horário encontrado para ${maskPhone(phone)}.</p>`;
    return;
  }
  const today = dateKey(new Date());
  box.innerHTML = list.map((b) => {
    const d = parseKey(b.day);
    const { names, end } = bookingLines(b);
    const past = b.day < today;
    return `
      <div class="my-item ${past ? "my-item--past" : ""}">
        <div class="my-item__date">${pad(d.getDate())}/${pad(d.getMonth() + 1)}<small>${WEEK_LONG[d.getDay()]}</small></div>
        <div class="my-item__info"><strong>${names} · ${b.time}–${end}</strong><span>${b.id} · ${brl(b.total)}</span></div>
        ${past ? `<span class="mono muted">realizado</span>` : `<button class="btn btn--ghost-dark btn--sm" data-cancel="${b.id}">Desmarcar</button>`}
      </div>`;
  }).join("");
}

/* ---------- eventos ---------- */
function bind() {
  $("#btn-next").addEventListener("click", () => {
    if (state.step < 4) { if (canAdvance(state.step)) goStep(state.step + 1); }
    else confirmBooking();
  });
  $("#btn-back").addEventListener("click", () => goStep(Math.max(1, state.step - 1)));
  $("#steps").addEventListener("click", (e) => {
    const li = e.target.closest("li.is-done");
    if (li) goStep(+li.dataset.step);
  });
  $("#booking-form").addEventListener("submit", (e) => { e.preventDefault(); if (state.step === 4) confirmBooking(); });
  $("#booking-form").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && state.step === 4) { e.preventDefault(); confirmBooking(); }
  });

  $("#days").addEventListener("click", (e) => {
    const b = e.target.closest("[data-day]");
    if (!b || b.disabled) return;
    if (state.day !== b.dataset.day) state.time = null;
    state.day = b.dataset.day;
    renderDays(); renderSummary(); updateNext();
    $("#hours-hint").innerHTML = (() => {
      const [a, z] = CONFIG.hours[parseKey(state.day).getDay()];
      return `${fmtDay(state.day)} · aberto das <strong>${a}</strong> às <strong>${z}</strong>.`;
    })();
  });
  $$(".days-nav").forEach((b) => b.addEventListener("click", () => {
    state.dayOffset = Math.max(0, state.dayOffset + (+b.dataset.dir) * 7);
    renderDays();
  }));

  $("#slots").addEventListener("click", (e) => {
    const b = e.target.closest("[data-time]");
    if (!b || b.disabled) return;
    state.time = b.dataset.time;
    renderSlots(); renderSummary(); updateNext();
  });

  ["#f-phone", "#lookup-phone"].forEach((s) => $(s).addEventListener("input", (e) => {
    e.target.value = maskPhone(e.target.value);
  }));
  ["#f-name", "#f-phone"].forEach((s) => $(s).addEventListener("blur", () => {
    if ($("#f-name").value || $("#f-phone").value) validate();
  }));

  $("#lookup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const p = digits($("#lookup-phone").value);
    if (p.length < 10) { toast("Digite o telefone com DDD."); return; }
    renderMine(p);
  });
  $("#my-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cancel]");
    if (!b) return;
    if (!confirm("Desmarcar este horário?")) return;
    const all = store.all();
    const bk = all.find((x) => x.id === b.dataset.cancel);
    if (bk) { bk.cancelled = true; store.save(all); }
    renderMine(digits($("#lookup-phone").value));
    syncAll();
    toast("Horário desmarcado. O horário ficou livre.");
  });

  $$("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });

  const bar = $(".topbar");
  const onScroll = () => bar.classList.toggle("is-scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  window.addEventListener("storage", (e) => { if (e.key === STORAGE_KEY) syncAll(); });
  window.matchMedia("(max-width: 640px)").addEventListener("change", () => { state.dayOffset = 0; if (state.step === 2) renderDays(); });
}

/* ---------- textos de horário ---------- */
function renderHours() {
  const order = [2, 3, 4, 5, 6, 0, 1];
  $("#footer-hours").innerHTML = order.map((d) => {
    const h = CONFIG.hours[d];
    return `<li><span>${WEEK_LONG[d]}</span><span>${h ? `${h[0]}–${h[1]}` : "fechado"}</span></li>`;
  }).join("");
  const openDays = order.filter((d) => CONFIG.hours[d]);
  $("#hero-hours").textContent = `${WEEK[openDays[0]][0].toUpperCase() + WEEK[openDays[0]].slice(1)}–${WEEK[openDays.at(-1)][0].toUpperCase() + WEEK[openDays.at(-1)].slice(1)}`;
  $("#year").textContent = new Date().getFullYear();
}

/* ---------- reveal ---------- */
function reveal() {
  const els = $$(".reveal, .section__head");
  els.forEach((el) => el.classList.add("reveal"));
  if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("is-in")); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
  }), { threshold: .12 });
  els.forEach((el) => io.observe(el));
}

renderMenu();
renderCombos();
renderChoices();
renderHours();
bind();
syncAll();
reveal();
