import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

const KEY = "ast_custom_palette";

/** Paleta personal: el usuario elige cualquier color y lo guarda para reutilizarlo. */
export function CustomPalette({ current, onPick }: { current: string; onPick: (c: string) => void }) {
  const [colors, setColors] = useState<string[]>([]);
  const [draft, setDraft] = useState(current);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); if (Array.isArray(v)) setColors(v); } catch { /* ignore */ }
  }, []);
  useEffect(() => { setDraft(current); }, [current]);
  const save = (next: string[]) => { setColors(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ } };
  const add = () => { const c = draft.toLowerCase(); if (!colors.includes(c)) save([c, ...colors].slice(0, 32)); onPick(c); };
  return (
    <div className="mt-3">
      <p className="mb-2 text-xs text-muted-foreground">Mi paleta</p>
      <div className="flex items-center gap-2 mb-2">
        <input type="color" value={draft} onChange={e => { setDraft(e.target.value); onPick(e.target.value); }}
          aria-label="Elegir color propio" className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-muted" />
        <button onClick={add} className="inline-flex items-center gap-1 h-9 px-3 rounded-full border border-line bg-card text-xs font-medium hover:bg-accent">
          <Plus size={14} /> Guardar color
        </button>
      </div>
      {colors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {colors.map(c => (
            <span key={c} className="relative">
              <button aria-label={`Mi color ${c}`} onClick={() => onPick(c)}
                className={`h-8 w-8 rounded-lg border border-line ${current.toLowerCase() === c ? "ring-2 ring-primary" : ""}`} style={{ background: c }} />
              <button aria-label={`Quitar ${c}`} onClick={() => save(colors.filter(x => x !== c))}
                className="absolute -top-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full bg-card border border-line"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
