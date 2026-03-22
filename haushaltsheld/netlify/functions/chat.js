exports.handler = async function(event) {
  const { message } = JSON.parse(event.body);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + process.env.OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Du bist eine freundliche Spar-Schnecke und gibst einfache Tipps zum Geld sparen."
        },
        {
          role: "user",
          content: message
        }
      ]
    })
  });

  const data = await response.json();

  return {
    statusCode: 200,
    body: JSON.stringify({
      reply: data.choices?.[0]?.message?.content || "Ich konnte gerade leider nicht antworten."
    })
  };
};
