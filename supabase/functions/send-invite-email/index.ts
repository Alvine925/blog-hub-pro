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

    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    const SENDER_EMAIL  = Deno.env.get("BREVO_SENDER_EMAIL") ?? "noreply@lunarcms.io";
    const SENDER_NAME   = "Lunar CMS";

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
    ? `${inviterName} has invited you to join${workspaceName ? ` <strong style="color:#0a0a0a;">${workspaceName}</strong> on` : ""} Lunar CMS.`
    : `You've been invited to join${workspaceName ? ` <strong style="color:#0a0a0a;">${workspaceName}</strong> on` : ""} Lunar CMS.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${workspaceName ? `Invited to ${workspaceName}` : "Invited to Lunar CMS"}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;">
  <tr>
    <td align="center" style="padding:56px 24px 64px;">

      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;">

        <!-- Wordmark -->
        <tr>
          <td style="padding-bottom:48px;">
            <span style="font-size:14px;font-weight:700;letter-spacing:-.2px;color:#0a0a0a;">
              &#9789;&nbsp;&nbsp;Lunar CMS
            </span>
          </td>
        </tr>

        <!-- Headline -->
        <tr>
          <td style="padding-bottom:16px;">
            <h1 style="margin:0;font-size:32px;font-weight:800;line-height:1.2;letter-spacing:-.6px;color:#0a0a0a;">
              Hi, ${displayName}.
            </h1>
          </td>
        </tr>

        <!-- Context -->
        <tr>
          <td style="padding-bottom:48px;">
            <p style="margin:0;font-size:17px;line-height:1.65;color:#555555;">
              ${contextLine}<br />
              Your account is ready. Use the credentials below to sign in.
            </p>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding-bottom:32px;">
            <div style="height:1px;background:#ebebeb;"></div>
          </td>
        </tr>

        <!-- Credentials label -->
        <tr>
          <td style="padding-bottom:20px;">
            <span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#aaaaaa;">
              Your login credentials
            </span>
          </td>
        </tr>

        <!-- Email row -->
        <tr>
          <td style="padding-bottom:0;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="border-top:1px solid #f0f0f0;">
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid #f0f0f0;">
                  <span style="font-size:12px;color:#aaaaaa;display:inline-block;width:80px;vertical-align:middle;">
                    Email
                  </span>
                  <span style="font-size:14px;color:#0a0a0a;font-weight:500;vertical-align:middle;">
                    ${email}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0;border-bottom:1px solid #f0f0f0;">
                  <span style="font-size:12px;color:#aaaaaa;display:inline-block;width:80px;vertical-align:middle;">
                    Password
                  </span>
                  <code style="font-size:14px;color:#0a0a0a;font-weight:600;font-family:'SF Mono',Menlo,Monaco,Consolas,monospace;letter-spacing:.04em;vertical-align:middle;">
                    ${tempPassword}
                  </code>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Spacer -->
        <tr><td style="height:40px;"></td></tr>

        <!-- CTA -->
        <tr>
          <td style="padding-bottom:48px;">
            <a href="${loginUrl}"
               style="display:inline-block;background:#0a0a0a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;letter-spacing:-.1px;">
              Sign in to Lunar CMS &rarr;
            </a>
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding-bottom:32px;">
            <div style="height:1px;background:#ebebeb;"></div>
          </td>
        </tr>

        <!-- Footer note -->
        <tr>
          <td>
            <p style="margin:0;font-size:13px;line-height:1.65;color:#aaaaaa;">
              You'll be asked to set a new password on your first sign-in.
              If you weren't expecting this invitation, you can safely ignore this email.
            </p>
          </td>
        </tr>

        <!-- Footer brand -->
        <tr>
          <td style="padding-top:40px;">
            <p style="margin:0;font-size:12px;color:#cccccc;">
              Lunar CMS &middot; Sent by invite only
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}
