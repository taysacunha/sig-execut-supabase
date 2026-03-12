import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Check, X } from "lucide-react";
import executLogo from "@/assets/execut-logo.jpg";

const getPasswordStrength = (password: string) => {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  return strength;
};

const getStrengthLabel = (strength: number) => {
  switch (strength) {
    case 0:
    case 1:
      return { label: "Muito fraca", color: "bg-destructive" };
    case 2:
      return { label: "Fraca", color: "bg-orange-500" };
    case 3:
      return { label: "Média", color: "bg-yellow-500" };
    case 4:
      return { label: "Forte", color: "bg-green-500" };
    case 5:
      return { label: "Muito forte", color: "bg-green-600" };
    default:
      return { label: "", color: "" };
  }
};

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  
  // Estados para definição de senha
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // REFS para controle atômico - evita race conditions
  const verificationDone = useRef(false);
  const isNavigating = useRef(false);

  // Função de verificação ÚNICA e centralizada
  const verifyAndDecide = async (source: string) => {
    // Se já verificamos ou estamos navegando, ignorar
    if (verificationDone.current || isNavigating.current) {
      console.log(`[Auth] Verification SKIPPED (source: ${source}) - already done: ${verificationDone.current}, navigating: ${isNavigating.current}`);
      return;
    }
    
    console.log(`[Auth] Starting verification (source: ${source})`);

    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log("[Auth] No user found - showing login form");
      setCheckingAuth(false);
      return;
    }
    
    // MARCAR VERIFICAÇÃO COMO FEITA ANTES de qualquer decisão
    verificationDone.current = true;
    
    const metadata = user.user_metadata || {};
    const isInvited = metadata.created_by !== undefined;
    const passwordSet = metadata.password_set === true;
    
    console.log("[Auth] User verification result:", { 
      email: user.email,
      isInvited, 
      passwordSet, 
      metadata 
    });
    
    // DECISÃO FINAL: mostrar formulário ou redirecionar
    if (isInvited && !passwordSet) {
      console.log("[Auth] DECISION: Show password form (invited user without password)");
      setIsSettingPassword(true);
      setCheckingAuth(false);
    } else if (isRecoveryUrl()) {
      console.log("[Auth] DECISION: Recovery flow detected in URL - showing password reset form");
      setIsRecovery(true);
      setIsSettingPassword(true);
      setCheckingAuth(false);
      window.history.replaceState(null, '', '/auth');
    } else {
      console.log("[Auth] DECISION: Redirect to home (user ready)");
      isNavigating.current = true;
      navigate("/");
    }
  };

  // Detectar recovery via URL (query string ou hash)
  const isRecoveryUrl = (): boolean => {
    const search = window.location.search;
    const hash = window.location.hash;
    
    // Verificar na query string
    if (search.includes('flow=recovery')) return true;
    if (search.includes('type=recovery')) return true;
    if (search.includes('token_hash=') && search.includes('type=recovery')) return true;
    
    // Verificar no hash
    if (hash.includes('type=recovery')) return true;
    
    return false;
  };

  // Extrair tokens da URL
  const getUrlTokens = (): { accessToken: string | null; refreshToken: string | null } => {
    const hash = window.location.hash.substring(1);
    if (!hash) return { accessToken: null, refreshToken: null };
    
    const hashParams = new URLSearchParams(hash);
    return {
      accessToken: hashParams.get('access_token'),
      refreshToken: hashParams.get('refresh_token')
    };
  };

  useEffect(() => {
    console.log("=== AUTH COMPONENT MOUNTED ===");
    console.log("[Auth] Current URL:", window.location.href);
    
    // Resetar refs ao montar
    verificationDone.current = false;
    isNavigating.current = false;
    
    // Listener de eventos de autenticação - LÓGICA SIMPLIFICADA
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth] Event received:", event, "User:", session?.user?.email);
      
      // PASSWORD_RECOVERY: SEMPRE mostrar formulário imediatamente
      if (event === "PASSWORD_RECOVERY") {
        console.log("[Auth] PASSWORD_RECOVERY event - showing recovery form");
        verificationDone.current = true;
        setIsRecovery(true);
        setIsSettingPassword(true);
        setCheckingAuth(false);
        window.history.replaceState(null, '', '/auth');
        return;
      }
      
      // SIGNED_IN - decisão baseada APENAS em password_set (não em type=invite)
      if (event === "SIGNED_IN" && session?.user) {
        const metadata = session.user.user_metadata || {};
        const passwordSet = metadata.password_set === true;
        const isRecovery = isRecoveryUrl();
        
        console.log("[Auth] SIGNED_IN - deciding based on state:", { 
          email: session.user.email,
          passwordSet,
          isRecovery,
          metadata 
        });
        
        // Se já processamos, ignorar
        if (verificationDone.current) {
          console.log("[Auth] Already processed - skipping");
          return;
        }
        verificationDone.current = true;
        
        // REGRA SIMPLES:
        // 1. Recovery explícito → form de redefinição
        // 2. password_set !== true → form de definição de senha (invite)
        // 3. Caso contrário → redirecionar para home
        
        if (isRecovery) {
          console.log("[Auth] DECISION: Recovery flow - showing password reset form");
          setIsRecovery(true);
          setIsSettingPassword(true);
          setCheckingAuth(false);
          window.history.replaceState(null, '', '/auth');
          return;
        }
        
        if (!passwordSet) {
          console.log("[Auth] DECISION: User has no password set - showing password form");
          setIsRecovery(false);
          setIsSettingPassword(true);
          setCheckingAuth(false);
          window.history.replaceState(null, '', '/auth');
          return;
        }
        
        // Usuário já tem senha - redirecionar
        console.log("[Auth] DECISION: User has password set - redirecting to home");
        isNavigating.current = true;
        navigate("/");
        return;
      }
      
      // SIGNED_OUT - resetar tudo
      if (event === "SIGNED_OUT") {
        console.log("[Auth] SIGNED_OUT - resetting state");
        verificationDone.current = false;
        isNavigating.current = false;
        setIsRecovery(false);
        setIsSettingPassword(false);
        setCheckingAuth(false);
      }
    });

    // Processar tokens da URL se existirem
    const checkTimeout = setTimeout(async () => {
      const { accessToken, refreshToken } = getUrlTokens();
      
      if (accessToken && refreshToken) {
        console.log("[Auth] Found tokens in URL - setting session");
        try {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (error) {
            console.error("[Auth] Error setting session:", error);
            setCheckingAuth(false);
          }
          // onAuthStateChange vai cuidar do resto
        } catch (err) {
          console.error("[Auth] Exception setting session:", err);
          setCheckingAuth(false);
        }
        return;
      }
      
      // Sem tokens na URL - verificar sessão existente
      verifyAndDecide("checkSession:initial");
    }, 50);

    return () => {
      clearTimeout(checkTimeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Por favor, preencha todos os campos");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Email ou senha incorretos");
      } else if (error.message.includes("Email not confirmed")) {
        toast.error("Por favor, confirme seu email antes de fazer login");
      } else {
        toast.error("Erro ao fazer login. Tente novamente.");
      }
    } else {
      toast.success("Login realizado com sucesso!");
    }
    setLoading(false);
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      toast.error("Por favor, insira seu email");
      return;
    }
    setLoading(true);
    
    // SEMPRE usar domínio publicado para links de recovery (nunca preview)
    // Isso evita que usuários caiam no auth-bridge do lovable.dev
    const isPreview = window.location.hostname.includes('lovableproject.com') || 
                      window.location.hostname.includes('lovable.app') && window.location.hostname.includes('-preview');
    const canonicalUrl = isPreview 
      ? 'https://sigest.lovable.app/auth?flow=recovery'
      : `${window.location.origin}/auth?flow=recovery`;
    
    console.log('[Auth] Password reset redirect URL:', canonicalUrl);
    
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: canonicalUrl
    });
    if (error) {
      toast.error("Erro ao enviar email de recuperação");
    } else {
      toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
      setResetDialogOpen(false);
      setResetEmail("");
    }
    setLoading(false);
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmNewPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    
    if (newPassword.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    
    const strength = getPasswordStrength(newPassword);
    if (strength < 3) {
      toast.error("A senha deve ser pelo menos de força média");
      return;
    }
    
    setLoading(true);
    
    try {
      // Verificar se temos uma sessão válida antes de tentar atualizar
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error("[Auth] No valid session for password update:", sessionError);
        
        // Tentar recuperar sessão de tokens na URL
        const hash = window.location.hash.substring(1);
        if (hash) {
          const hashParams = new URLSearchParams(hash);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            console.log("[Auth] Attempting to restore session from URL tokens");
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (setSessionError) {
              console.error("[Auth] Failed to restore session:", setSessionError);
              toast.error("Sessão expirada. Por favor, solicite um novo link de convite/recuperação.");
              setLoading(false);
              return;
            }
          } else {
            toast.error("Sessão expirada. Por favor, solicite um novo link de convite/recuperação.");
            setLoading(false);
            return;
          }
        } else {
          toast.error("Sessão expirada. Por favor, solicite um novo link de convite/recuperação.");
          setLoading(false);
          return;
        }
      }
      
      // Atualizar senha E marcar que a senha foi definida
      const { error } = await supabase.auth.updateUser({ 
        password: newPassword,
        data: { password_set: true }
      });
      
      if (error) {
        console.error("Error setting password:", error);
        if (error.message.includes("session") || error.message.includes("expired") || error.message.includes("JWT")) {
          toast.error("Sessão expirada. Por favor, solicite um novo link de convite/recuperação.");
        } else {
          toast.error("Erro ao definir senha. Tente novamente.");
        }
        setLoading(false);
        return;
      }
      
      toast.success("Senha definida com sucesso! Faça login para continuar.");
      
      // Fazer logout para forçar login com nova senha
      await supabase.auth.signOut();
      
      // Resetar estados
      setIsRecovery(false);
      setIsSettingPassword(false);
      setNewPassword("");
      setConfirmNewPassword("");
      
      // Limpar hash da URL
      window.history.replaceState(null, '', window.location.pathname);
    } catch (err) {
      console.error("Unexpected error:", err);
      toast.error("Erro inesperado. Tente novamente.");
    }
    
    setLoading(false);
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const strengthInfo = getStrengthLabel(passwordStrength);
  const passwordsMatch = newPassword === confirmNewPassword && confirmNewPassword.length > 0;

  // Loading inicial
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Formulário de definição de senha
  if (isSettingPassword) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
        <img 
          src={executLogo} 
          alt="Execut Imóveis" 
          className="h-20 w-auto mb-6 object-contain"
        />
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              {isRecovery ? 'Redefinir Senha' : 'Bem-vindo!'}
            </CardTitle>
            <CardDescription className="text-center">
              {isRecovery 
                ? 'Digite sua nova senha' 
                : 'Defina sua senha para acessar o sistema'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                
                {newPassword && (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            level <= passwordStrength ? strengthInfo.color : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Força: {strengthInfo.label}
                    </p>
                  </div>
                )}
                
                <div className="text-xs space-y-1 text-muted-foreground">
                  <div className="flex items-center gap-1">
                    {newPassword.length >= 8 ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-destructive" />}
                    Mínimo 8 caracteres
                  </div>
                  <div className="flex items-center gap-1">
                    {/[a-z]/.test(newPassword) ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-destructive" />}
                    Letra minúscula
                  </div>
                  <div className="flex items-center gap-1">
                    {/[A-Z]/.test(newPassword) ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-destructive" />}
                    Letra maiúscula
                  </div>
                  <div className="flex items-center gap-1">
                    {/[0-9]/.test(newPassword) ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-destructive" />}
                    Número
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirmar Senha</Label>
                <div className="relative">
                  <Input
                    id="confirm-new-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {confirmNewPassword && (
                  <div className="flex items-center gap-1 text-xs">
                    {passwordsMatch ? (
                      <>
                        <Check className="h-3 w-3 text-green-500" />
                        <span className="text-green-500">Senhas coincidem</span>
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3 text-destructive" />
                        <span className="text-destructive">Senhas não coincidem</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !passwordsMatch || passwordStrength < 3}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isRecovery ? 'Redefinir Senha' : 'Definir Senha'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              Sistema de gerenciamento de escalas de trabalho
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Formulário de login
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <img 
              src={executLogo} 
              alt="Execut Imóveis" 
              className="h-20 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Sistema Integrado de Gestão
          </CardTitle>
          <CardDescription className="text-center">
            Entre com suas credenciais para acessar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button
            variant="link"
            className="text-sm text-muted-foreground"
            onClick={() => setResetDialogOpen(true)}
          >
            Esqueceu sua senha?
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
            <DialogDescription>
              Digite seu email para receber as instruções de recuperação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="seu@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button onClick={handlePasswordReset} className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Email de Recuperação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
