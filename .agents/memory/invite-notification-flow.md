---
name: Invite and notification flow
description: How the invite → set-password → workspace flow works, and how the notification/email system is wired up.
---

# Invite → Set Password → Workspace flow

## Rules
- Invited users always have `password_change_required: true` in `user_metadata` and `cms_users`
- On login, if `password_change_required === true` → redirect to `/set-password` (NOT onboarding)
- `index.tsx` also checks this flag and bounces back to `/set-password` if still set
- `set-password.tsx` calls in order: markPasswordChanged → trackUserLogin → fetch memberships → doSendWelcome → navigate to workspace
- `first` (workspace_id) must be declared BEFORE it's used in the `doSendWelcome` payload (TDZ risk if reordered)

**Why:** Members are pre-existing Supabase users with a temp password; they must bypass onboarding which is for platform admins/superadmins only.

## Existing-user invite safety rule
- `inviteWorkspaceMember` / `invitePlatformUser`: if email already registered in Auth, NEVER reset their password
- Just add them to `workspace_members` as `status: "active"` (they already have their own password)
- `resendWorkspaceInvite`: server-side guard — throw if `member.status !== "pending"` before any password mutation

**Why:** Resetting an active user's password is an account takeover vector.

# Notification + email system

## Edge functions
- `send-transactional-email` — service-role-only (checks `Authorization: Bearer <serviceKey>`)
  - Types: `welcome`, `welcome_invited`, `member_login`, `comment`
  - Called via `supabase.functions.invoke` from server fns, or from other edge fns with service key
- `blog-engagement/services/CommentService.ts` — fires `notifyOnComment` (fire-and-forget) after `submitComment`

## Server functions (workspace-members.functions.ts)
- `trackUserLogin(accessToken)` — verifies JWT, activates pending memberships, inserts in-app notification + sends `member_login` email to workspace admins
- `markPasswordChanged(accessToken)` — verifies JWT, clears `cms_users.password_change_required`
- `sendWelcomeEmail(accessToken, type, ...)` — verifies JWT, derives email server-side (never trusts client-supplied email)

## In-app notifications
- Insert into `notifications` table with `workspace_id` scoped to the workspace
- Type `"member_invited"` for login alerts, `"comment"` for comment alerts
- Existing `admin.notifications.tsx` shows all workspace-scoped notifications

## Authorization rule
- `sendWelcomeEmail` and `trackUserLogin` both require `accessToken` — identity always verified server-side
- `send-transactional-email` edge fn requires service-role key in Authorization header
- Comment notifications from `CommentService.ts` use the existing service-role `getDb()` client
