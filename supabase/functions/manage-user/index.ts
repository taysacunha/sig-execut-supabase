import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AppRole = "super_admin" | "admin" | "manager" | "supervisor" | "collaborator";

interface ManageUserRequest {
  userId: string;
  action: "deactivate" | "reactivate" | "delete" | "update_email" | "update_password";
  email?: string;
  password?: string;
}

// Hierarquia de roles (menor número = maior privilégio)
const roleHierarchy: Record<AppRole, number> = {
  super_admin: 1,
  admin: 2,
  manager: 3,
  supervisor: 4,
  collaborator: 5,
};

function canManageRole(callerRole: AppRole, targetRole: AppRole): boolean {
  // Super admin pode tudo
  if (callerRole === "super_admin") return true;
  
  // Admin pode gerenciar roles de nível igual ou inferior (exceto super_admin)
  if (callerRole === "admin" && targetRole !== "super_admin") {
    return roleHierarchy[callerRole] <= roleHierarchy[targetRole];
  }
  
  return false;
}

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
        JSON.stringify({ error: "Apenas Super Administradores e Administradores podem gerenciar usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { userId, action, email, password }: ManageUserRequest = await req.json();

    if (!userId || !action) {
      return new Response(
        JSON.stringify({ error: "userId e action são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["deactivate", "reactivate", "delete", "update_email", "update_password"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Ação inválida. Use 'deactivate', 'reactivate', 'delete', 'update_email' ou 'update_password'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent self-management for destructive actions only
    // Allow self-update of email and password
    const isSelfAction = userId === caller.id;
    if (isSelfAction && !["update_email", "update_password"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Você não pode gerenciar sua própria conta" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Perfil admin não pode executar ações destrutivas ou alterar e-mail de terceiros.
    // Apenas super_admin pode desativar/reativar/excluir/alterar e-mail alheio.
    if (callerRole === "admin" && !isSelfAction) {
      return new Response(
        JSON.stringify({ error: "Administradores não podem desativar, excluir ou alterar dados de outros usuários. Solicite a um Super Administrador." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get target user's role to check hierarchy
    const { data: targetRoleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (targetRoleData) {
      const targetRole = targetRoleData.role as AppRole;
      if (!canManageRole(callerRole as AppRole, targetRole)) {
        console.error(`Caller ${callerRole} cannot manage ${targetRole}`);
        return new Response(
          JSON.stringify({ error: "Você não tem permissão para gerenciar este usuário" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`Admin ${caller.email} performing ${action} on user ${userId}`);

    // Get target user info
    const { data: targetUser, error: targetError } = await adminClient.auth.admin.getUserById(userId);
    if (targetError || !targetUser.user) {
      console.error("Error getting target user:", targetError);
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;
    let message;
    let auditDetails: Record<string, unknown> = {};

    switch (action) {
      case "deactivate":
        result = await adminClient.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
        message = `Usuário ${targetUser.user.email} desativado com sucesso`;
        auditDetails = { reason: "user_deactivated" };
        break;
      case "reactivate":
        result = await adminClient.auth.admin.updateUserById(userId, { ban_duration: "none" });
        message = `Usuário ${targetUser.user.email} reativado com sucesso`;
        auditDetails = { reason: "user_reactivated" };
        break;
      case "delete":
        await adminClient.from("user_roles").delete().eq("user_id", userId);
        await adminClient.from("system_access").delete().eq("user_id", userId);
        await adminClient.from("user_profiles").delete().eq("user_id", userId);
        result = await adminClient.auth.admin.deleteUser(userId);
        message = `Usuário ${targetUser.user.email} removido permanentemente`;
        auditDetails = { reason: "user_deleted" };
        break;
      case "update_email":
        if (!email) {
          return new Response(JSON.stringify({ error: "E-mail é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        auditDetails = { old_email: targetUser.user.email, new_email: email, is_self: isSelfAction };
        result = await adminClient.auth.admin.updateUserById(userId, { email });
        message = `E-mail atualizado para ${email}`;
        break;
      case "update_password":
        // SEGURANÇA: Somente o próprio usuário pode alterar sua senha via esta ação
        if (!isSelfAction) {
          return new Response(
            JSON.stringify({ error: "Apenas o próprio usuário pode alterar sua senha" }), 
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (!password || password.length < 6) {
          return new Response(JSON.stringify({ error: "Senha deve ter pelo menos 6 caracteres" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        result = await adminClient.auth.admin.updateUserById(userId, { password });
        message = `Senha atualizada com sucesso`;
        auditDetails = { reason: "password_reset", is_self: true };
        break;
    }

    if (result?.error) {
      console.error(`Error performing ${action}:`, result.error);
      return new Response(JSON.stringify({ error: `Erro ao executar ação` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Insert audit log
    const { data: callerProfile } = await adminClient.from("user_profiles").select("name").eq("user_id", caller.id).single();
    const { data: targetProfile } = await adminClient.from("user_profiles").select("name").eq("user_id", userId).single();
    
    await adminClient.from("admin_audit_logs").insert({
      actor_id: caller.id,
      actor_email: caller.email,
      actor_name: callerProfile?.name || null,
      target_id: userId,
      target_email: targetUser.user.email,
      target_name: targetProfile?.name || null,
      action,
      details: auditDetails,
    });

    console.log(message);
    return new Response(JSON.stringify({ success: true, message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
