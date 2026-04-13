import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AppRole = "super_admin" | "admin" | "manager" | "supervisor" | "collaborator";
type PermissionType = "view_only" | "view_edit";

interface SystemAccess {
  system_name: string;
  permission_type: PermissionType;
}

interface CreateUserRequest {
  email?: string;
  name?: string;
  user_id?: string;
  role: AppRole;
  resend?: boolean;
  systems?: SystemAccess[];
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const { data: callerRole, error: roleError } = await userClient.rpc("get_user_role", {
      _user_id: caller.id,
    });

    // Apenas super_admin e admin podem adicionar usuários
    if (roleError || !callerRole || !["super_admin", "admin"].includes(callerRole)) {
      console.error("Caller is not authorized:", callerRole, roleError);
      return new Response(
        JSON.stringify({ error: "Apenas Super Administradores e Administradores podem adicionar usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email: providedEmail, name, user_id, role, resend, systems }: CreateUserRequest = await req.json();

    if (!role) {
      return new Response(
        JSON.stringify({ error: "Perfil é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validRoles: AppRole[] = ["super_admin", "admin", "manager", "supervisor", "collaborator"];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Perfil inválido. Use: ${validRoles.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar hierarquia
    if (!canManageRole(callerRole as AppRole, role)) {
      return new Response(
        JSON.stringify({ error: "Você não tem permissão para criar um usuário com este perfil" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let email = providedEmail;
    
    // SEMPRE usar o domínio publicado para links de email (nunca preview)
    // Isso evita que usuários caiam no auth-bridge do lovable.dev
    const siteUrl = Deno.env.get("SITE_URL") || "https://sigest.lovable.app";
    console.log(`[invite-user] Using canonical redirect URL: ${siteUrl}`);

    // Se é um reenvio, buscar email do usuário existente
    if (resend && user_id) {
      console.log(`Looking up user ${user_id} for resend`);
      const { data: userData, error: userLookupError } = await adminClient.auth.admin.getUserById(user_id);
      
      if (userLookupError || !userData?.user) {
        console.error("Error fetching user:", userLookupError);
        return new Response(
          JSON.stringify({ error: "Usuário não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const existingUser = userData.user;
      
      // Verificar role do usuário alvo
      const { data: targetRole } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user_id)
        .single();

      if (targetRole && !canManageRole(callerRole as AppRole, targetRole.role as AppRole)) {
        return new Response(
          JSON.stringify({ error: "Você não tem permissão para gerenciar este usuário" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Se o usuário já definiu a senha, está ATIVO - não reenviar
      if (existingUser.user_metadata?.password_set === true) {
        console.log("User already has password set - rejecting resend");
        return new Response(
          JSON.stringify({ error: "Este usuário já está ativo no sistema. Não é possível reenviar o email." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      email = existingUser.email;
      
      if (!email) {
        console.error("User has no email:", user_id);
        return new Response(
          JSON.stringify({ error: "Usuário não possui email cadastrado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Resending invite for pending user ${email} - will delete and recreate`);
      
      const oldUserId = existingUser.id;

      // Salvar as informações de role, systems e profile
      const { data: existingRoleData } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", oldUserId)
        .single();
      
      const { data: existingSystemsData } = await adminClient
        .from("system_access")
        .select("system_name, permission_type")
        .eq("user_id", oldUserId);

      const { data: existingProfileData } = await adminClient
        .from("user_profiles")
        .select("name")
        .eq("user_id", oldUserId)
        .single();

      // Deletar registros associados
      await adminClient.from("user_roles").delete().eq("user_id", oldUserId);
      await adminClient.from("system_access").delete().eq("user_id", oldUserId);
      await adminClient.from("user_profiles").delete().eq("user_id", oldUserId);

      // Deletar o usuário pendente
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(oldUserId);
      if (deleteError) {
        console.error("Error deleting pending user:", deleteError);
        return new Response(
          JSON.stringify({ error: `Erro ao reprocessar usuário: ${deleteError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`Deleted pending user ${oldUserId}`);

      // Recriar usuário com inviteUserByEmail
      const { data: newUserData, error: reinviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          created_by: caller.email,
          role: role,
        },
        redirectTo: `${siteUrl}/auth`
      });

      if (reinviteError) {
        console.error("Error re-inviting user:", reinviteError);
        
        // Tratar rate limit (429) - restaurar usuário deletado
        const isRateLimit = (reinviteError as any).status === 429 || (reinviteError as any).code === "over_email_send_rate_limit" || reinviteError.message?.includes("rate limit");
        if (isRateLimit) {
          // Recriar o usuário sem enviar email para não perder o registro
          console.log("Rate limit hit during resend - recreating user without email");
          const { data: recreated } = await adminClient.auth.admin.createUser({
            email: email!,
            email_confirm: false,
            user_metadata: { created_by: caller.email, role: role },
          });
          if (recreated?.user) {
            const newId = recreated.user.id;
            const finalRole = role || existingRoleData?.role || 'collaborator';
            await adminClient.from("user_roles").insert({ user_id: newId, role: finalRole });
            await adminClient.from("user_profiles").insert({ user_id: newId, name: name || existingProfileData?.name || email });
            const systemsToRestore = systems || existingSystemsData || [];
            if (systemsToRestore.length > 0) {
              const systemInserts = systemsToRestore.map((sys: any) => ({
                user_id: newId,
                system_name: typeof sys === 'string' ? sys : sys.system_name,
                permission_type: typeof sys === 'string' ? 'view_edit' : (sys.permission_type || 'view_edit'),
              }));
              await adminClient.from("system_access").insert(systemInserts);
            }
            console.log(`User recreated as ${newId} after rate limit`);
          }
          return new Response(
            JSON.stringify({ error: "Limite de envio de emails atingido. Aguarde alguns minutos antes de tentar novamente." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ error: `Erro ao reenviar convite: ${reinviteError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newUserId = newUserData.user.id;
      console.log(`User recreated with new ID: ${newUserId}`);

      // Restaurar role
      const finalRole = role || existingRoleData?.role || 'collaborator';
      await adminClient.from("user_roles").insert({
        user_id: newUserId,
        role: finalRole,
      });

      // Restaurar profile
      const profileName = name || existingProfileData?.name || email;
      await adminClient.from("user_profiles").insert({
        user_id: newUserId,
        name: profileName,
      });

      // Restaurar acesso a sistemas
      const systemsToRestore = systems || existingSystemsData || [];
      if (systemsToRestore.length > 0) {
        const systemInserts = systemsToRestore.map((sys: any) => ({
          user_id: newUserId,
          system_name: typeof sys === 'string' ? sys : sys.system_name,
          permission_type: typeof sys === 'string' ? 'view_edit' : (sys.permission_type || 'view_edit'),
        }));
        await adminClient.from("system_access").insert(systemInserts);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Email de convite reenviado para ${email}. O usuário receberá um novo email.`,
          user: {
            id: newUserId,
            email: email,
            role: finalRole,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Novo convite
    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!name || !name.trim()) {
      return new Response(
        JSON.stringify({ error: "Nome é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin ${caller.email} creating user ${email} with role ${role}`);

    // Verificar se já existe usuário com este email
    const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar usuários existentes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const existingUser = existingUsers.users.find(u => u.email === email);
    
    let deletedPendingUser: { id: string; roleData: any; systemsData: any; profileData: any } | null = null;

    if (existingUser) {
      if (existingUser.user_metadata?.password_set === true) {
        console.log("User already active with password set");
        return new Response(
          JSON.stringify({ error: "Este usuário já está ativo no sistema" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Salvar dados antes de deletar para poder restaurar se o convite falhar
      const { data: savedRole } = await adminClient.from("user_roles").select("role").eq("user_id", existingUser.id).single();
      const { data: savedSystems } = await adminClient.from("system_access").select("system_name, permission_type").eq("user_id", existingUser.id);
      const { data: savedProfile } = await adminClient.from("user_profiles").select("name").eq("user_id", existingUser.id).single();

      console.log(`Deleting existing pending user ${existingUser.id} to recreate`);
      await adminClient.from("user_roles").delete().eq("user_id", existingUser.id);
      await adminClient.from("system_access").delete().eq("user_id", existingUser.id);
      await adminClient.from("user_profiles").delete().eq("user_id", existingUser.id);
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(existingUser.id);
      if (deleteError) {
        console.error("Error deleting existing user:", deleteError);
        return new Response(
          JSON.stringify({ error: "Este email já está cadastrado no sistema" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      deletedPendingUser = { id: existingUser.id, roleData: savedRole, systemsData: savedSystems, profileData: savedProfile };
    }

    // Criar usuário com inviteUserByEmail
    console.log(`Inviting user ${email} with inviteUserByEmail`);
    
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        created_by: caller.email,
        role: role,
      },
      redirectTo: `${siteUrl}/auth`
    });

    if (inviteError) {
      console.error("Error inviting user:", inviteError);
      
      // Tratar rate limit (429)
      const isRateLimit = (inviteError as any).status === 429 || (inviteError as any).code === "over_email_send_rate_limit" || inviteError.message?.includes("rate limit");
      if (isRateLimit) {
        return new Response(
          JSON.stringify({ error: "Limite de envio de emails atingido. Aguarde alguns minutos antes de tentar novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Erro ao convidar usuário: ${inviteError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User invited: ${inviteData.user.id}`);

    // Inserir role na tabela user_roles
    const { error: roleInsertError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: inviteData.user.id,
        role: role,
      });

    if (roleInsertError) {
      console.error("Error assigning role:", roleInsertError);
      await adminClient.auth.admin.deleteUser(inviteData.user.id);
      return new Response(
        JSON.stringify({ error: "Erro ao atribuir perfil ao usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inserir nome na tabela user_profiles
    const { error: profileInsertError } = await adminClient
      .from("user_profiles")
      .insert({
        user_id: inviteData.user.id,
        name: name.trim(),
      });

    if (profileInsertError) {
      console.error("Error creating profile:", profileInsertError);
      // Não deletamos o usuário por causa disso, apenas logamos
    }

    // Inserir acesso a sistemas
    if (systems && systems.length > 0) {
      const systemInserts = systems.map((sys) => ({
        user_id: inviteData.user.id,
        system_name: sys.system_name,
        permission_type: sys.permission_type || 'view_edit',
      }));
      
      const { error: systemError } = await adminClient
        .from("system_access")
        .insert(systemInserts);

      if (systemError) {
        console.error("Error assigning system access:", systemError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Usuário ${email} convidado com sucesso! Um email de convite foi enviado.`,
        user: {
          id: inviteData.user.id,
          email: inviteData.user.email,
          name: name.trim(),
          role: role,
        },
      }),
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
