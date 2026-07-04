/**
 * send-transactional-email — Brevo-backed transactional email for Lunar CMS.
 *
 * Types:
 *   welcome          — new platform user signed up
 *   welcome_invited  — invited user set their permanent password
 *   member_login     — notify workspace admin(s) that an invitee first logged in
 *   comment          — notify workspace admins/editors of a new blog comment
 *
 * Payload:
 *   { type, to: [{ email, name? }], data: { ...type-specific } }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EmailType = "welcome" | "welcome_invited" | "member_login" | "comment";

interface Recipient { email: string; name?: string }

interface Payload {
  type: EmailType;
  to: Recipient[];
  data: Record<string, unknown>;
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Only the service-role key may call this function — it is an internal-only endpoint
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader  = req.headers.get("authorization") ?? "";
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "content-type": "application/json" },
    });
  }

  try {
    const payload: Payload = await req.json();
    const { type, to, data } = payload;

    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    const SENDER_EMAIL  = Deno.env.get("BREVO_SENDER_EMAIL") ?? "noreply@lunarcms.io";
    const SENDER_NAME   = "Lunar CMS";

    if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not configured");
    if (!Array.isArray(to) || !to.length) throw new Error("No recipients supplied");

    const { subject, html } = buildEmail(type, data, to[0]);

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: to.map((r) => ({ email: r.email, name: r.name || r.email.split("@")[0] })),
        subject,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Brevo error (${res.status}): ${body}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[send-transactional-email]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});

// ── Email builder ─────────────────────────────────────────────────────────────

function buildEmail(
  type: EmailType,
  data: Record<string, unknown>,
  primaryRecipient: Recipient,
): { subject: string; html: string } {
  const loginUrl = (data.loginUrl as string) || "https://app.lunarcms.io/login";

  switch (type) {
    case "welcome":
      return buildWelcome(primaryRecipient, loginUrl);
    case "welcome_invited":
      return buildWelcomeInvited(primaryRecipient, data);
    case "member_login":
      return buildMemberLogin(data, loginUrl);
    case "comment":
      return buildCommentNotification(data);
    default:
      throw new Error(`Unknown email type: ${type}`);
  }
}

// ── Template: welcome (new organic signup) ────────────────────────────────────

function buildWelcome(recipient: Recipient, loginUrl: string) {
  const name = recipient.name || recipient.email.split("@")[0];
  return {
    subject: "Welcome to Lunar CMS 🌙",
    html: layout(`
      <h1 style="margin:0 0 16px;font-size:32px;font-weight:800;line-height:1.2;letter-spacing:-.6px;color:#0a0a0a;">
        Welcome, ${esc(name)}.
      </h1>
      <p style="margin:0 0 40px;font-size:17px;line-height:1.65;color:#555555;">
        Your Lunar CMS account is ready. You're a few clicks away from publishing your first piece of content.
      </p>
      ${divider()}
      ${section("What's next", `
        <ul style="margin:0;padding-left:20px;font-size:15px;line-height:2;color:#555555;">
          <li>Complete your workspace setup</li>
          <li>Invite team members</li>
          <li>Connect your content via API</li>
        </ul>
      `)}
      ${cta("Go to your dashboard →", loginUrl)}
      ${divider()}
      <p style="margin:0;font-size:13px;line-height:1.65;color:#aaaaaa;">
        If you didn't create this account, you can safely ignore this email.
      </p>
    `),
  };
}

// ── Template: welcome_invited (invited user set their password) ───────────────

function buildWelcomeInvited(recipient: Recipient, data: Record<string, unknown>) {
  const name = recipient.name || recipient.email.split("@")[0];
  const workspaceName = (data.workspaceName as string) || "your workspace";
  const dashboardUrl = (data.dashboardUrl as string) || "https://app.lunarcms.io/";
  return {
    subject: `You're all set — welcome to ${workspaceName}`,
    html: layout(`
      <h1 style="margin:0 0 16px;font-size:32px;font-weight:800;line-height:1.2;letter-spacing:-.6px;color:#0a0a0a;">
        You're in, ${esc(name)}.
      </h1>
      <p style="margin:0 0 40px;font-size:17px;line-height:1.65;color:#555555;">
        Your account is set up and you've joined <strong style="color:#0a0a0a;">${esc(workspaceName)}</strong>.
        Your password is saved — use it every time you sign in.
      </p>
      ${cta("Go to your workspace →", dashboardUrl)}
      ${divider()}
      <p style="margin:0;font-size:13px;line-height:1.65;color:#aaaaaa;">
        If you didn't expect this, please contact your workspace administrator.
      </p>
    `),
  };
}

// ── Template: member_login (admin notification) ───────────────────────────────

function buildMemberLogin(data: Record<string, unknown>, loginUrl: string) {
  const memberName  = esc((data.memberName  as string) || "A team member");
  const memberEmail = esc((data.memberEmail as string) || "");
  const workspaceName = esc((data.workspaceName as string) || "your workspace");
  const dashboardUrl = (data.dashboardUrl as string) || loginUrl;
  return {
    subject: `${memberName} accepted their invitation to ${workspaceName}`,
    html: layout(`
      <h1 style="margin:0 0 16px;font-size:32px;font-weight:800;line-height:1.2;letter-spacing:-.6px;color:#0a0a0a;">
        Your invite was accepted.
      </h1>
      <p style="margin:0 0 40px;font-size:17px;line-height:1.65;color:#555555;">
        <strong style="color:#0a0a0a;">${memberName}</strong>${memberEmail ? ` (${memberEmail})` : ""}
        has set their password and joined <strong style="color:#0a0a0a;">${workspaceName}</strong>.
      </p>
      ${cta("View team members →", dashboardUrl)}
      ${divider()}
      <p style="margin:0;font-size:13px;line-height:1.65;color:#aaaaaa;">
        You're receiving this because you're a workspace admin on Lunar CMS.
      </p>
    `),
  };
}

// ── Template: comment (admin/editor notification) ─────────────────────────────

function buildCommentNotification(data: Record<string, unknown>) {
  const authorName     = esc((data.authorName     as string) || "Someone");
  const postTitle      = esc((data.postTitle      as string) || "a post");
  const commentContent = esc((data.commentContent as string) || "");
  const moderateUrl    = (data.moderateUrl as string) || "https://app.lunarcms.io/admin/comments";
  return {
    subject: `New comment on "${(data.postTitle as string) || "a post"}"`,
    html: layout(`
      <h1 style="margin:0 0 16px;font-size:32px;font-weight:800;line-height:1.2;letter-spacing:-.6px;color:#0a0a0a;">
        New comment received.
      </h1>
      <p style="margin:0 0 32px;font-size:17px;line-height:1.65;color:#555555;">
        <strong style="color:#0a0a0a;">${authorName}</strong> left a comment on
        <strong style="color:#0a0a0a;">${postTitle}</strong>.
      </p>
      ${divider()}
      <p style="margin:24px 0;font-size:15px;line-height:1.7;color:#333333;font-style:italic;padding:16px 20px;background:#f8f8f8;border-left:3px solid #e0e0e0;border-radius:0 6px 6px 0;">
        "${commentContent.length > 300 ? commentContent.slice(0, 300) + "…" : commentContent}"
      </p>
      ${divider()}
      ${cta("Review & moderate →", moderateUrl)}
      <p style="margin:24px 0 0;font-size:13px;line-height:1.65;color:#aaaaaa;">
        Comments are held for approval by default. You're receiving this because you're an admin or editor on this workspace.
      </p>
    `),
  };
}

// ── Shared layout helpers ─────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function divider(): string {
  return `<div style="height:1px;background:#ebebeb;margin:32px 0;"></div>`;
}

function section(label: string, content: string): string {
  return `
    <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#aaaaaa;">${label}</p>
    ${content}
    <div style="height:32px;"></div>
  `;
}

function cta(label: string, url: string): string {
  return `
    <a href="${url}" style="display:inline-block;background:#0a0a0a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;letter-spacing:-.1px;margin-bottom:40px;">
      ${label}
    </a>
  `;
}

function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;">
  <tr>
    <td align="center" style="padding:56px 24px 64px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;">
        <tr>
          <td style="padding-bottom:48px;">
            <span style="font-size:14px;font-weight:700;letter-spacing:-.2px;color:#0a0a0a;">
              &#9789;&nbsp;&nbsp;Lunar CMS
            </span>
          </td>
        </tr>
        <tr>
          <td>
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding-top:40px;">
            <p style="margin:0;font-size:12px;color:#cccccc;">Lunar CMS &middot; Sent automatically</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
