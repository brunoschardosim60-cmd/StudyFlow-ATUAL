/**
 * ShareNotebookDialog — compartilha caderno via link público
 * Cria um share token no Supabase e gera link copiável
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Share2, Copy, Check, Globe, Lock } from "lucide-react";

interface ShareNotebookDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  notebookId: string;
  notebookTitle: string;
  userId: string;
}

export function ShareNotebookDialog({
  open, onOpenChange, notebookId, notebookTitle, userId,
}: ShareNotebookDialogProps) {
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  const generateShareLink = async () => {
    setLoading(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // expira em 30 dias

      const { error } = await supabase
        .from("notebook_shares")
        .upsert({
          notebook_id: notebookId,
          owner_id: userId,
          share_token: token,
          is_public: true,
          expires_at: expiresAt.toISOString(),
        }, { onConflict: "notebook_id" });

      if (error) throw error;

      const url = `${window.location.origin}/shared/notebook/${token}`;
      setShareUrl(url);
      setIsPublic(true);
    } catch (e: any) {
      toast.error("Erro ao gerar link: " + (e?.message ?? "tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  const revokeShare = async () => {
    setLoading(true);
    try {
      await supabase.from("notebook_shares").delete().eq("notebook_id", notebookId);
      setShareUrl(null);
      setIsPublic(false);
      toast.success("Compartilhamento removido.");
    } catch {
      toast.error("Erro ao revogar link.");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Compartilhar caderno
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="font-medium text-sm truncate">{notebookTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isPublic ? "Qualquer pessoa com o link pode visualizar" : "Privado — só você pode ver"}
            </p>
          </div>

          {!shareUrl ? (
            <div className="text-center space-y-3">
              <div className="rounded-full bg-muted w-14 h-14 mx-auto flex items-center justify-center">
                <Lock className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Gere um link público para compartilhar este caderno. Válido por 30 dias.
              </p>
              <Button onClick={generateShareLink} disabled={loading} className="w-full gap-2">
                <Globe className="w-4 h-4" />
                {loading ? "Gerando..." : "Gerar link de compartilhamento"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="text-xs font-mono" />
                <Button size="icon" variant="outline" onClick={copyLink}>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Link válido por 30 dias. Qualquer pessoa com o link pode visualizar.
              </p>
              <Button variant="outline" size="sm" onClick={revokeShare} disabled={loading} className="w-full text-destructive hover:bg-destructive/10">
                {loading ? "Revogando..." : "Revogar acesso"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
