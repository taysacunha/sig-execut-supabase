import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-dev-key",
};

const DEV_KEY = "S1g.D3v!Sup4b4s3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth via x-dev-key
  const key = req.headers.get("x-dev-key");
  if (key !== DEV_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { action, system_name, feature_name, description, hours, add_hours } = body;

    if (!system_name || !feature_name) {
      return new Response(
        JSON.stringify({ error: "system_name and feature_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "increment") {
      // Find existing and add hours
      const { data: existing } = await supabase
        .from("dev_tracker")
        .select("*")
        .eq("system_name", system_name)
        .eq("feature_name", feature_name)
        .maybeSingle();

      if (!existing) {
        return new Response(
          JSON.stringify({ error: "Feature not found for increment" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newHours = (existing.hours || 0) + (add_hours || 0);
      const { data, error } = await supabase
        .from("dev_tracker")
        .update({ hours: newHours })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upsert") {
      // Check if exists
      const { data: existing } = await supabase
        .from("dev_tracker")
        .select("*")
        .eq("system_name", system_name)
        .eq("feature_name", feature_name)
        .maybeSingle();

      if (existing) {
        const updates: Record<string, unknown> = {};
        if (hours !== undefined) updates.hours = hours;
        if (description !== undefined) updates.description = description;

        const { data, error } = await supabase
          .from("dev_tracker")
          .update(updates)
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, action: "updated", data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const { data, error } = await supabase
          .from("dev_tracker")
          .insert({
            system_name,
            feature_name,
            description: description || null,
            hours: hours || 0,
            cost: 0,
          })
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, action: "created", data }), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'upsert' or 'increment'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
