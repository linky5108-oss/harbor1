import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CustomSoundSynth, Entity, EntityKind, Project, Scene } from "@/lib/engine/core";
import {
  compileScriptToHtml5Js,
  ENTITY_EVENTS,
  EVENT_LABELS,
  normalizeScripts,
  type EventType,
  type Script,
} from "@/lib/engine/scripts";
import {
  buildGeminiScriptEditPrompt,
  buildGeminiScriptPrompt,
  extractScriptsFromAiPayload,
  parseAiJson,
  requestScriptAi,
  synthesizeScriptsFromRequest,
} from "@/lib/ai/gemini-provider";
import { ENGINE_KNOWLEDGE } from "@/lib/ai/engine-knowledge";
import {
  applyOrionPatchToProject,
  summarizeProjectForOrionArchitect,
  type OrionEditPatch,
} from "@/lib/ai/orion-game-architect";
import {
  compileUserLanguageLocally,
  loadUserLanguage,
  mergeCompiledProgramsIntoRuntimeJs,
  sanitizeOrUpgradeHtml5ScriptJs,
  saveUserLanguageToStorage,
  type CustomLanguageProgram,
  type UserProgrammingLanguage,
} from "@/lib/ai/custom-language";
import { ArrowLeft, Code2, Layers, Loader2, Trash2, X } from "lucide-react";

export interface OrionAiModeScreenProps {
  project: Project;
  onChangeProject: (next: Project) => void;
  onSaveProject?: () => void;
  onExit?: () => void;
  onExitOrionMode?: () => void;
  initialTargetEntityId?: string | null;
}

const KIND_LABELS_ES: Record<EntityKind, string> = {
  player: "Jugador",
  platform: "Plataforma",
  coin: "Moneda",
  enemy: "Enemigo",
  goal: "Meta",
  decor: "Decoración",
};

