import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/entrar")({
  validateSearch: (s: Record<string, unknown>) => ({ returnTo: typeof s.returnTo === "string" ? s.returnTo : undefined }),
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Traductor de scripts" },
      { name: "description", content: "Inicia sesión para traducir tus scripts manuales con IA." },
      { property: "og:title", content: "Iniciar sesión — Traductor de scripts" },
      { property: "og:description", content: "Inicia sesión para traducir tus scripts manuales con IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Entrar,
});

function safePath(p?: string) {
  return p && p.startsWith("/") && !p.startsWith("//") ? p : "/";
}

function Entrar() {
  const { returnTo } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const back = () => { window.location.href = safePath(returnTo); };

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        back();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + safePath(returnTo) } });
        if (error) throw error;
        if (data.session) back(); else setMsg("Revisa tu correo y confirma tu cuenta para entrar.");
      }
    } catch (err) { setMsg(err instanceof Error ? err.message : "No se pudo iniciar sesión."); }
    finally { setBusy(false); }
  }

  async function google() {
    sessionStorage.setItem("entrar_returnTo", safePath(returnTo));
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/entrar" });
    if (r && "error" in r && r.error) { setMsg("No se pudo entrar con Google."); return; }
    const { data } = await supabase.auth.getSession();
    if (data.session) window.location.href = sessionStorage.getItem("entrar_returnTo") || "/";
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-4">
        <h1 className="text-xl font-semibold">{mode === "in" ? "Iniciar sesión" : "Crear cuenta"}</h1>
        <p className="text-sm text-muted-foreground">Necesario para traducir tus scripts manuales con IA.</p>
        <button onClick={google} className="w-full rounded-md border border-border bg-secondary py-2 text-sm font-medium">Continuar con Google</button>
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input type="password" required minLength={6} placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button disabled={busy} className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground">{busy ? "..." : mode === "in" ? "Entrar" : "Crear cuenta"}</button>
        </form>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="text-sm underline text-muted-foreground">
          {mode === "in" ? "¿No tienes cuenta? Crear una" : "Ya tengo cuenta"}
        </button>
      </div>
    </main>
  );
}
