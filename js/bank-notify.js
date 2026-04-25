export default async (req) => {
  try {
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ ok: false, error: 'Ungültige E-Mail' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // E-Mail über Netlify Forms speichern (kein externer Dienst nötig)
    // Alternativ: Sende mit SendGrid/Mailgun wenn API-Key vorhanden
    const SENDGRID_KEY = process.env.SENDGRID_API_KEY;

    if (SENDGRID_KEY) {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + SENDGRID_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email }] }],
          from: { email: 'noreply@haushaltsheld.de', name: 'Haushaltsheld' },
          subject: '🏦 Du wirst benachrichtigt – Bank-Verbindung kommt bald!',
          content: [{
            type: 'text/html',
            value: `
              <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
                <h2>🐌 Hallo!</h2>
                <p>Vielen Dank für dein Interesse an der <strong>Haushaltsheld Bank-Verbindung</strong>.</p>
                <p>Wir benachrichtigen dich unter <strong>${email}</strong> sobald die Bank-API verfügbar ist.</p>
                <p>Bis dahin kannst du Kontoauszüge manuell als PDF oder CSV hochladen.</p>
                <br>
                <p>Dein Haushaltsheld Team 🏠</p>
              </div>
            `
          }]
        })
      });
    }

    // E-Mail in Netlify Environment-Variable-ähnlichem Speicher (Logs)
    console.log('Bank notify signup:', email, new Date().toISOString());

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
