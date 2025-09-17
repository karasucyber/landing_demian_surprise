// === CONFIG ===
const ENDPOINT = "https://script.google.com/macros/s/AKfycbw_0rOfMOgmzb0YFoQIBFmTuKsyfjo1qUEGBKDuE-3-1M2-LQgxopx92RKRL_MsGosiyw/exec"; // troque se publicar nova versão
const PAYMENT_URL = "https://mpago.la/21bsQZ9";

/* ===== Toast helper ===== */
function showToast({ title = "Tudo certo!", message = "", type = "success", timeout = 4200 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <div class="icon" aria-hidden="true"></div>
    <div>
      <div class="title">${title}</div>
      <div class="msg">${message}</div>
    </div>
    <button class="close" aria-label="Fechar aviso">×</button>
  `;
  const remove = () => { el.style.animation = 'toast-out .18s ease-in forwards'; setTimeout(()=>el.remove(), 180); };
  el.querySelector('.close')?.addEventListener('click', remove);
  root.appendChild(el);
  if (timeout > 0) setTimeout(remove, timeout);
}

/* ===== Parallax leve no banner ===== */
const bg = document.querySelector('.bg');
window.addEventListener('scroll', ()=>{
  const y = window.scrollY || 0;
  if (bg) bg.style.transform = `translateY(${y * -0.12}px) scale(1.02)`;
});

/* ===== Contagem regressiva ===== */
(function countdown(){
  const dEl = document.getElementById('d'), hEl = document.getElementById('h'), mEl = document.getElementById('m');
  if (!dEl || !hEl || !mEl) return;
  const target = new Date('2025-06-07T09:00:00-03:00'); // ajuste a data do evento
  function tick(){
    const now = new Date();
    let diff = Math.max(0, target - now);
    const d = Math.floor(diff / (1000*60*60*24)); diff -= d*24*60*60*1000;
    const h = Math.floor(diff / (1000*60*60));    diff -= h*60*60*1000;
    const m = Math.floor(diff / (1000*60));
    dEl.textContent = d;
    hEl.textContent = h.toString().padStart(2,'0');
    mEl.textContent = m.toString().padStart(2,'0');
  }
  tick(); setInterval(tick, 30000);
})();

/* ===== Relógio em tempo real ===== */
function updateClock() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const dateEl = document.getElementById('now-date');
  const timeEl = document.getElementById('now-time');
  if (dateEl) dateEl.textContent = dateStr;
  if (timeEl) timeEl.textContent = timeStr;
}
updateClock(); setInterval(updateClock, 1000);

/* ===== Modal helpers ===== */
const payModal   = document.getElementById('pay-modal');
const payClose   = document.getElementById('pay-close');
const payLater   = document.getElementById('pay-later');
const payNow     = document.getElementById('pay-now');
const paySummary = document.getElementById('pay-summary');

function openPayModal({nome, email, whatsapp, filial}) {
  // monta um resumo amigável (opcional)
  const wppFmt = (whatsapp || '').replace(/\D+/g,'').replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
  const lines = [];
  if (nome) lines.push(`<strong>Nome:</strong> ${nome}`);
  if (email) lines.push(`<strong>E-mail:</strong> ${email}`);
  if (whatsapp) lines.push(`<strong>WhatsApp:</strong> ${wppFmt}`);
  if (filial) lines.push(`<strong>Filial:</strong> ${filial}`);
  paySummary.innerHTML = lines.length ? lines.join('<br>') : 'Dados registrados. Prossiga para o pagamento.';

  payNow.setAttribute('href', PAYMENT_URL);
  payModal.classList.add('open');
  payModal.setAttribute('aria-hidden', 'false');
  // foco no botão principal
  setTimeout(()=> payNow.focus(), 0);
}
function closePayModal(){
  payModal.classList.remove('open');
  payModal.setAttribute('aria-hidden', 'true');
}
payClose?.addEventListener('click', closePayModal);
payLater?.addEventListener('click', closePayModal);
// fecha ao clicar fora
payModal?.addEventListener('click', (e)=>{ if (e.target === payModal) closePayModal(); });
// ESC para fechar
window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && payModal?.classList.contains('open')) closePayModal(); });

/* ===== Envio do formulário (CORS-safe via text/plain) ===== */
const form = document.getElementById('form');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  // validação nativa
  if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

  const btn = form.querySelector('button[type="submit"]');
  const original = btn ? btn.textContent : null;

  // Honeypot
  const honey = form.querySelector('input[name="website"]');
  if (honey && honey.value.trim() !== '') {
    showToast({ title: "Inscrição enviada!", message: "Recebemos seus dados.", type: "success" });
    form.reset();
    return;
  }

  // coleta dados
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());
  data._origin = window.location.href;
  data._ts = Date.now();

  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight
      body: JSON.stringify(data),
    });

    let json = null;
    try { json = await res.json(); }
    catch { const txt = await res.text(); try { json = JSON.parse(txt); } catch {} }

    if (res.ok && json && (json.ok === true || json.status === 'ok')) {
      showToast({
        title: "Inscrição enviada!",
        message: "Confira os dados e conclua o pagamento.",
        type: "success",
        timeout: 2400
      });

      // abre modal com resumo + botão de pagamento
      openPayModal({
        nome: data.nome,
        email: data.email,
        filial: data.filial
      });

      form.reset();
    } else {
      const msg = (json && (json.error || json.message)) || `Erro ${res.status}`;
      showToast({
        title: "Não deu certo :(",
        message: "Falha ao enviar. " + msg,
        type: "error"
      });
    }
  } catch (err) {
    showToast({
      title: "Erro de rede",
      message: "Verifique sua conexão e tente novamente.",
      type: "error"
    });
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = original || 'Enviar inscrição'; }
  }
});
