import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// Edge Function : unipile-webhook
// V11: Parse le format "userId::workspaceId" envoyé par generate-unipile-link v22
//      Associe le compte au bon workspace
//      Met le status à "pending_consent" pour que la modal s'affiche
//
// BUG FIX: v10 ne parsait pas le format "userId::workspaceId" du champ name
//          envoyé par generate-unipile-link v22, causant un échec de FK
//          et empêchant la création du connected_account
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("[unipile-webhook v11] Received:", JSON.stringify(body));

    const { account_id, name: rawName } = body;

    if (!account_id || !rawName) {
      console.error("[unipile-webhook] Missing account_id or name");
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ----------------------------------------------------------
    // 0. Parser le champ name : format "userId::workspaceId" ou simple "userId"
    //    generate-unipile-link v22 envoie "userId::workspaceId"
    // ----------------------------------------------------------
    let userId: string;
    let workspaceId: string | null = null;

    if (rawName.includes('::')) {
      const parts = rawName.split('::');
      userId = parts[0];
      workspaceId = parts[1] || null;
      console.log(`[unipile-webhook] Parsed name: userId=${userId}, workspaceId=${workspaceId}`);
    } else {
      userId = rawName;
      console.log(`[unipile-webhook] Simple name format: userId=${userId}`);
    }

    // Validation basique du format UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error(`[unipile-webhook] Invalid userId format: ${userId}`);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid userId format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (workspaceId && !uuidRegex.test(workspaceId)) {
      console.warn(`[unipile-webhook] Invalid workspaceId format, ignoring: ${workspaceId}`);
      workspaceId = null;
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const UNIPILE_API_KEY = Deno.env.get("UNIPILE_API_KEY");
    const UNIPILE_DSN = Deno.env.get("UNIPILE_DSN");

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // ----------------------------------------------------------
    // 1. Récupérer les détails du compte depuis Unipile
    // ----------------------------------------------------------
    let email: string | null = null;
    let provider: string = "IMAP";
    let displayName: string | null = null;

    if (UNIPILE_API_KEY && UNIPILE_DSN) {
      try {
        const accountResponse = await fetch(
          `https://${UNIPILE_DSN}/api/v1/accounts/${account_id}`,
          {
            method: "GET",
            headers: {
              "Accept": "application/json",
              "X-API-KEY": UNIPILE_API_KEY,
            },
          }
        );

        if (accountResponse.ok) {
          const accountData = await accountResponse.json();
          console.log("[unipile-webhook] Account data:", JSON.stringify(accountData));

          email = accountData.connection_params?.mail?.username 
            || accountData.connection_params?.mail?.id
            || accountData.identifier
            || accountData.email
            || accountData.name 
            || null;
          
          const rawType = accountData.type || accountData.provider || "IMAP";
          provider = rawType.toUpperCase();
          
          if (provider === 'GOOGLE_OAUTH' || provider === 'GMAIL') provider = 'GOOGLE';
          if (provider === 'OUTLOOK_OAUTH' || provider === 'OUTLOOK') provider = 'MICROSOFT';
          if (!['GOOGLE', 'MICROSOFT', 'IMAP'].includes(provider)) {
            provider = 'IMAP';
          }
          
          displayName = accountData.name || email || null;
        } else {
          console.warn("[unipile-webhook] Failed to fetch account:", accountResponse.status);
        }
      } catch (fetchError) {
        console.warn("[unipile-webhook] Error fetching account details:", fetchError);
      }
    }

    console.log(`[unipile-webhook] Inserting: userId=${userId}, workspaceId=${workspaceId}, email=${email}, provider=${provider}`);

    // ----------------------------------------------------------
    // 2. Si pas de workspaceId dans le name, fallback : chercher
    //    le premier workspace où l'user est admin/owner
    // ----------------------------------------------------------
    if (!workspaceId) {
      console.log("[unipile-webhook] No workspaceId in payload, looking up user's workspace...");
      const { data: membership } = await supabaseAdmin
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", userId)
        .in("role", ["admin", "owner"])
        .limit(1)
        .single();

      if (membership) {
        workspaceId = membership.workspace_id;
        console.log(`[unipile-webhook] Fallback workspace found: ${workspaceId}`);
      } else {
        console.warn("[unipile-webhook] No admin/owner workspace found for user");
      }
    }

    // ----------------------------------------------------------
    // 3. Insérer/mettre à jour le compte avec statut "pending_consent"
    //    La modal frontend s'affichera et l'utilisateur devra confirmer
    // ----------------------------------------------------------
    const upsertData: Record<string, unknown> = {
      user_id: userId,
      channel_type: "email",
      provider: provider,
      provider_account_id: account_id,
      email: email,
      display_name: displayName,
      status: "pending_consent",
      connected_at: new Date().toISOString(),
      disconnected_at: null,
    };

    if (workspaceId) {
      upsertData.workspace_id = workspaceId;
    }

    const { data, error: dbError } = await supabaseAdmin
      .from("connected_accounts")
      .upsert(upsertData, { onConflict: "provider_account_id" })
      .select();

    if (dbError) {
      console.error("[unipile-webhook] Database error:", dbError);
      return new Response(
        JSON.stringify({ success: false, error: dbError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[unipile-webhook] SUCCESS - Account registered with pending_consent: ${account_id}, workspace: ${workspaceId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data,
        message: "Account connected, awaiting user consent"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[unipile-webhook] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
