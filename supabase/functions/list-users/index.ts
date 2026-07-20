import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user token to verify caller
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller using their JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: userError } = await userClient.auth.getUser();
    if (userError || !caller) {
      console.error("Error getting caller user:", userError);
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is super_admin or admin
    const { data: callerRole, error: roleError } = await userClient.rpc("get_user_role", {
      _user_id: caller.id,
    });

    if (roleError || !callerRole || !["super_admin", "admin"].includes(callerRole)) {
      console.error("Caller is not authorized:", callerRole, roleError);
      return new Response(
        JSON.stringify({ error: "Apenas Super Administradores e Administradores podem listar usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for managing users
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // List all users
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(
        JSON.stringify({ error: "Erro ao listar usuários" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profiles for names
    const { data: profilesData } = await adminClient
      .from("user_profiles")
      .select("user_id, name");

    const profilesByUserId: Record<string, string> = {};
    (profilesData || []).forEach((profile: { user_id: string; name: string }) => {
      profilesByUserId[profile.user_id] = profile.name;
    });

    // Escopo do chamador (para role='admin' restringir aos usuários com sistemas em comum)
    let visibleIds: Set<string> | null = null;
    if (callerRole === "admin") {
      const { data: mySystems } = await adminClient
        .from("system_access")
        .select("system_name")
        .eq("user_id", caller.id)
        .eq("permission_type", "view_edit");
      const scope = new Set((mySystems || []).map((r: any) => r.system_name));

      const { data: allAccess } = await adminClient
        .from("system_access")
        .select("user_id, system_name");
      const inScope = new Set<string>();
      (allAccess || []).forEach((r: any) => {
        if (scope.has(r.system_name)) inScope.add(r.user_id);
      });

      const { data: superRoles } = await adminClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      const superIds = new Set((superRoles || []).map((r: any) => r.user_id));

      visibleIds = new Set<string>([caller.id]);
      inScope.forEach((id) => {
        if (!superIds.has(id)) visibleIds!.add(id);
      });
    }

    const filteredUsers = visibleIds
      ? usersData.users.filter((u) => visibleIds!.has(u.id))
      : usersData.users;

    console.log(`Found ${filteredUsers.length} users (of ${usersData.users.length}) for caller role ${callerRole}`);

    // Map users to return only necessary data
    const users = filteredUsers.map((user) => ({
      id: user.id,
      email: user.email,
      name: profilesByUserId[user.id] || null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      confirmed: !!user.email_confirmed_at,
      email_confirmed_at: user.email_confirmed_at,
      invited_at: user.invited_at,
      user_metadata: user.user_metadata,
    }));

    return new Response(
      JSON.stringify({ users, callerRole }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
