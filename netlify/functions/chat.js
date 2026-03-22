exports.handler = async function(event) {
  try {
    const data = JSON.parse(event.body || "{}");
    const message = data.message || "";

    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reply: "⚠️ OPENAI_API_KEY fehlt noch in Netlify."
        })
      };
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5.4",
        input: [
          {
            role: "system",
            content: "Du bist Haushaltsheld, ein freundlicher und praktischer Assistent für Haushalt, Sparen, Putzen, Organisation und Alltag. Antworte auf Deutsch, klar, hilfreich und motivierend."
          },
          {
            role: "user",
            content: message
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

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reply: result.output_text || "Ich habe gerade keine Antwort bekommen."
      })
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reply: "⚠️ Fehler in der Function: " + error.message
      })
    };
  }
};
