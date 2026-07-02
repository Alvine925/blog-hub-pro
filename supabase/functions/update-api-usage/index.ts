/**
 * update-api-usage — aggregate today's API request counts into analytics_daily.
 *
 * Call on a schedule (e.g. every 15 minutes via pg_cron or an external cron).
 * Only callable with the service-role key.
 *
 * POST https://<project>.supabase.co/functions/v1/update-api-usage
 * Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *
 * What it does:
 *   1. For each workspace, count today's rows in api_request_logs.
 *   2. Upsert into analytics_daily (workspace_id, stat_date).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("authorization") ?? "";

  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401, headers: CORS },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(supabaseUrl, serviceKey);

    // Today in UTC
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const dayStart = `${today}T00:00:00.000Z`;
    const dayEnd = `${today}T23:59:59.999Z`;

    // Get all workspaces
    const { data: workspaces, error: wsErr } = await db
      .from("workspaces")
      .select("id");

    if (wsErr || !workspaces) {
      return Response.json(
        { success: false, error: { code: "DB_ERROR", message: wsErr?.message ?? "Could not load workspaces" } },
        { status: 500, headers: CORS },
      );
    }

    let updated = 0;
    const errors: string[] = [];

    for (const ws of workspaces) {
      try {
        // Total requests today
        const { count: totalRequests } = await db
          .from("api_request_logs")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", ws.id)
          .gte("requested_at", dayStart)
          .lte("requested_at", dayEnd);

        // Error requests today (status >= 400)
        const { count: errorRequests } = await db
          .from("api_request_logs")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", ws.id)
          .gte("requested_at", dayStart)
          .lte("requested_at", dayEnd)
          .gte("status_code", 400);

        await db.from("analytics_daily").upsert(
          {
            workspace_id: ws.id,
            stat_date: today,
            api_requests: totalRequests ?? 0,
            api_errors: errorRequests ?? 0,
          },
          { onConflict: "workspace_id,stat_date" },
        );

        updated++;
      } catch (err) {
        errors.push(`workspace ${ws.id}: ${String(err)}`);
      }
    }

    return Response.json(
      {
        success: true,
        data: { date: today, workspacesUpdated: updated, errors },
      },
      { headers: CORS },
    );
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: String(err) },
      },
      { status: 500, headers: CORS },
    );
  }
});
