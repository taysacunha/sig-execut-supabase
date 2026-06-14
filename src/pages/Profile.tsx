import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, UserCircle, Shield, Check, X, Circle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Estados para senha
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  
  // Estados para edição de email
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    return strength;
  };

  const getStrengthLabel = (strength: number) => {
    if (strength <= 1) return { label: "Muito fraca", color: "text-red-600" };
    if (strength === 2) return { label: "Fraca", color: "text-orange-600" };
    if (strength === 3) return { label: "Média", color: "text-yellow-600" };
    if (strength === 4) return { label: "Forte", color: "text-blue-600" };
    return { label: "Muito forte", color: "text-green-600" };
  };

  const handleEmailUpdate = async () => {
    if (!newEmail || !newEmail.includes("@")) {
      toast.error("Email inválido");
      return;
    }

    if (newEmail === user?.email) {
      toast.info("Este já é seu email atual");
      setEditingEmail(false);
      return;
    }

    setEmailLoading(true);

    const { error } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (error) {
      toast.error("Erro ao atualizar email. Tente novamente.");
    } else {
      toast.success("Email de confirmação enviado! Verifique sua caixa de entrada.");
      setEditingEmail(false);
      setNewEmail("");
    }

    setEmailLoading(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast.error("Por favor, preencha todos os campos");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error("A nova senha e a confirmação não coincidem");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres");
      return;
    }

    const strength = getPasswordStrength(newPassword);
    if (strength < 3) {
      toast.error("A senha é muito fraca. Use letras maiúsculas, minúsculas, números e caracteres especiais.");
      return;
    }

    setLoading(true);

    // Verificar senha atual fazendo login novamente
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: currentPassword,
    });

    if (signInError) {
      toast.error("Senha atual incorreta");
      setLoading(false);
      return;
    }

    // Atualizar senha
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast.error("Erro ao alterar senha. Tente novamente.");
    } else {
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <UserCircle className="h-8 w-8" />
          Perfil do Usuário
        </h1>
        <p className="text-muted-foreground">Gerencie suas informações e senha</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Conta</CardTitle>
          <CardDescription>Dados básicos do usuário</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Email</Label>
              {!editingEmail && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNewEmail(user?.email || "");
                    setEditingEmail(true);
                  }}
                >
                  Editar
                </Button>
              )}
            </div>
            
            {editingEmail ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={emailLoading}
                    placeholder="novo@email.com"
                  />
                  <Button
                    onClick={handleEmailUpdate}
                    disabled={emailLoading}
                    size="sm"
                  >
                    {emailLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingEmail(false);
                      setNewEmail("");
                    }}
                    disabled={emailLoading}
                    size="sm"
                  >
                    Cancelar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  ⚠️ Um email de confirmação será enviado para o novo endereço
                </p>
              </div>
            ) : (
              <Input value={user?.email || ""} disabled />
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Criação</Label>
              <Input
                value={
                  user?.created_at
                    ? format(new Date(user.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                    : ""
                }
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Última Atualização</Label>
              <Input
                value={
                  user?.updated_at
                    ? format(new Date(user.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                    : ""
                }
                disabled
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar Senha</CardTitle>
          <CardDescription>Atualize sua senha de acesso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha Atual</Label>
              <PasswordInput
                id="current-password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <PasswordInput
                id="new-password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                required
                minLength={8}
              />
              
              {/* Indicador de força da senha */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Força da senha</span>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((level) => {
                    const strength = newPassword ? getPasswordStrength(newPassword) : 0;
                    return (
                      <div
                        key={level}
                        className={`h-2 flex-1 rounded-full transition-all ${
                          !newPassword
                            ? "bg-muted"
                            : level <= strength
                            ? strength <= 1
                              ? "bg-destructive"
                              : strength === 2
                              ? "bg-orange-500"
                              : strength === 3
                              ? "bg-yellow-500"
                              : strength === 4
                              ? "bg-blue-500"
                              : "bg-green-500"
                            : "bg-muted"
                        }`}
                      />
                    );
                  })}
                </div>
                <p className={`text-xs font-medium ${
                  !newPassword 
                    ? "text-muted-foreground" 
                    : getStrengthLabel(getPasswordStrength(newPassword)).color
                }`}>
                  {newPassword 
                    ? `${getStrengthLabel(getPasswordStrength(newPassword)).label}` 
                    : "Digite uma senha para ver a força"}
                </p>
              </div>
            </div>
            
            {/* Card de requisitos de segurança - sempre visível */}
            <Card className="bg-muted/50 border-muted">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Requisitos de Segurança</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Sua senha deve atender aos seguintes critérios:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    {!newPassword ? (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    ) : newPassword.length >= 8 ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                    <span className={
                      !newPassword 
                        ? "text-muted-foreground" 
                        : newPassword.length >= 8 
                        ? "text-green-600 font-medium" 
                        : "text-destructive"
                    }>
                      Mínimo de 8 caracteres
                    </span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    {!newPassword ? (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    ) : /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                    <span className={
                      !newPassword 
                        ? "text-muted-foreground" 
                        : /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)
                        ? "text-green-600 font-medium" 
                        : "text-destructive"
                    }>
                      Letras maiúsculas e minúsculas
                    </span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    {!newPassword ? (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    ) : /\d/.test(newPassword) ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                    <span className={
                      !newPassword 
                        ? "text-muted-foreground" 
                        : /\d/.test(newPassword)
                        ? "text-green-600 font-medium" 
                        : "text-destructive"
                    }>
                      Pelo menos um número
                    </span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    {!newPassword ? (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    ) : /[^a-zA-Z0-9]/.test(newPassword) ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                    <span className={
                      !newPassword 
                        ? "text-muted-foreground" 
                        : /[^a-zA-Z0-9]/.test(newPassword)
                        ? "text-green-600 font-medium" 
                        : "text-destructive"
                    }>
                      Caracteres especiais (!@#$%^&*)
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirmar Nova Senha</Label>
              <PasswordInput
                id="confirm-new-password"
                placeholder="••••••••"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                disabled={loading}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alterar Senha
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => {
                navigate("/auth");
                toast.info("Use a opção 'Esqueceu a senha?' na tela de login");
              }}
            >
              Esqueceu sua senha atual? Clique aqui para recuperar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
