exports.handler = async function(event) {
  const data = JSON.parse(event.body || "{}");

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      reply: "💬 Du hast gesagt: " + (data.message || "")
    })
  };
};
