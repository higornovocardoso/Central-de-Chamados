import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";

/** Painel "Minha conta": dados pessoais, e-mail e senha do usuário logado. */
export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { user, profileName, entities } = usePermissions();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState<null | "dados" | "email" | "senha">(null);

  useEffect(() => {
    if (!open || !user) return;
    setFullName((user.user_metadata?.["full_name"] as string | undefined) ?? "");
    setEmail(user.email ?? "");
    setPassword("");
    setConfirm("");
  }, [open, user]);

  const initials = (fullName || user?.email || "U")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  async function saveDados() {
    if (!user) return;
    if (fullName.trim().length < 2) {
      toast.error("Informe seu nome completo.");
      return;
    }
    setSaving("dados");
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim() },
    });
    if (!error) {
      await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", user.id);
    }
    setSaving(null);
    if (error) toast.error("Não foi possível salvar", { description: error.message });
    else {
      toast.success("Dados atualizados.");
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    }
  }

  async function saveEmail() {
    if (!email.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setSaving("email");
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setSaving(null);
    if (error) toast.error("Não foi possível alterar o e-mail", { description: error.message });
    else toast.success("E-mail atualizado. Verifique sua caixa de entrada se houver confirmação.");
  }

  async function savePassword() {
    if (password.length < 8) {
      toast.error("A senha precisa de ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSaving("senha");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(null);
    if (error) toast.error("Não foi possível alterar a senha", { description: error.message });
    else {
      toast.success("Senha alterada.");
      setPassword("");
      setConfirm("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        <div className="relative bg-gradient-to-br from-primary to-[#8b5cf6] px-5 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-base font-semibold backdrop-blur">
              {initials}
            </span>
            <div className="min-w-0">
              <DialogHeader className="space-y-0 text-left">
                <DialogTitle className="truncate text-base text-white">
                  {fullName || user?.email || "Minha conta"}
                </DialogTitle>
                <DialogDescription className="truncate text-xs text-white/80">
                  {user?.email}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[0.68rem]">
                  <ShieldCheck className="size-3" /> {profileName || "Sem perfil"}
                </span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[0.68rem]">
                  {entities[0]?.name ?? "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="dados" className="px-5 pb-5 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="dados" className="flex-1 text-xs">
              Dados pessoais
            </TabsTrigger>
            <TabsTrigger value="email" className="flex-1 text-xs">
              E-mail
            </TabsTrigger>
            <TabsTrigger value="senha" className="flex-1 text-xs">
              Senha
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome completo</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
                className="h-9 text-xs"
              />
            </div>
            <Button onClick={saveDados} disabled={saving === "dados"} className="h-9 w-full">
              {saving === "dados" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserRound className="size-4" />
              )}
              Salvar dados
            </Button>
          </TabsContent>

          <TabsContent value="email" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Endereço de e-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-xs"
              />
              <p className="text-[0.7rem] text-muted-foreground">
                Este é o e-mail usado para entrar no sistema.
              </p>
            </div>
            <Button onClick={saveEmail} disabled={saving === "email"} className="h-9 w-full">
              {saving === "email" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Alterar e-mail
            </Button>
          </TabsContent>

          <TabsContent value="senha" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nova senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo de 8 caracteres"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <Button onClick={savePassword} disabled={saving === "senha"} className="h-9 w-full">
              {saving === "senha" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              Alterar senha
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
