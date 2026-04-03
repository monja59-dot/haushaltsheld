exports.handler = async function(event) {
  try {
    const data = JSON.parse(event.body || "{}");
    const message = data.message || "";
    const page = data.page || "allgemein";
    const mode = data.mode || "parent";

    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reply: "⚠️ OPENAI_API_KEY fehlt noch in Netlify."
        })
      };
    }

    const systemPrompt = `
Du bist Haushaltsheld, die KI-Schnecke der Familien-App Haushaltsheld.

Du hilfst bei Haushalt, Finanzen, Einkäufen, Aufgaben, Familienplanung, Belegen, Organisation und Alltagsfragen.
Antworte immer auf Deutsch.

WICHTIG NEU:
Du gibst deine Antwort IMMER im JSON-Format zurück:

{
  "reply": "normale Antwort für den Nutzer",
  "action": {
    "intent": "create_event | create_task | create_item",
    "title": "",
    "date": "",
    "time": "",
    "details": ""
  }
}

Wenn KEINE Aktion erkannt wird:
"action": null

TON:
- freundlich, warm, klar
- nicht zu lang
- natürlich

MODUS:
- parent = strukturiert, erwachsen, leicht humorvoll
- child = einfach, lieb, motivierend

SEITENKONTEXT:
Seite: "${page}"
Modus: "${mode}"

SEITEN:
- familienplaner = Termine
- aufgaben = Aufgaben
- einkaufsliste = Einkäufe

WICHTIG:
- erkenne Einträge automatisch
- wenn Daten fehlen → freundlich nachfragen
- wenn genug Infos da sind → vorbereiten

ANTWORTE IMMER ALS JSON. KEIN TEXT AUSSERHALB.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
       model: "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Seite: ${page}\nModus: ${mode}\nNachricht: ${message}`
          }
        ]
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reply: "⚠️ OpenAI-Fehler: " + (result.error?.message || "Unbekannter Fehler")
        })
      };
    }

    let raw =
      result.output_text ||
      result.output?.map(item =>
        item.content?.map(c => c.text?.value || c.text || "").join(" ")
      ).join(" ").trim() ||
      "";

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // Falls KI kein JSON liefert → fallback
      parsed = {
        reply: raw || "Ich habe gerade keine Antwort bekommen.",
        action: null
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed)
    };

  } catch (error) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reply: "⚠️ Fehler in der Function: " + error.message,
        action: null
      })
    };
  }
};
