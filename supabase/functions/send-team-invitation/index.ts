import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://rehabot.vercel.app";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const { token, email, teamName, inviterName } = await req.json();

    if (!token || !email || !teamName || !inviterName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const registrationLink = `${APP_URL}/registro?invitation=${token}`;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitación a RehabOT</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#1a1a2e;padding:28px 40px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">RehabOT</p>
              <p style="margin:4px 0 0;font-size:11px;color:#8888aa;letter-spacing:2px;text-transform:uppercase;">Plataforma de Terapia Ocupacional</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1a1a2e;">Te invitaron a unirse a un equipo</p>
              <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">
                <strong>${inviterName}</strong> te invitó a unirte al equipo <strong>${teamName}</strong> en RehabOT.
                Aceptá la invitación creando tu cuenta con el botón de abajo.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:6px;background:#1a1a2e;">
                    <a href="${registrationLink}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">
                      Aceptar invitación
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#888;line-height:1.5;">
                Si el botón no funciona, copiá este enlace en tu navegador:<br />
                <a href="${registrationLink}" style="color:#1a1a2e;word-break:break-all;">${registrationLink}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #eee;margin:0;" /></td>
          </tr>
          <tr>
            <td style="padding:20px 40px 28px;">
              <p style="margin:0;font-size:12px;color:#aaa;line-height:1.6;">
                Este enlace expira en 7 días. Si no esperabas esta invitación, podés ignorar este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RehabOT <onboarding@resend.dev>",
        to: [email],
        subject: `Te invitaron a unirse a ${teamName} en RehabOT`,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Resend error:", errBody);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("send-team-invitation error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
