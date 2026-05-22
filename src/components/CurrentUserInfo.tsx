import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mostra nome e e-mail do usuário logado no rodapé do sidebar.
 * Útil para identificação em gravações de tela / suporte.
 */
export function CurrentUserInfo() {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;
      setEmail(user.email ?? "");
      const { data } = await supabase
        .from("user_profiles")
        .select("name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (active && data?.name) setName(data.name);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!email) return null;

  return (
    <div className="px-2 py-2 border-b border-sidebar-border mb-2 text-sidebar-foreground">
      {name && (
        <div className="text-sm font-medium break-words leading-tight" title={name}>
          {name}
        </div>
      )}
      <div
        className="text-xs text-sidebar-foreground/70 truncate"
        title={email}
      >
        {email}
      </div>
    </div>
  );
}