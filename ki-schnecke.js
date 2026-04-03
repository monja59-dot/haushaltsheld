(function () {
  const body = document.body;

  function detectPage() {
    const path = window.location.pathname.toLowerCase();

    if (path.includes("finanzen")) return "finanzen";
    if (path.includes("einkaufsliste")) return "einkaufsliste";
    if (path.includes("aufgaben")) return "aufgaben";
    if (path.includes("familienplaner")) return "familienplaner";
    if (path.includes("finanzbericht")) return "finanzbericht";
    if (path.includes("finanz_historie")) return "finanz_historie";
    if (path.includes("beleg_import")) return "beleg_import";
    if (path.includes("kindermodus")) return "kindermodus";
    if (path.includes("index")) return "dashboard";

    return "allgemein";
  }

  function detectMode() {
    if (body.classList.contains("child-mode")) return "child";

    const badge = document.getElementById("modeBadge")?.textContent?.toLowerCase() || "";
    if (badge.includes("kind")) return "child";

    const activeModeBtn = document.querySelector(".mode-btn.active")?.textContent?.toLowerCase() || "";
    if (activeModeBtn.includes("kind")) return "child";

    return "parent";
  }

  const page = detectPage();
  let mode = detectMode();

  const quickQuestionsByPage = {
    dashboard: [
      "Was ist heute wichtig?",
      "Gib mir einen kurzen Überblick.",
      "Worauf sollten wir als Nächstes achten?"
    ],
    finanzen: [
      "Hilf mir beim Sparen.",
      "Wie kann ich Ausgaben besser ordnen?",
      "Erkläre mir meine Finanzen einfacher."
    ],
    einkaufsliste: [
      "Was fehlt noch für den Wocheneinkauf?",
      "Hilf mir beim Sortieren.",
      "Welche Kategorie passt dazu?"
    ],
    aufgaben: [
      "Hilf mir Aufgaben zu priorisieren.",
      "Formuliere eine freundliche Aufgabe.",
      "Wie verteile ich Aufgaben besser?"
    ],
    familienplaner: [
      "Trage mir einen Kinderarzttermin ein.",
      "Hilf mir einen Geburtstag zu planen.",
      "Woran sollte ich diese Woche denken?"
    ],
    finanzbericht: [
      "Erkläre mir den Bericht einfach.",
      "Was fällt hier auf?",
      "Was bedeutet das Ergebnis?"
    ],
    finanz_historie: [
      "Erkennst du ein Muster?",
      "Erkläre mir die letzten Einträge.",
      "Was ist hier wichtig?"
    ],
    beleg_import: [
      "Wie soll ich den Beleg einordnen?",
      "Welche Kategorie passt?",
      "Worauf sollte ich achten?"
    ],
    kindermodus: [
      "Hilfst du mir beim Sparen?",
      "Was kann ich heute schaffen?",
      "Erklär mir das ganz einfach."
    ],
    allgemein: [
      "Wobei kannst du helfen?",
      "Gib mir einen Überblick.",
      "Was kannst du für mich tun?"
    ]
  };

  const shell = document.createElement("div");
  shell.className = "ki-shell";
  shell.innerHTML = `
    <button class="ki-fab" id="kiFab" type="button" aria-label="KI-Schnecke öffnen">
      🐌 KI
    </button>

    <div class="ki-panel" id="kiPanel" aria-hidden="true">
      <div class="ki-header">
        <div class="ki-title-wrap">
          <div class="ki-title">Haushaltsheld KI</div>
          <div class="ki-subtitle" id="kiSubtitle">Ich helfe dir auf dieser Seite.</div>
        </div>
        <button class="ki-close" id="kiClose" type="button" aria-label="Schließen">✕</button>
      </div>

      <div class="ki-quick" id="kiQuick"></div>

      <div class="ki-messages" id="kiMessages">
        <div class="ki-msg ki-msg-bot">Hallo 👋 Ich bin deine KI-Schnecke. Wie kann ich dir helfen?</div>
      </div>

      <form class="ki-form" id="kiForm">
        <input id="kiInput" type="text" placeholder="Schreib deine Frage hier hinein..." autocomplete="off" />
        <button type="submit">Senden</button>
      </form>
    </div>
  `;

  body.appendChild(shell);

  const fab = document.getElementById("kiFab");
  const panel = document.getElementById("kiPanel");
  const closeBtn = document.getElementById("kiClose");
  const form = document.getElementById("kiForm");
  const input = document.getElementById("kiInput");
  const messages = document.getElementById("kiMessages");
  const quick = document.getElementById("kiQuick");
  const subtitle = document.getElementById("kiSubtitle");

  subtitle.textContent =
    mode === "child"
      ? "Ich helfe dir kindgerecht und freundlich."
      : "Ich helfe dir freundlich, praktisch und mit Überblick.";

  function renderQuickQuestions() {
    const questions = quickQuestionsByPage[page] || quickQuestionsByPage.allgemein;
    quick.innerHTML = "";
    questions.forEach((q) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ki-quick-btn";
      btn.textContent = q;
      btn.addEventListener("click", () => {
        input.value = q;
        form.requestSubmit();
      });
      quick.appendChild(btn);
    });
  }

  function addMessage(text, who = "bot") {
    const el = document.createElement("div");
    el.className = `ki-msg ki-msg-${who}`;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function setOpen(open) {
    panel.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) input.focus();
  }

  fab.addEventListener("click", () => {
    mode = detectMode();
    subtitle.textContent =
      mode === "child"
        ? "Ich helfe dir kindgerecht und freundlich."
        : "Ich helfe dir freundlich, praktisch und mit Überblick.";
    setOpen(true);
  });

  closeBtn.addEventListener("click", () => setOpen(false));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const message = input.value.trim();
    if (!message) return;

    mode = detectMode();

    addMessage(message, "user");
    input.value = "";
    addMessage("Ich denke kurz nach…", "bot");

    const typingBubble = messages.lastElementChild;

    try {
      const response = await fetch("/.netlify/functions/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message,
          page,
          mode
        })
      });

      const data = await response.json();
      typingBubble.remove();
      addMessage(data.reply || "Ich konnte gerade nichts Sinnvolles antworten.", "bot");
    } catch (error) {
      typingBubble.remove();
      addMessage("Ups, ich konnte gerade keine Verbindung herstellen.", "bot");
      console.error(error);
    }
  });

  renderQuickQuestions();
})();
