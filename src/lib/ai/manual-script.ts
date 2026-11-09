import { parse } from "acorn";
import type { Script } from "@/lib/engine/scripts";

export interface ManualTranslationInput {
  source: string;
  language?: string;
  dictionary?: string;
  targetKind?: string;
  targetName?: string;
  projectSummary?: string;
  previousCode?: string;
}

export function validateManualCode(code: string): string {
  const clean = code.trim().replace(/^```(?:javascript|js)?\s*/i, "").replace(/\s*```$/, "");
  if (!clean) throw new Error("La IA no devolvió código. No se aplicó ningún cambio.");
  parse(clean, { ecmaVersion: "latest", sourceType: "script" });
  if (!/\bregisterHook\s*\(/.test(clean)) {
    throw new Error("El código no está conectado al motor. No se aplicó ningún cambio.");
  }
  return clean;
}

/** The owner is provided by the runtime, never inferred from a kind or window.self. */
export function bindManualCode(code: string, entityId: string, scriptId: string): string {
  if (!code.startsWith("// ASTERNAL_MANUAL_V2")) return code;
  return `(function(){\nvar runtime = window.AsternalRuntime;\nvar targetId = ${JSON.stringify(entityId)};\nvar scriptId = ${JSON.stringify(scriptId)};\nvar resolveSelf = function(api){ return api.getEntities().find(function(e){return e.id === targetId;}) || null; };\nvar registerHook = function(hook){ runtime.registerHook(Object.assign({}, hook, {id: scriptId})); };\n${code}\n})();`;
}

export function manualScriptRecord(code: string, source: string, explanation: string, id = crypto.randomUUID()): Script {
  return { id, event: "onUpdate", blocks: [], customLanguageCode: source,
    languageName: "Lovable AI", aiExplanation: explanation,
    compiledJs: "// ASTERNAL_MANUAL_V2\n" + validateManualCode(code) };
}