export const OrionAiModeScreen: React.FC<OrionAiModeScreenProps> = ({
  project,
  onChangeProject,
  onExit,
  onExitOrionMode,
  initialTargetEntityId = null,
}) => {
  const handleExitScreen = () => {
    if (onExitOrionMode) onExitOrionMode();
    else if (onExit) onExit();
  };

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetEntityId, setTargetEntityId] = useState<string | "scene">(
    initialTargetEntityId ? initialTargetEntityId : "scene",
  );
  const [editingScriptKey, setEditingScriptKey] = useState<string | null>(null);
  const [scriptEditPrompt, setScriptEditPrompt] = useState<string>("");
  const [editingBusy, setEditingBusy] = useState<boolean>(false);

  const [userLanguage, setUserLanguage] = useState<UserProgrammingLanguage>(() =>
    loadUserLanguage(project),
  );

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setUserLanguage(loadUserLanguage(project));
  }, [project.customRuntime?.userLanguage]);

  useEffect(() => {
    if (initialTargetEntityId) {
      setTargetEntityId(initialTargetEntityId);
    }
  }, [initialTargetEntityId]);

  const activeScene: Scene = useMemo(() => {
    return project.scenes.find((s) => s.id === project.activeSceneId) ?? project.scenes[0];
  }, [project]);

  useEffect(() => {
    if (
      targetEntityId !== "scene" &&
      !activeScene?.entities.some((e) => e.id === targetEntityId)
    ) {
      setTargetEntityId("scene");
    }
  }, [activeScene, targetEntityId]);

  const targetEntity: Entity | null = useMemo(() => {
    if (targetEntityId === "scene" || !activeScene) return null;
    return activeScene.entities.find((e) => e.id === targetEntityId) ?? null;
  }, [activeScene, targetEntityId]);

  const allEntityScripts = useMemo(() => {
    if (!activeScene) return [];
    const items: Array<{ entity: Entity; script: Script; index: number }> = [];
    for (const ent of activeScene.entities) {
      (ent.scripts ?? []).forEach((sc, idx) => {
        items.push({ entity: ent, script: sc, index: idx });
      });
    }
    return items;
  }, [activeScene]);

  const visibleScripts = useMemo(() => {
    if (targetEntity) {
      return allEntityScripts.filter((item) => item.entity.id === targetEntity.id);
    }
    return allEntityScripts;
  }, [allEntityScripts, targetEntity]);

  const handleSelectScene = (sceneId: string) => {
    if (sceneId === project.activeSceneId) return;
    onChangeProject({
      ...project,
      activeSceneId: sceneId,
    });
  };

  const handleApplyCode = async () => {
    const code = input.trim();
    if (!code || busy || !activeScene) return;

    setBusy(true);
    setErrorMessage(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const recipientEntity =
        targetEntity ??
        activeScene.entities.find((e) => e.controllable || e.kind === "player") ??
        activeScene.entities[0] ??
        null;

      const localCompiled = compileUserLanguageLocally(code, userLanguage, {
        targetEntityId: recipientEntity?.id ?? null,
        targetEntityKind: recipientEntity?.kind,
        allowedEvents: ENTITY_EVENTS,
      });

      let generated: Script[] = [];
      let aiCustomJs = "";
      let aiExplanation = "";
      let aiSynthSounds: Record<string, CustomSoundSynth> = {};
      let aiPatch: Record<string, unknown> | undefined;

      try {
        const prompt = buildGeminiScriptPrompt({
          userRequest: code,
          engineKnowledge: ENGINE_KNOWLEDGE,
          targetEntityKind: recipientEntity?.kind,
          projectSummary: summarizeProjectForOrionArchitect(project),
        });
        const result = await requestScriptAi(prompt, {
          sessionId: `script-${recipientEntity?.id ?? "scene"}`,
          signal: controller.signal,
        });
        const parsed = parseAiJson<unknown>(result.text);
        const extracted = extractScriptsFromAiPayload(parsed);
        if (extracted.customRuntimeJs) aiCustomJs = extracted.customRuntimeJs;
        if (extracted.explanation) aiExplanation = extracted.explanation;
        if (extracted.synthSounds) {
          aiSynthSounds = extracted.synthSounds as Record<string, CustomSoundSynth>;
        }
        if (extracted.patch) {
          aiPatch = extracted.patch;
        }

        const aiScripts = normalizeScripts(extracted.scripts).filter((s) =>
          ENTITY_EVENTS.includes(s.event),
        );
        if (aiScripts.length > 0) {
          generated = aiScripts;
        }
      } catch {
        // Si la petición remota falla, se usa el compilador local HTML5 sin límites
      }

      if (generated.length === 0 && localCompiled.compiledScripts.length > 0) {
        generated = localCompiled.compiledScripts;
      }

      if (generated.length === 0) {
        generated = normalizeScripts(
          synthesizeScriptsFromRequest(code, ENTITY_EVENTS),
        ).filter((s) => ENTITY_EVENTS.includes(s.event));
      }

      const rawEffectiveJs = aiCustomJs
        ? localCompiled.hasSpecificMatch && !aiCustomJs.includes(localCompiled.programId)
          ? `${localCompiled.compiledJs}\n\n${aiCustomJs}`
          : aiCustomJs
        : generated[0]?.compiledJs || localCompiled.compiledJs;

      const effectiveCompiledJs = sanitizeOrUpgradeHtml5ScriptJs(
        rawEffectiveJs,
        code,
        recipientEntity?.id,
        recipientEntity?.kind,
      );

      generated = generated.map((sc) => {
        const scJs = sanitizeOrUpgradeHtml5ScriptJs(
          sc.compiledJs || effectiveCompiledJs || compileScriptToHtml5Js(sc, recipientEntity?.id),
          code,
          recipientEntity?.id,
          recipientEntity?.kind,
        );
        return {
          ...sc,
          customLanguageCode: code,
          languageName: "HTML5",
          compiledJs: scJs,
          aiExplanation: aiExplanation || sc.aiExplanation || localCompiled.explanation,
        };
      });

      let baseProject = project;
      if (aiPatch) {
        baseProject = applyOrionPatchToProject(baseProject, {
          reply: aiExplanation || localCompiled.explanation,
          changesSummary: [],
          ...(aiPatch as Partial<OrionEditPatch>),
          entityUpdates: undefined,
          customRuntimeJs: undefined,
        });
      }

      const currentSceneAfterPatch =
        baseProject.scenes.find((s) => s.id === activeScene.id) ?? activeScene;

      let nextEntities = currentSceneAfterPatch.entities;
      if (recipientEntity && generated.length > 0) {
        nextEntities = currentSceneAfterPatch.entities.map((ent) =>
          ent.id === recipientEntity.id
            ? {
                ...ent,
                scripts: [...(ent.scripts ?? []), ...generated],
              }
            : ent,
        );
      }

      const newProgram: CustomLanguageProgram = {
        id: localCompiled.programId,
        title: localCompiled.title,
        sourceCode: code,
        compiledJs: effectiveCompiledJs,
        compiledScripts: generated,
        explanation: aiExplanation || localCompiled.explanation,
        targetEntityId: recipientEntity?.id ?? null,
        updatedAt: Date.now(),
      };

      const nextLang: UserProgrammingLanguage = {
        ...userLanguage,
        dictionary: [
          ...userLanguage.dictionary,
          ...localCompiled.detectedKeywords.filter(
            (kw) =>
              !userLanguage.dictionary.some(
                (d) => d.keyword.toLowerCase() === kw.keyword.toLowerCase(),
              ),
          ),
        ],
        programs: [
          newProgram,
          ...userLanguage.programs.filter((p) => p.sourceCode.trim() !== code),
        ].slice(0, 30),
      };

      saveUserLanguageToStorage(nextLang);
      setUserLanguage(nextLang);

      const mergedJs = mergeCompiledProgramsIntoRuntimeJs(
        baseProject.customRuntime?.jsCode,
        nextLang.programs,
      );

      const nextScene: Scene = {
        ...currentSceneAfterPatch,
        entities: nextEntities,
      };

      const nextProject: Project = {
        ...baseProject,
        scenes: baseProject.scenes.map((s) => (s.id === activeScene.id ? nextScene : s)),
        customRuntime: {
          ...(baseProject.customRuntime ?? {}),
          jsCode: mergedJs,
          synthSounds: {
            ...(baseProject.customRuntime?.synthSounds ?? {}),
            ...localCompiled.synthSounds,
            ...aiSynthSounds,
          },
          userLanguage: nextLang,
        },
      };

      onChangeProject(nextProject);
      setInput("");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "No se pudo aplicar el script HTML5.",
      );
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const handleEditExistingScript = async (entity: Entity, script: Script) => {
    const instruction = scriptEditPrompt.trim();
    if (!instruction || editingBusy || !activeScene) return;

    setEditingBusy(true);
    setErrorMessage(null);

    try {
      const localCompiled = compileUserLanguageLocally(instruction, userLanguage, {
        targetEntityId: entity.id,
        targetEntityKind: entity.kind,
        allowedEvents: [script.event],
      });

      let updatedScript: Script | null = null;

      try {
        const prompt = buildGeminiScriptEditPrompt({
          instruction,
          engineKnowledge: ENGINE_KNOWLEDGE,
          currentScript: script,
          targetEntityKind: entity.kind,
          projectSummary: summarizeProjectForOrionArchitect(project),
        });
        const res = await requestScriptAi(prompt, {
          sessionId: `edit-script-${script.id}`,
        });
        const parsed = parseAiJson<unknown>(res.text);
        const extracted = extractScriptsFromAiPayload(parsed);
        const normalized = normalizeScripts(extracted.scripts);
        if (normalized.length > 0) {
          const aiJs = extracted.customRuntimeJs || normalized[0].compiledJs;
          const nextJs = sanitizeOrUpgradeHtml5ScriptJs(
            aiJs || localCompiled.compiledJs || compileScriptToHtml5Js(normalized[0], entity.id),
            instruction,
            entity.id,
            entity.kind,
          );
          updatedScript = {
            ...normalized[0],
            id: script.id,
            event: normalized[0].event ?? script.event,
            customLanguageCode: instruction,
            languageName: "HTML5",
            compiledJs: nextJs,
          };
        }
      } catch {
        // fallback local HTML5
      }

      if (!updatedScript && localCompiled.compiledScripts.length > 0) {
        const nextJs = sanitizeOrUpgradeHtml5ScriptJs(
          localCompiled.compiledJs,
          instruction,
          entity.id,
          entity.kind,
        );
        updatedScript = {
          ...localCompiled.compiledScripts[0],
          id: script.id,
          event: localCompiled.compiledScripts[0].event ?? script.event,
          customLanguageCode: instruction,
          languageName: "HTML5",
          compiledJs: nextJs,
        };
      }

      if (!updatedScript) {
        const fallback = normalizeScripts(
          synthesizeScriptsFromRequest(instruction, [script.event]),
        );
        const nextJs = sanitizeOrUpgradeHtml5ScriptJs(
          fallback[0]?.compiledJs || localCompiled.compiledJs || script.compiledJs,
          instruction,
          entity.id,
          entity.kind,
        );
        updatedScript = {
          ...(fallback[0] ?? script),
          id: script.id,
          event: script.event,
          customLanguageCode: instruction,
          languageName: "HTML5",
          compiledJs: nextJs,
        };
      }

      const nextEntities = activeScene.entities.map((e) => {
        if (e.id !== entity.id) return e;
        return {
          ...e,
          scripts: (e.scripts ?? []).map((s) => (s.id === script.id ? updatedScript! : s)),
        };
      });

      const nextPrograms = userLanguage.programs.map((p) =>
        p.sourceCode.trim() === (script.customLanguageCode ?? "").trim()
          ? {
              ...p,
              sourceCode: instruction,
              compiledJs: updatedScript?.compiledJs || p.compiledJs,
              updatedAt: Date.now(),
            }
          : p,
      );
      const nextLang = { ...userLanguage, programs: nextPrograms };
      saveUserLanguageToStorage(nextLang);
      setUserLanguage(nextLang);

      const mergedJs = mergeCompiledProgramsIntoRuntimeJs(
        project.customRuntime?.jsCode,
        nextPrograms,
      );

      const nextScene: Scene = { ...activeScene, entities: nextEntities };
      onChangeProject({
        ...project,
        scenes: project.scenes.map((s) => (s.id === activeScene.id ? nextScene : s)),
        customRuntime: {
          ...(project.customRuntime ?? {}),
          jsCode: mergedJs,
          userLanguage: nextLang,
        },
      });
      setEditingScriptKey(null);
      setScriptEditPrompt("");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo actualizar el script HTML5.");
    } finally {
      setEditingBusy(false);
    }
  };

  const handleDeleteScript = (entityId: string, scriptId: string) => {
    if (!activeScene) return;
    const targetEnt = activeScene.entities.find((e) => e.id === entityId);
    const removedScript = targetEnt?.scripts?.find((s) => s.id === scriptId);
    const nextEntities = activeScene.entities.map((e) => {
      if (e.id !== entityId) return e;
      return {
        ...e,
        scripts: (e.scripts ?? []).filter((s) => s.id !== scriptId),
      };
    });
    const nextPrograms = removedScript?.customLanguageCode
      ? userLanguage.programs.filter(
          (p) => p.sourceCode.trim() !== removedScript.customLanguageCode!.trim(),
        )
      : userLanguage.programs;
    const nextLang = { ...userLanguage, programs: nextPrograms };
    saveUserLanguageToStorage(nextLang);
    setUserLanguage(nextLang);
    const mergedJs = mergeCompiledProgramsIntoRuntimeJs(
      project.customRuntime?.jsCode,
      nextPrograms,
    );
    const nextScene: Scene = { ...activeScene, entities: nextEntities };
    onChangeProject({
      ...project,
      scenes: project.scenes.map((s) => (s.id === activeScene.id ? nextScene : s)),
      customRuntime: {
        ...(project.customRuntime ?? {}),
        jsCode: mergedJs,
        userLanguage: nextLang,
      },
    });
  };

  const handleChangeScriptEvent = (entityId: string, scriptId: string, nextEvent: EventType) => {
    if (!activeScene) return;
    const nextEntities = activeScene.entities.map((e) => {
      if (e.id !== entityId) return e;
      return {
        ...e,
        scripts: (e.scripts ?? []).map((s) => {
          if (s.id !== scriptId) return s;
          const updated: Script = { ...s, event: nextEvent };
          updated.compiledJs = sanitizeOrUpgradeHtml5ScriptJs(
            s.compiledJs || compileScriptToHtml5Js(updated, entityId),
            s.customLanguageCode,
            entityId,
            e.kind,
          );
          return updated;
        }),
      };
    });
    const nextScene: Scene = { ...activeScene, entities: nextEntities };
    onChangeProject({
      ...project,
      scenes: project.scenes.map((s) => (s.id === activeScene.id ? nextScene : s)),
    });
  };

  return (
    <div
      data-testid="orion-ai-mode-fullscreen"
      className="fixed inset-0 z-[120] flex flex-col bg-background text-foreground select-none overflow-hidden"
    >
      {/* Barra superior en una sola línea */}
      <header className="editor-bar shrink-0 flex flex-nowrap items-center justify-between gap-2 px-3 sm:px-5 py-2.5 border-b border-line-strong bg-card">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            data-testid="orion-exit-btn"
            onClick={handleExitScreen}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-foreground bg-card hover:bg-muted/60 border border-line-strong transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
              <Code2 className="w-4 h-4 text-primary" />
            </span>
            <h1 className="text-xs sm:text-sm font-display font-bold tracking-tight text-foreground truncate">
              Scripts HTML5
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap">
          <div className="flex items-center gap-1 bg-card border border-line-strong rounded-lg px-2 py-1">
            <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
            <select
              data-testid="orion-scene-selector"
              value={activeScene?.id ?? ""}
              onChange={(e) => handleSelectScene(e.target.value)}
              className="bg-transparent text-[11px] font-semibold text-foreground focus:outline-none pr-1 max-w-[95px] sm:max-w-[150px] truncate"
            >
              {project.scenes.map((sc) => (
                <option key={sc.id} value={sc.id} className="bg-card text-foreground">
                  {sc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-card border border-line-strong rounded-lg px-2 py-1">
            <select
              data-testid="orion-entity-target-selector"
              value={targetEntityId}
              onChange={(e) => setTargetEntityId(e.target.value)}
              className="bg-transparent text-[11px] font-semibold text-foreground focus:outline-none max-w-[110px] sm:max-w-[180px] truncate"
            >
              <option value="scene" className="bg-card text-foreground">
                Todos los objetos ({activeScene?.name ?? "Escena"})
              </option>
              {(activeScene?.entities ?? []).map((ent) => (
                <option key={ent.id} value={ent.id} className="bg-card text-foreground">
                  {ent.name || KIND_LABELS_ES[ent.kind]} ({(ent.scripts ?? []).length})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Contenido único: Cuadro de scripts HTML5 + Recuadro para escribir código */}
      <div className="flex-1 min-h-0 flex flex-col max-w-3xl w-full mx-auto p-3 sm:p-5 gap-3 overflow-hidden">
        {/* Cuadro de scripts */}
        <div
          data-testid="orion-scripts-drawer"
          className="panel flex-1 min-h-0 flex flex-col rounded-xl border border-line-strong bg-card overflow-hidden"
        >
          <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
            <span className="text-xs font-display font-bold uppercase tracking-wider text-primary">
              Scripts HTML5 ({visibleScripts.length})
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
            {visibleScripts.length === 0 ? (
              <div className="h-full min-h-[120px] flex items-center justify-center rounded-xl border border-dashed border-line-strong p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Sin scripts activos. Escribe cualquier mecánica, objeto, vehículo, arma o código HTML5/Canvas abajo para crearlo sin límites.
                </p>
              </div>
            ) : (
              visibleScripts.map(({ entity, script }, idx) => {
                const key = `${entity.id}:${script.id}`;
                const isEditing = editingScriptKey === key;
                const html5Code = sanitizeOrUpgradeHtml5ScriptJs(
                  script.compiledJs || compileScriptToHtml5Js(script, entity.id),
                  script.customLanguageCode,
                  entity.id,
                  entity.kind,
                );
                return (
                  <div
                    key={key}
                    className="rounded-xl bg-surface-2/60 border border-line-strong p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-nowrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
                          #{idx + 1} · HTML5
                        </span>
                        <span className="text-xs font-bold text-foreground truncate">
                          {entity.name || KIND_LABELS_ES[entity.kind]}
                        </span>
                        <select
                          value={script.event}
                          onChange={(e) =>
                            handleChangeScriptEvent(
                              entity.id,
                              script.id,
                              e.target.value as EventType,
                            )
                          }
                          className="bg-card border border-line-strong rounded-lg px-2 py-1 text-xs font-semibold text-foreground focus:outline-none"
                        >
                          {ENTITY_EVENTS.map((ev) => (
                            <option key={ev} value={ev} className="bg-card text-foreground">
                              {EVENT_LABELS[ev]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingScriptKey(isEditing ? null : key);
                            setScriptEditPrompt(script.customLanguageCode || html5Code);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-card text-foreground hover:bg-muted/60 border border-line-strong transition"
                        >
                          {isEditing ? "Cerrar" : "Editar HTML5"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteScript(entity.id, script.id)}
                          className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 border border-line-strong transition"
                          title="Eliminar script"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {script.aiExplanation && (
                      <p className="text-[11px] text-muted-foreground">
                        {script.aiExplanation}
                      </p>
                    )}

                    <pre className="rounded-lg bg-card border border-line px-3 py-2 font-mono text-[11px] text-foreground whitespace-pre-wrap overflow-x-auto max-h-48">
                      {`<script data-asternal-script-id="${script.id}">\n${html5Code}\n</script>`}
                    </pre>

                    {isEditing && (
                      <div className="pt-2 border-t border-line space-y-2">
                        <textarea
                          value={scriptEditPrompt}
                          onChange={(e) => setScriptEditPrompt(e.target.value)}
                          rows={4}
                          disabled={editingBusy}
                          placeholder="Escribe cualquier instrucción o código HTML5 / JavaScript..."
                          className="w-full px-3 py-2 rounded-lg bg-card border border-line-strong font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={editingBusy || !scriptEditPrompt.trim()}
                          onClick={() => void handleEditExistingScript(entity, script)}
                          className="w-full py-2 rounded-lg text-xs font-display font-bold btn-grad text-primary-foreground disabled:opacity-40 transition"
                        >
                          {editingBusy ? "Aplicando..." : "Aplicar"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="shrink-0 rounded-xl px-3.5 py-2 bg-destructive/10 border border-destructive/35 text-xs text-destructive flex items-center justify-between gap-2">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-destructive hover:opacity-80"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Recuadro para escribir cualquier idea o código HTML5 + botón Aplicar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleApplyCode();
          }}
          className="panel shrink-0 rounded-xl border border-line-strong bg-card p-3 space-y-2.5"
        >
          <textarea
            data-testid="orion-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            rows={4}
            placeholder="Crea cualquier cosa sin límites del editor (vehículos, armas, agua/nado, clima, jefes, inventario, objetos personalizados o código HTML5/Canvas directo)..."
            className="w-full resize-none rounded-lg bg-surface-2/40 border border-line-strong px-3.5 py-2.5 font-mono text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
          />

          <button
            type="submit"
            data-testid="orion-send-btn"
            disabled={busy || !input.trim()}
            className="w-full h-10 rounded-lg btn-grad disabled:opacity-40 text-primary-foreground font-display text-xs font-bold tracking-wider inline-flex items-center justify-center gap-2 transition"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{busy ? "Aplicando..." : "Aplicar"}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

