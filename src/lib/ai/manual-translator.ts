import { supabase } from "@/integrations/supabase/client";
import { manualScriptRecord, type ManualTranslationInput } from "./manual-script";
import type { Script } from "@/lib/engine/scripts";

export async function translateManualScript(input: ManualTranslationInput, signal?: AbortSignal, onProgress?: (text: string) => void, id?: string): Promise<Script> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Inicia sesión para traducir con Lovable AI. Tu código no se ha cambiado.");
  const response = await fetch("/api/manual-scripts", {
    method: "POST", signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "No se pudo conectar con Lovable AI." }));
    throw new Error(error.message || "No se pudo traducir el script.");
  }
  if (!response.body) throw new Error("Lovable AI no devolvió una respuesta.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let completed = false;
  try {
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "delta") { text += event.text; onProgress?.(text); }
        if (event.type === "done") completed = true;
      }
      if (chunk.done) break;
    }
  } finally { reader.releaseLock(); }
  if (!completed) throw new Error("La traducción se interrumpió. No se aplicó ningún cambio.");
  const result = JSON.parse(text);
  if (result.clarification) throw new Error(result.clarification);
  return manualScriptRecord(result.code, input.source, result.explanation || "", id as never);
}