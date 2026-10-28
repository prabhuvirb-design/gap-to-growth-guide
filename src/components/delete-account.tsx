import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { getAccountType } from "@/lib/account.functions";
import { deleteStudentAccount } from "@/lib/delete-account.functions";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export function DeleteAccount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchType = useServerFn(getAccountType);
  const removeAccount = useServerFn(deleteStudentAccount);
  const accountType = useQuery({ queryKey: ["account-type", user?.id], queryFn: () => fetchType(), enabled: !!user });
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (busy || confirmation !== "DELETE") return;
    setBusy(true);
    setError("");
    try {
      await queryClient.cancelQueries();
      await removeAccount({ data: { confirmation: "DELETE" } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t delete your account. Please try again.");
      setBusy(false);
      return;
    }
    queryClient.clear();
    // Clear only Mentora's progress, never unrelated browser storage.
    try { localStorage.removeItem("mentora-sessions"); } catch { /* storage may be unavailable */ }
    try { await supabase.auth.signOut({ scope: "local" }); } finally {
      // A fresh document also drops any in-memory learning results.
      window.location.replace("/auth");
    }
  }

  if (accountType.data !== "student") return null;
  return (
    <section className="border-t border-border pt-6 lg:col-span-2">
      <h2 className="text-xl font-semibold">Delete account</h2>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">Permanently remove your student account, profile, saved diagnostics, and practice progress. This cannot be undone.</p>
      <Button variant="destructive" className="mt-4" onClick={() => { setConfirmation(""); setError(""); setOpen(true); }}><Trash2 className="size-4" />Delete account</Button>
      <AlertDialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your student account permanently?</AlertDialogTitle>
            <AlertDialogDescription>Your login, profile, all saved diagnostics, and practice progress will be deleted. Progress saved in this browser will also be cleared. You cannot recover this account.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">Type DELETE to confirm</Label>
            <Input id="delete-confirmation" autoComplete="off" value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter className="gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={busy || confirmation !== "DELETE"} onClick={() => void remove()}>{busy ? "Deleting…" : "Permanently delete account"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}