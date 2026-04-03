
(function(){
  if (window.__HH_KI_READY__) return;
  window.__HH_KI_READY__ = true;

  const title = (document.querySelector('h1')?.textContent || document.title || 'Haushaltsheld').trim();
  const pagePath = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const pageMap = {
    'index.html': {
      label: 'Dashboard',
      prompts: ['Was ist heute wichtig?', 'Gib mir einen Familien-Überblick', 'Welche Aufgaben sollte ich zuerst machen?']
    },
    'finanzen.html': {
      label: 'Finanzen',
      prompts: ['Hilf mir eine Ausgabe einzuordnen', 'Gib mir einen Spartipp', 'Welche Kategorie passt zu meinem Eintrag?']
    },
    'einkaufsliste.html': {
      label: 'Einkauf',
      prompts: ['Sortiere meinen Einkauf', 'Was fehlt für den Wocheneinkauf?', 'Ordne diesen Einkauf einer Kategorie zu']
    },
    'beleg_import.html': {
      label: 'Belegimport',
      prompts: ['Hilf mir beim Beleg-Import', 'Welche Daten sollte ich übernehmen?', 'Ist das eher Einkauf oder Finanzen?']
    },
    'familienplaner.html': {
      label: 'Familienplaner',
      prompts: ['Plane einen Geburtstag', 'Woran sollte ich jetzt denken?', 'Hilf mir beim Geschenkbudget']
    },
    'finanz_historie.html': {
      label: 'Historie',
      prompts: ['Erkläre mir meine Historie', 'Wonach sollte ich filtern?', 'Was fällt in meinen Ausgaben auf?']
    },
    'finanzbericht.html': {
      label: 'Bericht',
      prompts: ['Fass mir den Bericht einfach zusammen', 'Welche Zahl ist am wichtigsten?', 'Welche Ausgaben stechen heraus?']
    },
    'datenzentrale.html': {
      label: 'Datenzentrale',
      prompts: ['Erkläre mir die Datenverknüpfung', 'Welche Bereiche hängen zusammen?', 'Was sollte ich als Nächstes prüfen?']
    },
    'kindermodus.html': {
      label: 'Kindermodus',
      prompts: ['Erkläre es kindgerecht', 'Wie kann ich Sterne sammeln?', 'Hilf mir bei meinem Sparziel']
    },
    'aufgaben.html': {
      label: 'Aufgaben',
      prompts: ['Hilf mir Aufgaben zu verteilen', 'Mach mir eine motivierende Aufgabe', 'Was ist heute am wichtigsten?']
    }
  };
  const pageInfo = pageMap[pagePath] || {label:title, prompts:['Hilf mir auf dieser Seite','Erkläre mir diese Seite','Was kann ich hier tun?']};
  const storageKey = 'hh_ki_chat_' + pagePath;

  const root = document.createElement('div');
  root.className = 'hh-ki-shell';
  root.innerHTML = `
    <div class="hh-ki-panel" aria-live="polite">
      <div class="hh-ki-head">
        <div class="hh-ki-title">
          <div class="icon">🐌</div>
          <div>
            <strong>KI-Schnecke</strong>
            <span>${pageInfo.label} · ${title}</span>
          </div>
        </div>
        <button type="button" class="hh-ki-close" aria-label="KI schließen">✕</button>
      </div>
      <div class="hh-ki-quick"></div>
      <div class="hh-ki-messages"></div>
      <div class="hh-ki-foot">
        <div class="hh-ki-typing"><span>denkt nach</span><span class="hh-ki-dot"></span><span class="hh-ki-dot"></span><span class="hh-ki-dot"></span></div>
        <form class="hh-ki-form">
          <input class="hh-ki-input" type="text" placeholder="Frag die KI-Schnecke etwas …" maxlength="500" />
          <button class="hh-ki-send" type="submit">Senden</button>
        </form>
        <div class="hh-ki-note">Die Schnecke kennt den Seitenkontext und nutzt deine Chat-Funktion im Hintergrund.</div>
      </div>
    </div>
    <button type="button" class="hh-ki-toggle" aria-label="KI-Schnecke öffnen">
      <span class="emoji">🐌</span>
    </button>
    <div class="hh-ki-badge">1</div>
  `;
  document.body.appendChild(root);

  const panel = root.querySelector('.hh-ki-panel');
  const toggle = root.querySelector('.hh-ki-toggle');
  const closeBtn = root.querySelector('.hh-ki-close');
  const messagesEl = root.querySelector('.hh-ki-messages');
  const form = root.querySelector('.hh-ki-form');
  const input = root.querySelector('.hh-ki-input');
  const sendBtn = root.querySelector('.hh-ki-send');
  const typing = root.querySelector('.hh-ki-typing');
  const quickEl = root.querySelector('.hh-ki-quick');

  pageInfo.prompts.forEach(prompt => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hh-ki-chip';
    b.textContent = prompt;
    b.addEventListener('click', () => {
      input.value = prompt;
      input.focus();
    });
    quickEl.appendChild(b);
  });

  function saveMessages() {
    try { sessionStorage.setItem(storageKey, JSON.stringify(history)); } catch (e) {}
  }
  function loadMessages() {
    try { return JSON.parse(sessionStorage.getItem(storageKey) || '[]'); } catch (e) { return []; }
  }
  function scrollDown() { messagesEl.scrollTop = messagesEl.scrollHeight; }
  function addMessage(role, text) {
    const el = document.createElement('div');
    el.className = 'hh-ki-msg ' + role;
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollDown();
  }
  function renderHistory() {
    messagesEl.innerHTML = '';
    if (!history.length) {
      addMessage('bot', `Hallo ✨ Ich bin deine KI-Schnecke auf der Seite „${pageInfo.label}“. Frag mich nach Hilfe, Einordnung oder Ideen.`);
      addMessage('meta', 'Beispiel: „Welche Kategorie passt zu einem dm-Einkauf?“');
      return;
    }
    history.forEach(m => addMessage(m.role, m.text));
  }
  function openPanel() {
    root.classList.add('open');
    root.classList.remove('has-unread');
    input.focus();
  }
  function closePanel() { root.classList.remove('open'); }

  let history = loadMessages();
  renderHistory();

  toggle.addEventListener('click', () => root.classList.contains('open') ? closePanel() : openPanel());
  closeBtn.addEventListener('click', closePanel);

  async function sendMessage(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    history.push({ role:'user', text: trimmed });
    saveMessages();
    renderHistory();
    input.value = '';
    sendBtn.disabled = true;
    typing.classList.add('active');

    const payload = {
      message: `Seitenkontext: ${pageInfo.label} (${title}). URL-Datei: ${pagePath}. Nutzerfrage: ${trimmed}`
    };

    try {
      const res = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      const reply = data.reply || data.answer || data.output_text || data.message || 'Ich konnte gerade keine Antwort holen.';
      history.push({ role:'bot', text: reply });
      saveMessages();
      renderHistory();
      if (!root.classList.contains('open')) root.classList.add('has-unread');
    } catch (err) {
      const msg = 'Die KI-Schnecke konnte gerade keine Verbindung herstellen. Bitte prüfe später die Function oder versuche es erneut.';
      history.push({ role:'bot', text: msg });
      saveMessages();
      renderHistory();
    } finally {
      typing.classList.remove('active');
      sendBtn.disabled = false;
    }
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    sendMessage(input.value);
  });

  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closePanel();
  });
})();
