import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPPORT_EMAIL = "support@stellarsync.app";
const ADMIN_EMAIL = "cassandre.arkema@gmail.com";
const RESPONSE_TIME = "48 hours";

function escapeHtml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isUsableEmail(value: string) {
  return Boolean(value && value !== "Not provided" && value.includes("@"));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase service secrets" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    const name = String(body.name || "Unknown").trim();
    const organization = String(body.organization || "Not provided").trim();
    const email = String(body.email || "Not provided").trim();
    const website = String(body.website || "Not provided").trim();
    const teamSize = String(body.team_size || "Not provided").trim();
    const planInterest = String(body.plan_interest || "General inquiry").trim();
    const message = String(body.message || "No message provided").trim();

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: submission, error: insertError } = await supabase
      .from("contact_submissions")
      .insert({
        name,
        organization,
        email,
        website,
        team_size: teamSize,
        plan_interest: planInterest,
        message,
        status: "new",
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({
          error: "Failed to save contact submission",
          details: insertError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const safeName = escapeHtml(name);
    const safeOrganization = escapeHtml(organization);
    const safeEmail = escapeHtml(email);
    const safeWebsite = escapeHtml(website);
    const safeTeamSize = escapeHtml(teamSize);
    const safePlanInterest = escapeHtml(planInterest);
    const safeMessage = escapeHtml(message).replaceAll("\n", "<br>");

    const adminEmailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `StellarSync <${SUPPORT_EMAIL}>`,
        to: [ADMIN_EMAIL],
        reply_to: isUsableEmail(email) ? email : undefined,
        subject: `New StellarSync inquiry: ${planInterest}`,
        html: `
<!doctype html>
<html>
  <body style="margin:0; padding:0; background:#0a0612; font-family:Inter, Arial, sans-serif; color:#e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0a0612; padding:40px 16px;">
      <tr><td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px; background:#120c1d; border:1px solid rgba(255,255,255,0.08); border-radius:24px; overflow:hidden;">
          <tr><td style="padding:32px 32px 12px; text-align:center;">
            <img src="https://stellarsync.app/icon/stellarsync-192.png?v=1" alt="StellarSync" width="56" height="56" style="display:block; margin:0 auto 18px; border-radius:16px;">
            <div style="font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#c77dff;margin-bottom:10px;">StellarSync</div>
            <h1 style="margin:0; font-size:28px; line-height:1.15; color:#ffffff; font-weight:800;">New StellarSync inquiry</h1>
            <p style="margin:14px 0 0; color:#94a3b8; font-size:15px; line-height:1.6;">Someone submitted the StellarSync contact form.</p>
          </td></tr>

          <tr><td style="padding:28px 32px;">
            <div style="background:#181125; border:1px solid rgba(255,255,255,0.06); border-radius:18px; padding:18px;">
              <p style="margin:0 0 12px; color:#c4b5fd; font-size:13px; font-weight:700;">Inquiry details</p>
              <p style="margin:0 0 8px; color:#94a3b8; font-size:13px;"><strong style="color:#ffffff;">Submission ID:</strong> ${submission?.id || "-"}</p>
              <p style="margin:0 0 8px; color:#94a3b8; font-size:13px;"><strong style="color:#ffffff;">Name:</strong> ${safeName}</p>
              <p style="margin:0 0 8px; color:#94a3b8; font-size:13px;"><strong style="color:#ffffff;">Organization:</strong> ${safeOrganization}</p>
              <p style="margin:0 0 8px; color:#94a3b8; font-size:13px;"><strong style="color:#ffffff;">Email:</strong> ${safeEmail}</p>
              <p style="margin:0 0 8px; color:#94a3b8; font-size:13px;"><strong style="color:#ffffff;">Website:</strong> ${safeWebsite}</p>
              <p style="margin:0 0 8px; color:#94a3b8; font-size:13px;"><strong style="color:#ffffff;">Team size:</strong> ${safeTeamSize}</p>
              <p style="margin:0; color:#94a3b8; font-size:13px;"><strong style="color:#ffffff;">Plan interest:</strong> ${safePlanInterest}</p>
            </div>
          </td></tr>

          <tr><td style="padding:0 32px 28px;">
            <div style="background:#0a0612; border:1px solid rgba(199,125,255,0.18); border-radius:18px; padding:18px;">
              <p style="margin:0 0 8px; color:#c4b5fd; font-size:13px; font-weight:700;">Message</p>
              <p style="margin:0; color:#e2e8f0; font-size:14px; line-height:1.7;">${safeMessage}</p>
            </div>
          </td></tr>

          <tr><td style="padding:0 32px 32px; text-align:center;">
            <p style="margin:0; color:#64748b; font-size:12px;">Reply directly to this email to respond to ${safeName}.</p>
          </td></tr>
        </table>

        <p style="margin:20px 0 0; color:#475569; font-size:11px;">StellarSync · Content operating system for mission-driven organizations</p>
      </td></tr>
    </table>
  </body>
</html>
        `,
      }),
    });

    const adminEmailText = await adminEmailResponse.text();

    if (!adminEmailResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Contact submission saved, but admin email notification failed",
          submission_id: submission?.id,
          resend_response: adminEmailText,
        }),
        {
          status: adminEmailResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let autoReplySent = false;

    if (isUsableEmail(email)) {
      const autoReplyResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `StellarSync <${SUPPORT_EMAIL}>`,
          to: [email],
          reply_to: ADMIN_EMAIL,
          subject: "We've received your StellarSync inquiry",
          html: `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0a0612;font-family:Inter,Arial,sans-serif;color:#e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0a0612;padding:40px 16px;">
      <tr><td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#120c1d;border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">
          <tr><td style="padding:32px 32px 12px;text-align:center;">
            <img src="https://stellarsync.app/icon/stellarsync-192.png?v=1" alt="StellarSync" width="56" height="56" style="display:block;margin:0 auto 18px;border-radius:16px;">
            <div style="font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#c77dff;margin-bottom:10px;">StellarSync</div>
            <h1 style="margin:0;font-size:28px;line-height:1.15;color:#ffffff;font-weight:800;">Thanks for reaching out</h1>
            <p style="margin:14px 0 0;color:#94a3b8;font-size:15px;line-height:1.6;">We've received your message and will review it shortly.</p>
          </td></tr>

          <tr><td style="padding:0 32px 28px;">
            <div style="background:#181125;border:1px solid rgba(255,255,255,0.06);border-radius:18px;padding:18px;">
              <p style="margin:0;color:#c4b5fd;font-size:13px;font-weight:700;">What happens next?</p>
              <p style="margin:8px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">A member of the StellarSync team will review your inquiry and get back to you within ${RESPONSE_TIME}.</p>
            </div>
          </td></tr>

          <tr><td style="padding:0 32px 32px;text-align:center;">
            <p style="margin:0;color:#64748b;font-size:12px;">If you need to add additional information, simply reply to this email.</p>
          </td></tr>
        </table>

        <p style="margin:20px 0 0;color:#475569;font-size:11px;">StellarSync · Content operating system for mission-driven organizations</p>
      </td></tr>
    </table>
  </body>
</html>
          `,
        }),
      });

      autoReplySent = autoReplyResponse.ok;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Contact request saved and sent.",
        submission_id: submission?.id,
        auto_reply_sent: autoReplySent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Unexpected contact form error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});