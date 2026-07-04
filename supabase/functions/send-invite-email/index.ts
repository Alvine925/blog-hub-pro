import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  email: string;
  name?: string;
  tempPassword: string;
  loginUrl: string;
  workspaceName?: string;
  inviterName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const payload: Payload = await req.json();
    const { email, name, tempPassword, loginUrl, workspaceName, inviterName } = payload;

    const BREVO_API_KEY   = Deno.env.get("BREVO_API_KEY");
    const SENDER_EMAIL    = Deno.env.get("BREVO_SENDER_EMAIL") ?? "noreply@lunarcms.io";
    const SENDER_NAME     = "Lunar CMS";

    if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY secret not set in Supabase project");

    const displayName = name || email.split("@")[0];
    const subject     = workspaceName
      ? `You've been invited to ${workspaceName} on Lunar CMS`
      : "You've been invited to Lunar CMS";

    const html = buildEmail({ displayName, email, tempPassword, loginUrl, workspaceName, inviterName });

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to:     [{ email, name: displayName }],
        subject,
        htmlContent: html,
      }),
    });

    if (!res.ok) throw new Error(`Brevo error: ${await res.text()}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[send-invite-email]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});

function buildEmail(opts: {
  displayName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
  workspaceName?: string;
  inviterName?: string;
}): string {
  const { displayName, email, tempPassword, loginUrl, workspaceName, inviterName } = opts;

  const contextLine = inviterName
    ? `${inviterName} has invited you to join${workspaceName ? ` <strong style="color:#111;">${workspaceName}</strong> on` : ""} Lunar CMS.`
    : `You've been invited to join${workspaceName ? ` <strong style="color:#111;">${workspaceName}</strong> on` : ""} Lunar CMS.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${workspaceName ? `Invited to ${workspaceName}` : "Invited to Lunar CMS"}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f5f5f3;padding:48px 16px;">
  <tr><td align="center">

    <!-- Card -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);">
      <tr>
        <td style="padding:44px 48px 0;">

          <!-- Wordmark -->
          <p style="margin:0 0 36px;font-size:15px;font-weight:700;letter-spacing:-.3px;color:#111;">
            ☽&nbsp;&nbsp;Lunar CMS
          </p>

          <!-- Headline -->
          <h1 style="margin:0 0 10px;font-size:28px;font-weight:800;line-height:1.25;letter-spacing:-.5px;color:#111;">
            Hi, ${displayName}.
          </h1>
          <p style="margin:0 0 36px;font-size:16px;line-height:1.65;color:#555;">
            ${contextLine}
          </p>

          <!-- Divider -->
          <hr style="border:none;border-top:1px solid #ebebeb;margin:0 0 36px;" />

          <!-- Credentials block -->
          <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#aaa;">
            Your login credentials
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:36px;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
                <span style="font-size:13px;color:#aaa;display:inline-block;width:90px;">Email</span>
                <span style="font-size:14px;color:#111;font-weight:500;">${email}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 0;">
                <span style="font-size:13px;color:#aaa;display:inline-block;width:90px;">Password</span>
                <code style="font-size:14px;color:#111;font-weight:600;background:#f5f5f3;padding:3px 10px;border-radius:6px;letter-spacing:.05em;">${tempPassword}</code>
              </td>
            </tr>
          </table>

          <!-- CTA -->
          <a href="${loginUrl}"
             style="display:inline-block;background:#111;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:15px 30px;border-radius:10px;letter-spacing:-.1px;margin-bottom:44px;">
            Sign in to Lunar CMS &rarr;
          </a>

        </td>
      </tr>

      <!-- Bottom note -->
      <tr>
        <td style="padding:24px 48px;background:#fafaf9;border-top:1px solid #ebebeb;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#aaa;">
            You'll be prompted to set a new password on your first sign-in.
            If you weren't expecting this, you can safely ignore this email.
          </p>
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <p style="margin:24px 0 0;font-size:12px;color:#ccc;text-align:center;">
      Lunar CMS &middot; Sent by invite only
    </p>

  </td></tr>
</table>
</body>
</html>`;
}
