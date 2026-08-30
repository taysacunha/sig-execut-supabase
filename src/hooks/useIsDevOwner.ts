import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const DEV_OWNER_EMAIL = "brunumorais@gmail.com";

/** Indica se o usuário logado é o responsável pelo registro de desenvolvimento (/dev). */
export function useIsDevOwner() {
  const [isDevOwner, setIsDevOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const resolve = (userEmail: string | null | undefined) => {
      if (!mounted) return;
      const normalized = (userEmail || "").trim().toLowerCase();
      setEmail(normalized || null);
      setIsDevOwner(normalized === DEV_OWNER_EMAIL);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => resolve(session?.user?.email));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        resolve(null);
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        resolve(session?.user?.email);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { isDevOwner, loading, email };
}
