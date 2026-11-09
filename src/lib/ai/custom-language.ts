import { uid, type CustomSoundSynth, type EntityKind, type Project } from "../engine/core";
import type { Block, EventType, Script } from "../engine/scripts";

export type CustomKeywordCategory = "evento" | "condicion" | "accion" | "regla";

export interface CustomKeywordRule {
  id: string;
  keyword: string;
  meaning: string;
  category: CustomKeywordCategory;
}

export interface CustomLanguageProgram {
  id: string;
  title: string;
  sourceCode: string;
  compiledJs: string;
  compiledScripts?: Script[];
  explanation: string;
  targetEntityId?: string | null;
  updatedAt: number;
}

export interface UserProgrammingLanguage {
  name: string;
  syntaxRules: string;
  dictionary: CustomKeywordRule[];
  programs: CustomLanguageProgram[];
}

export interface CompiledCustomLanguageResult {
  programId: string;
  title: string;
  sourceCode: string;
  expandedSourceCode: string;
  compiledJs: string;
  compiledScripts: Script[];
  synthSounds: Record<string, CustomSoundSynth>;
  explanation: string;
  detectedKeywords: CustomKeywordRule[];
  hasSpecificMatch?: boolean;
}

export const USER_LANGUAGE_STORAGE_KEY = "asternal_user_programming_language_v1";

export const DEFAULT_USER_LANGUAGE: UserProgrammingLanguage = {
  name: "AsternalLang Propio",
  syntaxRules:
    "Cada bloque inicia con una condición o instrucción de evento terminada en ':' (por ejemplo 'SI el jugador pierde:', 'CUANDO toque enemigo:', 'AL presionar ESPACIO:', 'CADA 2 segundos:') y debajo se escriben las acciones inventadas por el usuario (por ejemplo 'MOSTRAR sonido en el mapa', 'INVOCAR onda de energia', 'SUMAR 10 puntos'). Cada usuario puede inventar sus propias palabras clave, verbos y reglas.",
  dictionary: [
    {
      id: "kw-si-pierde",
      keyword: "SI el jugador pierde:",
      meaning: "Evento cuando el jugador pierde o queda sin vidas (onLose / state.dead)",
      category: "evento",
    },
    {
      id: "kw-mostrar-sonido-mapa",
      keyword: "MOSTRAR sonido en el mapa",
      meaning:
        "Emitir sonido sintetizado y dibujar una onda visual de radar sonoro en la posición del mapa HTML5",
      category: "accion",
    },
    {
      id: "kw-cuando-toca",
      keyword: "CUANDO el jugador toca enemigo:",
      meaning: "Evento de colisión entre el jugador y un enemigo (onCollide)",
      category: "evento",
    },
    {
      id: "kw-al-ganar",
      keyword: "SI el jugador gana:",
      meaning: "Evento cuando el jugador alcanza la meta o gana la partida (onWin)",
      category: "evento",
    },
    {
      id: "kw-cada-segundo",
      keyword: "CADA 2 segundos:",
      meaning: "Temporizador periódico que ejecuta las acciones cada N segundos (onTimer)",
      category: "evento",
    },
    {
      id: "kw-crear-explosion",
      keyword: "INVOCAR onda de energia",
      meaning: "Sacudir la cámara y emitir un pulso expansivo de energía en el mapa",
      category: "accion",
    },
  ],
  programs: [],
};

export const CUSTOM_LANGUAGE_TEMPLATES: Array<{
  id: string;
  label: string;
  badge: string;
  description: string;
  code: string;
}> = [
  {
    id: "tpl-lose-sound-map",
    label: "SI el jugador pierde → Sonido en el mapa",
    badge: "Ejemplo Base",
    description: "Detecta cuando el jugador pierde, reproduce una señal sonora y dibuja ondas de sonido en el mapa.",
    code: `SI el jugador pierde:\nMOSTRAR sonido en el mapa`,
  },
  {
    id: "tpl-lose-full",
    label: "Derrota con radar y cámara",
    badge: "Evento + Mapa",
    description: "Combina sonido en el mapa, sacudida de cámara y mensaje al perder.",
    code: `SI el jugador pierde:\nMOSTRAR sonido en el mapa\nSACUDIR camara 10\nDECIR "¡Señal de auxilio en el mapa!"`,
  },
  {
    id: "tpl-custom-combo",
    label: "Regla de impacto con enemigo",
    badge: "Colisión",
    description: "Define en tu propio lenguaje qué ocurre al tocar un enemigo.",
    code: `CUANDO el jugador toca enemigo:\nMOSTRAR sonido en el mapa\nEMPUJAR hacia atras\nRESTAR 1 vida`,
  },
  {
    id: "tpl-custom-power",
    label: "Poder especial al saltar",
    badge: "Habilidad",
    description: "Activa una onda de energía y puntos extra al presionar salto.",
    code: `AL presionar SALTO:\nINVOCAR onda de energia\nSALTAR con fuerza 520\nSUMAR 25 puntos`,
  },
  {
    id: "tpl-radar-timer",
    label: "Radar periódico cada 3s",
    badge: "Temporizador",
    description: "Emite un pulso sonoro en el mapa cada 3 segundos y persigue al jugador.",
    code: `CADA 3 segundos:\nMOSTRAR sonido en el mapa\nPERSEGUIR al jugador con velocidad 160`,
  },
];

function sanitizeUserLanguage(raw: unknown): UserProgrammingLanguage {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_USER_LANGUAGE,
      dictionary: DEFAULT_USER_LANGUAGE.dictionary.map((d) => ({ ...d })),
      programs: [],
    };
  }
  const obj = raw as Record<string, unknown>;
  const name =
    typeof obj.name === "string" && obj.name.trim().length > 0
      ? obj.name.trim().slice(0, 60)
      : DEFAULT_USER_LANGUAGE.name;
  const syntaxRules =
    typeof obj.syntaxRules === "string" && obj.syntaxRules.trim().length > 0
      ? obj.syntaxRules.trim().slice(0, 1200)
      : DEFAULT_USER_LANGUAGE.syntaxRules;

  const dictionary: CustomKeywordRule[] = Array.isArray(obj.dictionary)
    ? obj.dictionary
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, idx): CustomKeywordRule => {
          const cat: CustomKeywordCategory =
            item.category === "evento" ||
            item.category === "condicion" ||
            item.category === "accion" ||
            item.category === "regla"
              ? item.category
              : "accion";
          return {
            id: typeof item.id === "string" && item.id ? item.id : `kw-${idx}-${uid()}`,
            keyword: typeof item.keyword === "string" ? item.keyword.trim() : "",
            meaning: typeof item.meaning === "string" ? item.meaning.trim() : "",
            category: cat,
          };
        })
        .filter((item) => item.keyword.length > 0)
    : DEFAULT_USER_LANGUAGE.dictionary.map((d) => ({ ...d }));

  const programs: CustomLanguageProgram[] = Array.isArray(obj.programs)
    ? obj.programs
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item, idx) => ({
          id: typeof item.id === "string" && item.id ? item.id : `prog-${idx}-${uid()}`,
          title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : `Programa #${idx + 1}`,
          sourceCode: typeof item.sourceCode === "string" ? item.sourceCode : "",
          compiledJs: typeof item.compiledJs === "string" ? item.compiledJs : "",
          compiledScripts: Array.isArray(item.compiledScripts) ? (item.compiledScripts as Script[]) : undefined,
          explanation: typeof item.explanation === "string" ? item.explanation : "",
          targetEntityId: typeof item.targetEntityId === "string" ? item.targetEntityId : null,
          updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now(),
        }))
        .filter((item) => item.sourceCode.trim().length > 0 || item.compiledJs.trim().length > 0)
    : [];

  return {
    name,
    syntaxRules,
    dictionary: dictionary.length > 0 ? dictionary : DEFAULT_USER_LANGUAGE.dictionary.map((d) => ({ ...d })),
    programs,
  };
}

export function loadUserLanguage(project?: Project | null): UserProgrammingLanguage {
  const fromProject = project?.customRuntime?.userLanguage;
  let stored: UserProgrammingLanguage | null = null;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(USER_LANGUAGE_STORAGE_KEY);
      if (raw) {
        stored = sanitizeUserLanguage(JSON.parse(raw));
      }
    } catch {
      // Ignore storage read errors
    }
  }

  if (fromProject) {
    const projectLang = sanitizeUserLanguage(fromProject);
    if (stored) {
      const seen = new Set(projectLang.dictionary.map((d) => d.keyword.toLowerCase()));
      const mergedDict = [...projectLang.dictionary];
      for (const item of stored.dictionary) {
        if (!seen.has(item.keyword.toLowerCase())) {
          seen.add(item.keyword.toLowerCase());
          mergedDict.push(item);
        }
      }
      return {
        ...projectLang,
        dictionary: mergedDict,
      };
    }
    return projectLang;
  }

  if (stored) {
    return stored;
  }

  return sanitizeUserLanguage(DEFAULT_USER_LANGUAGE);
}

export function saveUserLanguageToStorage(lang: UserProgrammingLanguage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_LANGUAGE_STORAGE_KEY, JSON.stringify(lang));
  } catch {
    // Ignore storage quota errors
  }
}

export function mergeCompiledProgramsIntoRuntimeJs(
  existingJs: string | undefined,
  programs: CustomLanguageProgram[]
): string {
  const base = (existingJs || "")
    .replace(/\/\/ \[BEGIN_USER_LANG_PROGRAM:[^\]]+\][\s\S]*?\/\/ \[END_USER_LANG_PROGRAM:[^\]]+\]\n?/g, "")
    .trim();

  const blocks = programs
    .filter((p) => p.compiledJs && p.compiledJs.trim().length > 0)
    .map(
      (p) =>
        `// [BEGIN_USER_LANG_PROGRAM:${p.id}]\n` +
        `// Lenguaje del usuario · ${p.title.replace(/\r?\n/g, " ")}\n` +
        `${p.compiledJs.trim()}\n` +
        `// [END_USER_LANG_PROGRAM:${p.id}]`
    );

  if (blocks.length === 0) return base;
  return [base, ...blocks].filter(Boolean).join("\n\n");
}

export function extractCustomKeywordsFromCode(
  code: string,
  existingDictionary: CustomKeywordRule[] = []
): CustomKeywordRule[] {
  const known = new Set(existingDictionary.map((d) => d.keyword.trim().toLowerCase()));
  const discovered: CustomKeywordRule[] = [];
  const lines = code
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith("//") || line.startsWith("#")) continue;
    const isHeader = line.endsWith(":") || /^(si|cuando|al|cada|if|when|on)\b/i.test(line);
    if (isHeader) {
      const normalized = line.endsWith(":") ? line : `${line}:`;
      const keyLower = normalized.toLowerCase();
      if (!known.has(keyLower)) {
        known.add(keyLower);
        discovered.push({
          id: `kw-auto-${uid()}`,
          keyword: normalized,
          meaning: inferMeaningForLine(normalized, "evento"),
          category: "evento",
        });
      }
      continue;
    }

    const upperVerbMatch = line.match(/^([A-ZÁÉÍÓÚÑ_]{2,}(?:\s+[a-záéíóúñA-ZÁÉÍÓÚÑ0-9_]+){0,4})/);
    const candidate = upperVerbMatch ? line : line.slice(0, 60);
    const keyLower = candidate.toLowerCase();
    if (candidate.length >= 3 && !known.has(keyLower)) {
      known.add(keyLower);
      discovered.push({
        id: `kw-auto-${uid()}`,
        keyword: candidate,
        meaning: inferMeaningForLine(candidate, "accion"),
        category: "accion",
      });
    }
  }

  return discovered;
}

function inferMeaningForLine(line: string, category: CustomKeywordCategory): string {
  const lower = line.toLowerCase();
  if (category === "evento") {
    if (/pierde|muere|derrota|sin vida|lose|game over/.test(lower)) {
      return "Disparar cuando el jugador pierde o queda sin vidas (onLose)";
    }
    if (/gana|meta|victoria|win/.test(lower)) {
      return "Disparar cuando el jugador gana o llega a la meta (onWin)";
    }
    if (/toca|choca|colision|enemigo|peligro/.test(lower)) {
      return "Disparar cuando ocurre una colisión entre entidades en el mapa (onCollide)";
    }
    if (/tecla|presiona|espacio|salto|boton|input/.test(lower)) {
      return "Disparar al presionar una tecla o control del jugador (onKeyDown)";
    }
    if (/cada|segundo|tiempo|timer/.test(lower)) {
      return "Disparar periódicamente por temporizador en el motor (onTimer)";
    }
    if (/iniciar|empezar|comienza|inicio/.test(lower)) {
      return "Disparar al iniciar la escena o partida (onStart)";
    }
    return "Condición o evento personalizado definido por el usuario en su lenguaje";
  }

  if (/mostrar\s+sonido.*mapa|sonido.*mapa|radar.*sonido|eco.*mapa/.test(lower)) {
    return "Emitir sonido sintetizado y renderizar ondas visuales de sonido en el mapa HTML5";
  }
  if (/sonido|audio|alarma|musica|beep|ruido/.test(lower)) {
    return "Reproducir un efecto de sonido sintetizado en el motor";
  }
  if (/sacudir|temblar|vibrar|camara/.test(lower)) {
    return "Sacudir la cámara del mapa con intensidad";
  }
  if (/saltar|impulso|brincar/.test(lower)) {
    return "Impulsar la entidad verticalmente hacia arriba";
  }
  if (/perseguir|seguir|buscar/.test(lower)) {
    return "Mover la entidad automáticamente hacia la posición del jugador";
  }
  if (/puntos|moneda|score|sumar/.test(lower)) {
    return "Modificar la puntuación global del jugador";
  }
  if (/vida|curar|daño|restar/.test(lower)) {
    return "Modificar las vidas o salud del jugador";
  }
  if (/decir|mostrar|mensaje|texto|alerta/.test(lower)) {
    return "Mostrar un mensaje flotante y marcador visual en el mapa";
  }
  return "Instrucción ejecutable en el motor HTML5 / JavaScript según la intención del usuario";
}

export function expandCodeWithUserDictionary(
  code: string,
  dictionary: CustomKeywordRule[]
): { expandedCode: string; matchedRules: CustomKeywordRule[] } {
  const matchedRules: CustomKeywordRule[] = [];
  let expandedCode = code;

  for (const rule of dictionary) {
    const kw = rule.keyword.trim();
    if (!kw) continue;
    const strippedKw = kw.replace(/:$/, "").trim();
    if (!strippedKw) continue;
    if (code.toLowerCase().includes(strippedKw.toLowerCase())) {
      matchedRules.push(rule);
      expandedCode += `\n// [DICCIONARIO "${kw}" => ${rule.meaning}]`;
    }
  }

  return { expandedCode, matchedRules };
}

export function buildUserLanguagePromptContext(
  lang: UserProgrammingLanguage,
  userCode: string
): string {
  const { matchedRules } = expandCodeWithUserDictionary(userCode, lang.dictionary);
  const dictLines = lang.dictionary
    .slice(0, 30)
    .map((d) => `  - "${d.keyword}" (${d.category.toUpperCase()}) => ${d.meaning}`)
    .join("\n");

  const matchedLines =
    matchedRules.length > 0
      ? matchedRules.map((d) => `  * COINCIDENCIA ACTIVA: "${d.keyword}" significa: ${d.meaning}`).join("\n")
      : "  * Interpreta directamente las palabras y sintaxis inventadas por el usuario.";

  return [
    `=== SISTEMA DE LENGUAJE DE PROGRAMACIÓN INVENTADO POR EL USUARIO ===`,
    `Nombre del lenguaje del usuario: "${lang.name}"`,
    `Reglas de sintaxis definidas por el usuario: ${lang.syntaxRules}`,
    `Diccionario de instrucciones del usuario:\n${dictLines || "  (Sin reglas predefinidas; interpreta libremente)"}`,
    `Instrucciones del diccionario detectadas en este código:\n${matchedLines}`,
    `Código escrito por el usuario en su propio lenguaje:\n\`\`\`\n${userCode.trim()}\n\`\`\``,
    `OBJETIVO DEL TRADUCTOR IA:`,
    `1. Comprende exactamente qué quiso expresar el usuario en su lenguaje inventado (por ejemplo: "SI el jugador pierde:\\nMOSTRAR sonido en el mapa").`,
    `2. Tradúcelo en código JavaScript/HTML5 100% funcional en "customRuntimeJs" usando window.AsternalRuntime.registerHook({...}) y window.AsternalAudio.registerSound(...) para que se ejecute a 60 FPS en el motor HTML5.`,
    `3. Además, genera los bloques "scripts" equivalentes del motor (onLose, onCollide, onUpdate, onStart, onKeyDown, onTimer, etc.) para las entidades correspondientes.`,
  ].join("\n");
}

interface ParsedUserBlock {
  header: string;
  eventType: EventType;
  key?: "left" | "right" | "jump";
  intervalMs?: number;
  withKind?: EntityKind | "any";
  actions: string[];
}

function parseUserLanguageBlocks(code: string, dictionary: CustomKeywordRule[]): ParsedUserBlock[] {
  const rawLines = code
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("#"));

  const enrichLine = (line: string): string => {
    let enriched = line;
    for (const rule of dictionary) {
      const kwClean = rule.keyword.replace(/:$/, "").trim();
      if (kwClean && line.toLowerCase().includes(kwClean.toLowerCase())) {
        enriched = `${enriched} (${rule.meaning})`;
      }
    }
    return enriched;
  };

  const blocks: ParsedUserBlock[] = [];
  let current: ParsedUserBlock | null = null;

  for (const rawLine of rawLines) {
    const inlineSplit = rawLine.match(
      /^(?:(si|cuando|al|cada|if|when|on)\b[^:>-]*?)(?:\s*(?::|->|=>|\bentonces\b)\s*)(.+)$/i
    );
    if (inlineSplit && inlineSplit[2] && !rawLine.endsWith(":")) {
      const headerPart = rawLine.slice(0, rawLine.indexOf(inlineSplit[2])).trim();
      const actionPart = inlineSplit[2].trim();
      const headerInfo = classifyHeaderEvent(enrichLine(headerPart));
      current = {
        header: headerPart,
        ...headerInfo,
        actions: [enrichLine(actionPart)],
      };
      blocks.push(current);
      continue;
    }

    const enriched = enrichLine(rawLine);
    const looksLikeHeader =
      rawLine.endsWith(":") ||
      /^(si|cuando|al|cada|if|when|on|mientras|siempre\s+que)\b/i.test(rawLine) ||
      /\b(onLose|onWin|onCollide|onKeyDown|onTimer|onStart|onUpdate)\b/i.test(enriched);

    if (looksLikeHeader && (rawLine.endsWith(":") || current === null)) {
      const headerInfo = classifyHeaderEvent(enriched);
      current = {
        header: rawLine,
        ...headerInfo,
        actions: [],
      };
      blocks.push(current);
    } else {
      if (!current) {
        const isContinuous = /\b(siempre|continuamente|cada\s+fotograma|perseguir|seguir|patrullar|rotar|orbitar)\b/i.test(enriched);
        current = {
          header: isContinuous ? "MIENTRAS corre el juego:" : "AL iniciar en el juego:",
          eventType: isContinuous ? "onUpdate" : "onStart",
          actions: [],
        };
        blocks.push(current);
      }
      current.actions.push(enriched);
    }
  }

  if (blocks.length === 0 && rawLines.length > 0) {
    blocks.push({
      header: rawLines[0],
      ...classifyHeaderEvent(enrichLine(rawLines[0])),
      actions: rawLines.map(enrichLine),
    });
  }

  for (const b of blocks) {
    if (b.actions.length === 0) {
      b.actions.push(enrichLine(b.header));
    }
  }

  return blocks;
}

function classifyHeaderEvent(header: string): {
  eventType: EventType;
  key?: "left" | "right" | "jump";
  intervalMs?: number;
  withKind?: EntityKind | "any";
} {
  const lower = header.toLowerCase();
  if (/pierde|muere|derrota|sin\s+vida|game\s*over|onlose|caer|cae\s+al\s+vacio/.test(lower)) {
    return { eventType: "onLose" };
  }
  if (/gana|victoria|meta|onwin|completar|trofeo/.test(lower)) {
    return { eventType: "onWin" };
  }
  if (/cada|segundo|segundos|intervalo|ontimer|reloj/.test(lower)) {
    const numMatch = lower.match(/(\d+(?:\.\d+)?)/);
    const seconds = numMatch ? Math.max(0.2, Math.min(30, Number(numMatch[1]))) : 2;
    return { eventType: "onTimer", intervalMs: Math.round(seconds * 1000) };
  }
  if (/tecla|presiona|presionar|pulsar|onkeydown|espacio|space|salto|flecha/.test(lower)) {
    let key: "left" | "right" | "jump" = "jump";
    if (/izquierda|left|tecla\s+a\b/.test(lower)) key = "left";
    else if (/derecha|right|tecla\s+d\b/.test(lower)) key = "right";
    return { eventType: "onKeyDown", key };
  }
  if (/toca|choca|colision|colisiona|oncollide|enemigo|peligro|moneda|bloque/.test(lower)) {
    let withKind: EntityKind | "any" = "any";
    if (/enemigo|enemy|jefe|peligro/.test(lower)) withKind = "enemy";
    else if (/moneda|coin/.test(lower)) withKind = "coin";
    else if (/jugador|player/.test(lower)) withKind = "player";
    else if (/meta|goal/.test(lower)) withKind = "goal";
    return { eventType: "onCollide", withKind };
  }
  if (/aterriza|suelo|onland/.test(lower)) {
    return { eventType: "onLand" };
  }
  if (/sale.*pantalla|onleavescreen/.test(lower)) {
    return { eventType: "onLeaveScreen" };
  }
  if (/iniciar|inicio|empieza|comienza|onstart/.test(lower)) {
    return { eventType: "onStart" };
  }
  if (/mientras|siempre|continuamente|cada\s+fotograma|onupdate|perseguir|patrullar/.test(lower)) {
    return { eventType: "onUpdate" };
  }
  return { eventType: "onStart" };
}

export function compileUserLanguageLocally(
  userCode: string,
  lang: UserProgrammingLanguage,
  opts?: {
    programId?: string;
    title?: string;
    targetEntityId?: string | null;
    targetEntityKind?: EntityKind;
    allowedEvents?: EventType[];
  }
): CompiledCustomLanguageResult {
  const programId = opts?.programId || `ulp-${uid()}`;
  const cleanCode = userCode.trim();
  const firstLine = cleanCode.split(/\r?\n/)[0]?.replace(/:$/, "").trim() || "Programa personalizado";
  const title = opts?.title?.trim() || firstLine.slice(0, 48);

  const detectedKeywords = extractCustomKeywordsFromCode(cleanCode, lang.dictionary);
  const fullDictionary = [...lang.dictionary, ...detectedKeywords];
  const { expandedCode } = expandCodeWithUserDictionary(cleanCode, fullDictionary);
  const parsedBlocks = parseUserLanguageBlocks(cleanCode, fullDictionary);

  const compiledScripts: Script[] = [];
  const synthSounds: Record<string, CustomSoundSynth> = {};
  const jsInitSections: string[] = [];
  const jsHookSections: string[] = [];
  const jsCollideSections: string[] = [];
  const jsKeyDownSections: string[] = [];
  const jsPointerDownSections: string[] = [];
  const jsRenderSections: string[] = [];
  const jsOverlaySections: string[] = [];
  const explanations: string[] = [];
  let hasSpecificMatch = false;

  const fullLower = cleanCode.toLowerCase();

  // ============================================================================
  // M0. CÓDIGO HTML5 / JAVASCRIPT DIRECTO ESCRITO POR EL USUARIO
  // ============================================================================
  const unwrappedDirect = cleanCode
    .replace(/^```(?:javascript|js|html)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^\s*<script\b[^>]*>/i, "")
    .replace(/<\/script>\s*$/i, "")
    .trim();

  const looksLikeRawJs =
    /AsternalRuntime\.registerHook|AsternalAudio\.registerSound|\bctx\.(fillRect|arc|beginPath|stroke|fillText|drawImage)\b|\bapi\.(getPlayer|getEntities|spawnEntity|emitBurst|playSound|shake)\b|^\s*(?:function\b|\(\s*function\b|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|window\.)/m.test(
      unwrappedDirect,
    );

  if (looksLikeRawJs) {
    try {
      new Function("api", "self", "ctx", unwrappedDirect);
      const finalDirectJs = /AsternalRuntime\.registerHook/.test(unwrappedDirect)
        ? unwrappedDirect
        : [
            `// Script HTML5 directo · ${title}`,
            `(function() {`,
            `  if (typeof window === "undefined" || !window.AsternalRuntime) return;`,
            `  var selfRef = typeof self !== "undefined" ? self : null;`,
            `  window.AsternalRuntime.registerHook({`,
            `    id: ${JSON.stringify(programId)},`,
            `    onInit: function(api) { var self = selfRef; },`,
            `    onTick: function(api, dt) {`,
            `      var self = selfRef;`,
            `      var ctx = api && api.ctx ? api.ctx : null;`,
            `      ${unwrappedDirect}`,
            `    },`,
            `    onRender: function(ctx, api) {`,
            `      if (!ctx) return;`,
            `      var self = selfRef;`,
            `      ${/\bctx\./.test(unwrappedDirect) ? unwrappedDirect : ""}`,
            `    }`,
            `  });`,
            `})();`,
          ].join("\n");

      const directScript: Script = {
        id: uid(),
        event: opts?.allowedEvents?.[0] ?? "onStart",
        blocks: [],
        customLanguageCode: cleanCode,
        languageName: "HTML5 JavaScript",
        compiledJs: finalDirectJs,
        aiExplanation: "Código HTML5 / JavaScript nativo ejecutado directamente en el motor sin restricciones del editor.",
      };
      return {
        programId,
        title,
        sourceCode: cleanCode,
        expandedSourceCode: cleanCode,
        compiledJs: finalDirectJs,
        compiledScripts: [directScript],
        synthSounds: {},
        explanation: directScript.aiExplanation || "Script HTML5 directo.",
        detectedKeywords: [],
        hasSpecificMatch: true,
      };
    } catch {
      // Si no es JS puro válido, continúa con el compilador semántico HTML5
    }
  }

  // ============================================================================
  // MECÁNICAS AVANZADAS MÁS ALLÁ DE LOS BLOQUES DEL EDITOR (AsternalRuntime)
  // ============================================================================

  // M1. Gancho / Cuerda / Grappling Hook
  if (/gancho|cuerda|telaraña|spider|grapple|grappling|liana/.test(fullLower)) {
    hasSpecificMatch = true;
    synthSounds.grapple = { name: "grapple", wave: "triangle", freq: 340, endFreq: 760, duration: 0.18, volume: 0.32 };
    jsInitSections.push(`state.grapple = { active: false, tx: 0, ty: 0, timer: 0 };`);
    jsHookSections.push(`
      var pGrap = api && api.getPlayer ? api.getPlayer() : null;
      if (pGrap) {
        var inpG = api && api.getInput ? api.getInput() : {};
        var triggerGrap = (api && api.isKeyDown && (api.isKeyDown("KeyE") || api.isKeyDown("KeyF") || api.isKeyDown("ShiftLeft"))) || (inpG.jump && pGrap.vy > 40 && !state.grapple.active);
        if (triggerGrap && !state.grappleCooldown) {
          var plats = api && api.getEntities ? api.getEntities("platform") : [];
          var best = null;
          var bestDist = 999999;
          var px = pGrap.x + pGrap.w / 2;
          var py = pGrap.y + pGrap.h / 2;
          for (var gi = 0; gi < plats.length; gi++) {
            var pl = plats[gi];
            var cx = pl.x + pl.w / 2;
            var cy = pl.y + pl.h / 2;
            var d = Math.hypot(cx - px, cy - py);
            if (cy < py + 40 && d > 50 && d < 360 && d < bestDist) {
              bestDist = d;
              best = { x: cx, y: cy };
            }
          }
          if (!best) {
            var dirG = pGrap.facing === -1 ? -1 : 1;
            best = { x: px + dirG * 160, y: Math.max(40, py - 140) };
          }
          state.grapple = { active: true, tx: best.x, ty: best.y, timer: 0.65 };
          state.grappleCooldown = 0.85;
          if (api && api.playSound) api.playSound("synth:grapple");
        }
        if (state.grappleCooldown > 0) state.grappleCooldown = Math.max(0, state.grappleCooldown - (dt || 0.016));
        if (state.grapple && state.grapple.active) {
          state.grapple.timer -= (dt || 0.016);
          var dxG = state.grapple.tx - (pGrap.x + pGrap.w / 2);
          var dyG = state.grapple.ty - (pGrap.y + pGrap.h / 2);
          var distG = Math.hypot(dxG, dyG) || 1;
          pGrap.vx = (dxG / distG) * 520;
          pGrap.vy = (dyG / distG) * 520;
          if (distG < 28 || state.grapple.timer <= 0) {
            state.grapple.active = false;
            pGrap.vy = -260;
          }
        }
      }
    `);
    jsRenderSections.push(`
      var pGrapR = api && api.getPlayer ? api.getPlayer() : null;
      if (pGrapR && state.grapple && state.grapple.active) {
        ctx.save();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pGrapR.x + pGrapR.w / 2, pGrapR.y + pGrapR.h / 2);
        ctx.lineTo(state.grapple.tx, state.grapple.ty);
        ctx.stroke();
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.arc(state.grapple.tx, state.grapple.ty, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    `);
    explanations.push("Crea un gancho de agarre (grappling hook) con cuerda física y anclaje dinámico (teclas E/F/Shift o salto en el aire).");
  }

  // M2. Portales dimensionales
  if (/portal|portales|agujero\s+de\s+gusano|teletransportador/.test(fullLower)) {
    hasSpecificMatch = true;
    synthSounds.portal = { name: "portal", wave: "sine", freq: 320, endFreq: 920, duration: 0.28, volume: 0.35 };
    jsInitSections.push(`
      var pInit = api && api.getPlayer ? api.getPlayer() : null;
      var goalInit = api && api.getEntities ? api.getEntities("goal")[0] : null;
      var startX = pInit ? pInit.x + 140 : 220;
      var startY = pInit ? pInit.y : 260;
      var endX = goalInit ? Math.max(80, goalInit.x - 90) : startX + 340;
      var endY = goalInit ? goalInit.y : Math.max(80, startY - 120);
      state.portals = { a: { x: startX, y: startY, color: "#38bdf8" }, b: { x: endX, y: endY, color: "#fb923c" }, cooldown: 0, angle: 0 };
    `);
    jsHookSections.push(`
      if (state.portals) {
        state.portals.angle += (dt || 0.016) * 4.5;
        if (state.portals.cooldown > 0) state.portals.cooldown = Math.max(0, state.portals.cooldown - (dt || 0.016));
        var pPort = api && api.getPlayer ? api.getPlayer() : null;
        if (pPort && state.portals.cooldown <= 0) {
          var pcx = pPort.x + pPort.w / 2;
          var pcy = pPort.y + pPort.h / 2;
          var dA = Math.hypot(pcx - state.portals.a.x, pcy - state.portals.a.y);
          var dB = Math.hypot(pcx - state.portals.b.x, pcy - state.portals.b.y);
          if (dA < 34) {
            pPort.x = state.portals.b.x - pPort.w / 2;
            pPort.y = state.portals.b.y - pPort.h / 2;
            state.portals.cooldown = 0.9;
            if (api && api.playSound) api.playSound("synth:portal");
            if (api && api.emitBurst) api.emitBurst(state.portals.b.x, state.portals.b.y, "#fb923c", 18);
          } else if (dB < 34) {
            pPort.x = state.portals.a.x - pPort.w / 2;
            pPort.y = state.portals.a.y - pPort.h / 2;
            state.portals.cooldown = 0.9;
            if (api && api.playSound) api.playSound("synth:portal");
            if (api && api.emitBurst) api.emitBurst(state.portals.a.x, state.portals.a.y, "#38bdf8", 18);
          }
        }
      }
    `);
    jsRenderSections.push(`
      if (state.portals) {
        var listP = [state.portals.a, state.portals.b];
        for (var pi = 0; pi < listP.length; pi++) {
          var pt = listP[pi];
          ctx.save();
          ctx.translate(pt.x, pt.y);
          ctx.strokeStyle = pt.color;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(0, 0, 18, 28, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = pt.color;
          ctx.fill();
          ctx.restore();
        }
      }
    `);
    explanations.push("Genera dos portales dimensionales enlazados (azul y naranja) que teletransportan al jugador al cruzarlos.");
  }

  // M3. Jetpack / Propulsor con barra de combustible
  if (/jetpack|propulsor|cohete|mochila\s+propulsora|combustible|fuel/.test(fullLower)) {
    hasSpecificMatch = true;
    jsInitSections.push(`state.jetpackFuel = 100;`);
    jsHookSections.push(`
      var pJet = api && api.getPlayer ? api.getPlayer() : null;
      var inpJet = api && api.getInput ? api.getInput() : {};
      if (pJet) {
        if (typeof state.jetpackFuel !== "number") state.jetpackFuel = 100;
        var thrusting = Boolean(inpJet.jump || (api && api.isKeyDown && (api.isKeyDown("Space") || api.isKeyDown("ArrowUp") || api.isKeyDown("KeyW"))));
        if (thrusting && state.jetpackFuel > 0) {
          pJet.vy = Math.max(-360, (pJet.vy || 0) - 1650 * (dt || 0.016));
          state.jetpackFuel = Math.max(0, state.jetpackFuel - 38 * (dt || 0.016));
          if (api && api.emitBurst && Math.random() < 0.45) {
            api.emitBurst(pJet.x + pJet.w / 2, pJet.y + pJet.h, "#fb923c", 3);
          }
        } else if (Math.abs(pJet.vy || 0) < 2) {
          state.jetpackFuel = Math.min(100, state.jetpackFuel + 55 * (dt || 0.016));
        }
      }
    `);
    jsOverlaySections.push(`
      if (typeof state.jetpackFuel === "number") {
        ctx.save();
        ctx.fillStyle = "rgba(15,23,42,0.75)";
        ctx.fillRect(16, H - 36, 130, 16);
        ctx.fillStyle = state.jetpackFuel > 25 ? "#38bdf8" : "#f43f5e";
        ctx.fillRect(18, H - 34, Math.round(1.26 * state.jetpackFuel), 12);
        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 10px Inter, system-ui, sans-serif";
        ctx.fillText("JETPACK " + Math.round(state.jetpackFuel) + "%", 24, H - 24);
        ctx.restore();
      }
    `);
    explanations.push("Equipa un Jetpack propulsor con partículas de fuego y barra de combustible recargable en el HUD.");
  }

  // M4. Doble salto / Triple salto en el aire
  if (/doble\s+salto|triple\s+salto|salto\s+doble|double\s+jump|saltar\s+en\s+el\s+aire|multi\s*salto/.test(fullLower)) {
    hasSpecificMatch = true;
    const maxJumps = /triple/.test(fullLower) ? 3 : 2;
    jsInitSections.push(`state.airJumpsLeft = ${maxJumps - 1}; state.wasJumpPressed = false;`);
    jsHookSections.push(`
      var pDj = api && api.getPlayer ? api.getPlayer() : null;
      var inpDj = api && api.getInput ? api.getInput() : {};
      if (pDj) {
        if (Math.abs(pDj.vy || 0) < 1.5) {
          state.airJumpsLeft = ${maxJumps - 1};
        }
        var jumpNow = Boolean(inpDj.jump);
        if (jumpNow && !state.wasJumpPressed && Math.abs(pDj.vy || 0) > 8 && state.airJumpsLeft > 0) {
          state.airJumpsLeft -= 1;
          pDj.vy = -500;
          if (api && api.playSound) api.playSound("jump");
          if (api && api.emitBurst) api.emitBurst(pDj.x + pDj.w / 2, pDj.y + pDj.h, "#38bdf8", 12);
          state.soundWaves.push({ x: pDj.x + pDj.w / 2, y: pDj.y + pDj.h, radius: 6, maxRadius: 75, alpha: 1, label: "", color: "#38bdf8" });
        }
        state.wasJumpPressed = jumpNow;
      }
    `);
    explanations.push(`Habilita ${maxJumps === 3 ? "triple salto" : "doble salto"} en el aire con onda expansiva bajo los pies.`);
  }

  // M5. Escudo orbital / Orbes protectores / Campo de fuerza
  if (/escudo|orbital|orbe|orbes|campo\s+de\s+fuerza|barrera|aura\s+protectora|shield/.test(fullLower)) {
    hasSpecificMatch = true;
    jsInitSections.push(`state.shieldAngle = 0;`);
    jsHookSections.push(`
      state.shieldAngle = (state.shieldAngle || 0) + (dt || 0.016) * 4.2;
      var pSh = api && api.getPlayer ? api.getPlayer() : null;
      if (pSh) {
        var cxS = pSh.x + pSh.w / 2;
        var cyS = pSh.y + pSh.h / 2;
        var enemiesS = api && api.getEntities ? api.getEntities("enemy") : [];
        for (var si = 0; si < enemiesS.length; si++) {
          var enS = enemiesS[si];
          var dS = Math.hypot((enS.x + enS.w / 2) - cxS, (enS.y + enS.h / 2) - cyS);
          if (dS < 68) {
            if (api && api.emitBurst) api.emitBurst(enS.x + enS.w / 2, enS.y + enS.h / 2, "#38bdf8", 14);
            if (api && api.playSound) api.playSound("hit");
            enS.x = -99999;
            enS.visible = false;
            if (api && api.addScore) api.addScore(20);
          }
        }
      }
    `);
    jsRenderSections.push(`
      var pShR = api && api.getPlayer ? api.getPlayer() : null;
      if (pShR) {
        var cxR = pShR.x + pShR.w / 2;
        var cyR = pShR.y + pShR.h / 2;
        ctx.save();
        ctx.strokeStyle = "rgba(56,189,248,0.45)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cxR, cyR, 52, 0, Math.PI * 2);
        ctx.stroke();
        for (var oi = 0; oi < 3; oi++) {
          var ang = (state.shieldAngle || 0) + (oi * Math.PI * 2 / 3);
          var ox = cxR + Math.cos(ang) * 52;
          var oy = cyR + Math.sin(ang) * 52;
          ctx.fillStyle = "#38bdf8";
          ctx.beginPath();
          ctx.arc(ox, oy, 8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    `);
    explanations.push("Crea un escudo orbital con 3 orbes de energía que giran alrededor del jugador y desintegran enemigos al contacto.");
  }

  // M6. Espada / Katana / Ataque cuerpo a cuerpo (Slash)
  if (/espada|katana|sable|corte|slash|espadazo|ataque\s+cuerpo|melee|guadaña|martillo/.test(fullLower)) {
    hasSpecificMatch = true;
    synthSounds.slash = { name: "slash", wave: "sawtooth", freq: 520, endFreq: 140, duration: 0.14, volume: 0.35 };
    jsInitSections.push(`state.slashTimer = 0; state.slashCooldown = 0;`);
    jsKeyDownSections.push(`
      if (code === "KeyX" || code === "KeyE" || code === "KeyF" || code === "Space" || key === " ") {
        if ((state.slashCooldown || 0) <= 0) {
          state.slashTimer = 0.22;
          state.slashCooldown = 0.4;
          if (api && api.playSound) api.playSound("synth:slash");
        }
      }
    `);
    jsHookSections.push(`
      if (state.slashCooldown > 0) state.slashCooldown = Math.max(0, state.slashCooldown - (dt || 0.016));
      if (state.slashTimer > 0) {
        state.slashTimer = Math.max(0, state.slashTimer - (dt || 0.016));
        var pSl = api && api.getPlayer ? api.getPlayer() : null;
        if (pSl) {
          var dirSl = pSl.facing === -1 ? -1 : 1;
          var hitX = pSl.x + pSl.w / 2 + dirSl * 46;
          var hitY = pSl.y + pSl.h / 2;
          var enemiesSl = api && api.getEntities ? api.getEntities("enemy") : [];
          for (var sli = 0; sli < enemiesSl.length; sli++) {
            var enSl = enemiesSl[sli];
            if (Math.hypot((enSl.x + enSl.w / 2) - hitX, (enSl.y + enSl.h / 2) - hitY) < 64) {
              if (api && api.emitBurst) api.emitBurst(enSl.x + enSl.w / 2, enSl.y + enSl.h / 2, "#facc15", 16);
              enSl.x = -99999;
              enSl.visible = false;
              if (api && api.addScore) api.addScore(30);
            }
          }
        }
      }
    `);
    jsRenderSections.push(`
      var pSlR = api && api.getPlayer ? api.getPlayer() : null;
      if (pSlR && state.slashTimer > 0) {
        var dirR = pSlR.facing === -1 ? -1 : 1;
        ctx.save();
        ctx.translate(pSlR.x + pSlR.w / 2, pSlR.y + pSlR.h / 2);
        ctx.scale(dirR, 1);
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(10, 0, 46, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.stroke();
        ctx.restore();
      }
    `);
    explanations.push("Añade un ataque de espada luminosa (teclas Espacio/X/E/F) con arco de corte que derrota enemigos cercanos.");
  }

  // M7. Proyectiles físicos / Bola de fuego / Hielo / Misiles teledirigidos / Boomerang
  if (/dispar|proyectil|bala|laser|láser|fuego|bola\s+de\s+fuego|hielo|congelar|misil|teledirigido|boomerang|arco|flecha|metralleta|escopeta|arma|pistola|cañon|cañón/.test(fullLower)) {
    hasSpecificMatch = true;
    const isIce = /hielo|congel/.test(fullLower);
    const isHoming = /misil|teledirigido|perseguir/.test(fullLower);
    const isBoomerang = /boomerang/.test(fullLower);
    const projColor = isIce ? "#38bdf8" : isHoming ? "#f43f5e" : isBoomerang ? "#facc15" : "#fb923c";
    synthSounds.laser = { name: "laser", wave: "sawtooth", freq: 780, endFreq: 160, duration: 0.16, volume: 0.34 };
    jsInitSections.push(`state.projectiles = []; state.shotCooldown = 0;`);
    jsKeyDownSections.push(`
      if (code === "KeyX" || code === "KeyE" || code === "KeyF" || code === "Space" || key === " ") {
        var pShP = api && api.getPlayer ? api.getPlayer() : null;
        if (pShP && (state.shotCooldown || 0) <= 0) {
          var dirP = pShP.facing === -1 ? -1 : 1;
          state.projectiles.push({
            x: pShP.x + pShP.w / 2 + dirP * 20,
            y: pShP.y + pShP.h / 2,
            vx: dirP * 520,
            vy: 0,
            life: 2.2,
            age: 0,
            color: ${JSON.stringify(projColor)},
            ice: ${isIce},
            homing: ${isHoming},
            boomerang: ${isBoomerang}
          });
          state.shotCooldown = 0.25;
          if (api && api.playSound) api.playSound("synth:laser");
        }
      }
    `);
    jsHookSections.push(`
      if (state.shotCooldown > 0) state.shotCooldown = Math.max(0, state.shotCooldown - (dt || 0.016));
      if (!state.projectiles) state.projectiles = [];
      var enemiesPr = api && api.getEntities ? api.getEntities("enemy") : [];
      var pOwner = api && api.getPlayer ? api.getPlayer() : null;
      for (var pi = state.projectiles.length - 1; pi >= 0; pi--) {
        var pr = state.projectiles[pi];
        pr.age += (dt || 0.016);
        pr.life -= (dt || 0.016);
        if (pr.boomerang && pOwner && pr.age > 0.45) {
          var dxB = (pOwner.x + pOwner.w / 2) - pr.x;
          var dyB = (pOwner.y + pOwner.h / 2) - pr.y;
          pr.vx += dxB * 8 * (dt || 0.016);
          pr.vy += dyB * 8 * (dt || 0.016);
        } else if (pr.homing && enemiesPr.length > 0) {
          var targetE = enemiesPr[0];
          var dxH = (targetE.x + targetE.w / 2) - pr.x;
          var dyH = (targetE.y + targetE.h / 2) - pr.y;
          var dH = Math.hypot(dxH, dyH) || 1;
          pr.vx = (dxH / dH) * 420;
          pr.vy = (dyH / dH) * 420;
        }
        pr.x += pr.vx * (dt || 0.016);
        pr.y += pr.vy * (dt || 0.016);
        var hitEnemy = false;
        for (var ei = 0; ei < enemiesPr.length; ei++) {
          var en = enemiesPr[ei];
          if (en.visible === false) continue;
          if (pr.x >= en.x - 10 && pr.x <= en.x + en.w + 10 && pr.y >= en.y - 10 && pr.y <= en.y + en.h + 10) {
            hitEnemy = true;
            if (pr.ice) {
              en.vx = 0;
              en.patrol = undefined;
              en.moving = undefined;
              en.hazard = false;
              en.color = "#38bdf8";
              if (api && api.emitBurst) api.emitBurst(pr.x, pr.y, "#38bdf8", 14);
            } else {
              if (api && api.emitBurst) api.emitBurst(pr.x, pr.y, pr.color, 16);
              en.x = -99999;
              en.visible = false;
              if (api && api.addScore) api.addScore(25);
            }
            if (api && api.playSound) api.playSound("hit");
            break;
          }
        }
        if (hitEnemy || pr.life <= 0) {
          state.projectiles.splice(pi, 1);
        }
      }
    `);
    jsRenderSections.push(`
      if (state.projectiles) {
        for (var rpi = 0; rpi < state.projectiles.length; rpi++) {
          var rp = state.projectiles[rpi];
          ctx.save();
          ctx.fillStyle = rp.color || "#fb923c";
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    `);
    explanations.push(
      isIce
        ? "Dispara proyectiles de hielo que congelan y neutralizan a los enemigos al impactar."
        : isHoming
          ? "Dispara misiles teledirigidos que persiguen automáticamente a los enemigos."
          : isBoomerang
            ? "Lanza un boomerang energético que impacta enemigos y regresa al jugador."
            : "Dispara proyectiles de energía que viajan por el mapa y derrotan enemigos."
    );
  }

  // M8. Clon / Sombra / Compañero / Dron / Mascota
  if (/clon|sombra|compañero|dron|mascota|aliado|ayudante|pet|companion|espiritu|espíritu/.test(fullLower)) {
    hasSpecificMatch = true;
    jsInitSections.push(`state.companion = { x: 160, y: 160, bob: 0, fireTimer: 0 };`);
    jsHookSections.push(`
      var pComp = api && api.getPlayer ? api.getPlayer() : null;
      if (pComp) {
        if (!state.companion) state.companion = { x: pComp.x - 40, y: pComp.y - 30, bob: 0, fireTimer: 0 };
        state.companion.bob += (dt || 0.016) * 5;
        var targetX = pComp.x + (pComp.facing === -1 ? 48 : -36);
        var targetY = pComp.y - 24 + Math.sin(state.companion.bob) * 8;
        state.companion.x += (targetX - state.companion.x) * Math.min(1, (dt || 0.016) * 8);
        state.companion.y += (targetY - state.companion.y) * Math.min(1, (dt || 0.016) * 8);
        state.companion.fireTimer += (dt || 0.016);
        if (state.companion.fireTimer >= 1.4) {
          var enemiesC = api && api.getEntities ? api.getEntities("enemy") : [];
          for (var ci = 0; ci < enemiesC.length; ci++) {
            var enC = enemiesC[ci];
            if (enC.visible !== false && Math.hypot(enC.x - state.companion.x, enC.y - state.companion.y) < 240) {
              state.companion.fireTimer = 0;
              if (api && api.emitBurst) api.emitBurst(enC.x + enC.w / 2, enC.y + enC.h / 2, "#a855f7", 14);
              enC.x = -99999;
              enC.visible = false;
              if (api && api.addScore) api.addScore(15);
              break;
            }
          }
        }
      }
    `);
    jsRenderSections.push(`
      if (state.companion) {
        ctx.save();
        ctx.fillStyle = "#a855f7";
        ctx.beginPath();
        ctx.arc(state.companion.x, state.companion.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#f0abfc";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    `);
    explanations.push("Invoca un compañero/dron flotante que sigue al jugador y ataca automáticamente a los enemigos cercanos.");
  }

  // M9. Lluvia de meteoritos / Bombardeo del cielo
  if (/meteorito|meteoros|asteroide|lluvia\s+de\s+fuego|caen\s+del\s+cielo|bombardeo/.test(fullLower)) {
    hasSpecificMatch = true;
    jsInitSections.push(`state.meteors = []; state.meteorSpawnT = 0;`);
    jsHookSections.push(`
      if (!state.meteors) state.meteors = [];
      state.meteorSpawnT = (state.meteorSpawnT || 0) + (dt || 0.016);
      var camXM = (api && api.camera && api.camera.x) || 0;
      if (state.meteorSpawnT >= 0.65) {
        state.meteorSpawnT = 0;
        state.meteors.push({
          x: camXM + Math.random() * 820,
          y: -30,
          vx: -90 - Math.random() * 80,
          vy: 280 + Math.random() * 140,
          r: 12 + Math.random() * 8
        });
      }
      var pMet = api && api.getPlayer ? api.getPlayer() : null;
      for (var mi = state.meteors.length - 1; mi >= 0; mi--) {
        var m = state.meteors[mi];
        m.x += m.vx * (dt || 0.016);
        m.y += m.vy * (dt || 0.016);
        if (pMet && Math.hypot((pMet.x + pMet.w / 2) - m.x, (pMet.y + pMet.h / 2) - m.y) < m.r + 18) {
          if (api && api.addLives) api.addLives(-1);
          if (api && api.shake) api.shake(9, 0.25);
          if (api && api.emitBurst) api.emitBurst(m.x, m.y, "#f97316", 16);
          state.meteors.splice(mi, 1);
          continue;
        }
        if (m.y > 520) {
          if (api && api.emitBurst) api.emitBurst(m.x, m.y, "#f97316", 10);
          state.meteors.splice(mi, 1);
        }
      }
    `);
    jsRenderSections.push(`
      if (state.meteors) {
        for (var rmi = 0; rmi < state.meteors.length; rmi++) {
          var rm = state.meteors[rmi];
          ctx.save();
          ctx.fillStyle = "#f97316";
          ctx.beginPath();
          ctx.arc(rm.x, rm.y, rm.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    `);
    explanations.push("Desata una lluvia dinámica de meteoritos incandescentes que caen del cielo y explotan al impactar.");
  }

  // M10. Clima: Lluvia / Nieve / Tormenta eléctrica
  if (/lluvia|llover|nieve|nevar|tormenta|relampago|relámpago|clima|ventisca/.test(fullLower)) {
    hasSpecificMatch = true;
    const isSnow = /nieve|nevar|ventisca/.test(fullLower);
    const isStorm = /tormenta|relampago|relámpago/.test(fullLower);
    jsInitSections.push(`
      state.weatherDrops = [];
      for (var wi = 0; wi < 55; wi++) {
        state.weatherDrops.push({ x: Math.random() * 800, y: Math.random() * 500, s: 1 + Math.random() * 2 });
      }
      state.lightningAlpha = 0;
    `);
    jsHookSections.push(`
      if (state.weatherDrops) {
        for (var uwi = 0; uwi < state.weatherDrops.length; uwi++) {
          var wd = state.weatherDrops[uwi];
          wd.y += (${isSnow ? 90 : 420} * wd.s) * (dt || 0.016);
          wd.x += (${isSnow ? "Math.sin(wd.y * 0.04) * 35" : "-60"}) * (dt || 0.016);
          if (wd.y > 540) { wd.y = -10; wd.x = Math.random() * 800; }
          if (wd.x < 0) wd.x = 800;
        }
      }
      if (${isStorm}) {
        if (state.lightningAlpha > 0) state.lightningAlpha = Math.max(0, state.lightningAlpha - (dt || 0.016) * 2.5);
        else if (Math.random() < 0.008) {
          state.lightningAlpha = 0.75;
          if (api && api.shake) api.shake(6, 0.2);
        }
      }
    `);
    jsOverlaySections.push(`
      if (state.weatherDrops) {
        ctx.save();
        ctx.strokeStyle = "rgba(186,230,253,0.65)";
        ctx.fillStyle = "rgba(248,250,252,0.85)";
        ctx.lineWidth = 1.5;
        for (var rwi = 0; rwi < state.weatherDrops.length; rwi++) {
          var rwd = state.weatherDrops[rwi];
          if (${isSnow}) {
            ctx.beginPath();
            ctx.arc(rwd.x, rwd.y, rwd.s * 1.6, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.moveTo(rwd.x, rwd.y);
            ctx.lineTo(rwd.x - 3, rwd.y + 11);
            ctx.stroke();
          }
        }
        if (state.lightningAlpha > 0) {
          ctx.fillStyle = "rgba(248,250,252," + state.lightningAlpha + ")";
          ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();
      }
    `);
    explanations.push(`Genera sistema climático de ${isSnow ? "nieve" : isStorm ? "tormenta eléctrica con relámpagos" : "lluvia"} en toda la escena.`);
  }

  // M11. Oscuridad / Noche con linterna / Luz dinámica alrededor del jugador
  if (/oscuridad|noche|linterna|iluminar|tinieblas|antorcha|faro/.test(fullLower)) {
    hasSpecificMatch = true;
    jsOverlaySections.push(`
      var pDark = api && api.getPlayer ? api.getPlayer() : null;
      var camXD = (api && api.camera && api.camera.x) || 0;
      var camYD = (api && api.camera && api.camera.y) || 0;
      var lx = pDark ? (pDark.x + pDark.w / 2 - camXD) : W / 2;
      var ly = pDark ? (pDark.y + pDark.h / 2 - camYD) : H / 2;
      ctx.save();
      var gradD = ctx.createRadialGradient(lx, ly, 28, lx, ly, 175);
      gradD.addColorStop(0, "rgba(2,6,23,0)");
      gradD.addColorStop(0.7, "rgba(2,6,23,0.55)");
      gradD.addColorStop(1, "rgba(2,6,23,0.92)");
      ctx.fillStyle = gradD;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    `);
    explanations.push("Activa modo nocturno con iluminación radial / linterna dinámica centrada en el jugador.");
  }

  // M12. Agujero negro / Imán de monedas / Vórtice gravitatorio
  if (/agujero\s+negro|iman|imán|atraer|vortice|vórtice|succionar|aspirar|black\s*hole|magnet/.test(fullLower)) {
    hasSpecificMatch = true;
    const isBlackHole = /agujero\s+negro|vortice|vórtice|black\s*hole/.test(fullLower);
    jsHookSections.push(`
      var pMag = api && api.getPlayer ? api.getPlayer() : null;
      if (pMag) {
        var cxM = pMag.x + pMag.w / 2 + (${isBlackHole ? "(pMag.facing === -1 ? -140 : 140)" : "0"});
        var cyM = pMag.y + pMag.h / 2;
        state.vortexPos = { x: cxM, y: cyM };
        var targetsM = api && api.getEntities ? api.getEntities(${isBlackHole ? '"enemy"' : '"coin"'}) : [];
        for (var mgi = 0; mgi < targetsM.length; mgi++) {
          var tm = targetsM[mgi];
          if (tm.visible === false) continue;
          var dxM = cxM - (tm.x + tm.w / 2);
          var dyM = cyM - (tm.y + tm.h / 2);
          var distM = Math.hypot(dxM, dyM) || 1;
          if (distM < 280) {
            tm.x += (dxM / distM) * 320 * (dt || 0.016);
            tm.y += (dyM / distM) * 320 * (dt || 0.016);
            if (${isBlackHole} && distM < 26) {
              if (api && api.emitBurst) api.emitBurst(cxM, cyM, "#a855f7", 14);
              tm.x = -99999;
              tm.visible = false;
              if (api && api.addScore) api.addScore(25);
            }
          }
        }
      }
    `);
    if (isBlackHole) {
      jsRenderSections.push(`
        if (state.vortexPos) {
          ctx.save();
          ctx.fillStyle = "#090d16";
          ctx.strokeStyle = "#a855f7";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(state.vortexPos.x, state.vortexPos.y, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      `);
    }
    explanations.push(
      isBlackHole
        ? "Invoca un agujero negro gravitatorio que absorbe y destruye enemigos cercanos."
        : "Activa un imán gravitatorio que atrae automáticamente las monedas cercanas hacia el jugador."
    );
  }

  // M13. Cámara lenta / Tiempo bala / Matrix
  if (/camara\s+lenta|cámara\s+lenta|tiempo\s+bala|slow\s*motion|matrix|detener\s+el\s+tiempo|congelar\s+tiempo|ralentizar/.test(fullLower)) {
    hasSpecificMatch = true;
    jsHookSections.push(`
      var enemiesSlow = api && api.getEntities ? api.getEntities("enemy") : [];
      for (var si = 0; si < enemiesSlow.length; si++) {
        var es = enemiesSlow[si];
        if (typeof es.vx === "number") es.vx *= 0.35;
        if (typeof es.vy === "number") es.vy *= 0.35;
        if (es.patrol && es.patrol.speed > 45) es.patrol.speed = 35;
      }
    `);
    jsOverlaySections.push(`
      ctx.save();
      ctx.fillStyle = "rgba(56,189,248,0.08)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 11px Inter, system-ui, sans-serif";
      ctx.fillText("⏱ TIEMPO BALA ACTIVO", 16, H - 14);
      ctx.restore();
    `);
    explanations.push("Activa el modo Tiempo Bala (cámara lenta) ralentizando enemigos y proyectiles.");
  }

  // M14. Crear plataformas mágicas bajo los pies
  if (/crear\s+plataforma|plataforma\s+bajo|construir|generar\s+suelo|puente\s+magico|escalera\s+magica|spawn.*plataforma/.test(fullLower)) {
    hasSpecificMatch = true;
    jsKeyDownSections.push(`
      if (code === "KeyE" || code === "KeyF" || code === "KeyC" || code === "ArrowDown" || code === "KeyS") {
        var pPl = api && api.getPlayer ? api.getPlayer() : null;
        if (pPl && api && api.spawnEntity) {
          api.spawnEntity("platform", {
            x: Math.round(pPl.x - 16),
            y: Math.round(pPl.y + pPl.h + 4),
            w: 96,
            h: 18,
            color: "#38bdf8",
            solid: true
          });
          if (api.emitBurst) api.emitBurst(pPl.x + pPl.w / 2, pPl.y + pPl.h + 8, "#38bdf8", 12);
          if (api.playSound) api.playSound("powerup");
        }
      }
    `);
    explanations.push("Permite materializar plataformas sólidas bajo los pies del jugador al pulsar Abajo/S/E/C.");
  }

  // M15. Lava ascendente / Agua / Nadar
  if (/lava|inundacion|inundación|agua\s+sube|sube\s+la\s+lava|nadar|bajo\s+el\s+agua|acido|ácido/.test(fullLower)) {
    hasSpecificMatch = true;
    const isWater = /agua|nadar|inundacion|inundación/.test(fullLower);
    jsInitSections.push(`state.fluidLevel = 440;`);
    jsHookSections.push(`
      if (typeof state.fluidLevel !== "number") state.fluidLevel = 440;
      if (!${isWater}) {
        state.fluidLevel = Math.max(220, state.fluidLevel - 12 * (dt || 0.016));
      }
      var pFl = api && api.getPlayer ? api.getPlayer() : null;
      if (pFl && (pFl.y + pFl.h) > state.fluidLevel) {
        if (${isWater}) {
          pFl.vy = Math.min(120, (pFl.vy || 0) * 0.85);
          var inpW = api && api.getInput ? api.getInput() : {};
          if (inpW.jump) pFl.vy = -240;
        } else {
          pFl.vy = -480;
          if (api && api.addLives) api.addLives(-1);
          if (api && api.shake) api.shake(8, 0.25);
        }
      }
    `);
    jsRenderSections.push(`
      if (typeof state.fluidLevel === "number") {
        var camXF = (api && api.camera && api.camera.x) || 0;
        ctx.save();
        ctx.fillStyle = ${isWater ? '"rgba(56,189,248,0.42)"' : '"rgba(239,68,68,0.68)"'};
        ctx.fillRect(camXF - 100, state.fluidLevel, 1600, 600);
        ctx.restore();
      }
    `);
    explanations.push(
      isWater
        ? "Añade física acuática y nado libre en la zona inferior del mapa."
        : "Añade marea de lava ascendente en la parte inferior del nivel."
    );
  }

  // M16. Jefe / Boss con barra de vida superior
  if (/jefe|boss|enemigo\s+gigante|barra\s+de\s+vida|monstruo\s+final|titan|titán/.test(fullLower)) {
    hasSpecificMatch = true;
    jsInitSections.push(`
      state.bossHp = 100;
      state.bossMaxHp = 100;
      var enemiesB = api && api.getEntities ? api.getEntities("enemy") : [];
      var bossEnt = enemiesB[0];
      if (!bossEnt && api && api.spawnEntity) {
        bossEnt = api.spawnEntity("enemy", { x: 460, y: 200, w: 68, h: 68, color: "#e11d48", patrol: { range: 160, speed: 120 } });
      } else if (bossEnt) {
        bossEnt.w = Math.max(64, bossEnt.w || 64);
        bossEnt.h = Math.max(64, bossEnt.h || 64);
        bossEnt.color = "#e11d48";
      }
      state.bossId = bossEnt ? bossEnt.id : null;
    `);
    jsOverlaySections.push(`
      if (typeof state.bossHp === "number" && state.bossHp > 0) {
        ctx.save();
        var bw = Math.min(280, W - 80);
        var bx = (W - bw) / 2;
        ctx.fillStyle = "rgba(15,23,42,0.82)";
        ctx.fillRect(bx, 12, bw, 18);
        ctx.fillStyle = "#e11d48";
        ctx.fillRect(bx + 2, 14, Math.max(0, (bw - 4) * (state.bossHp / (state.bossMaxHp || 100))), 14);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("JEFE FINAL (" + Math.ceil(state.bossHp) + "%)", W / 2, 25);
        ctx.restore();
      }
    `);
    explanations.push("Configura un Jefe Final con barra de salud superior en pantalla.");
  }

  // M17. Minimapa / Radar táctico en esquina
  if (/minimapa|mini\s*mapa|radar|brujula|brújula|mapa\s+en\s+pantalla|detector/.test(fullLower)) {
    hasSpecificMatch = true;
    jsOverlaySections.push(`
      ctx.save();
      var mw = 116, mh = 68, mx = W - mw - 14, my = 14;
      ctx.fillStyle = "rgba(15,23,42,0.78)";
      ctx.strokeStyle = "rgba(56,189,248,0.6)";
      ctx.lineWidth = 1.5;
      ctx.fillRect(mx, my, mw, mh);
      ctx.strokeRect(mx, my, mw, mh);
      var sc = api && api.getScene ? api.getScene() : null;
      var sw = (sc && sc.width) || 1600;
      var sh = (sc && sc.height) || 540;
      var allE = api && api.getEntities ? api.getEntities() : [];
      for (var mei = 0; mei < allE.length; mei++) {
        var me = allE[mei];
        if (me.visible === false) continue;
        var ex = mx + Math.max(3, Math.min(mw - 3, (me.x / sw) * mw));
        var ey = my + Math.max(3, Math.min(mh - 3, (me.y / sh) * mh));
        ctx.fillStyle = me.kind === "player" ? "#38bdf8" : me.kind === "enemy" ? "#f43f5e" : me.kind === "goal" ? "#22c55e" : me.kind === "coin" ? "#facc15" : "#94a3b8";
        ctx.fillRect(ex - 2, ey - 2, me.kind === "player" ? 5 : 3, me.kind === "player" ? 5 : 3);
      }
      ctx.restore();
    `);
    explanations.push("Añade un minimapa / radar táctico en tiempo real en la esquina superior derecha.");
  }

  // M18. Invertir gravedad / Caminar por el techo
  if (/invertir\s+gravedad|gravedad\s+invertida|caminar.*techo|gravedad\s+cero|cambiar\s+gravedad/.test(fullLower)) {
    hasSpecificMatch = true;
    jsInitSections.push(`state.gravityInverted = false;`);
    jsKeyDownSections.push(`
      if (code === "KeyG" || code === "KeyE" || code === "Space") {
        state.gravityInverted = !state.gravityInverted;
        if (api && api.playSound) api.playSound("powerup");
      }
    `);
    jsHookSections.push(`
      var pGr = api && api.getPlayer ? api.getPlayer() : null;
      if (pGr && state.gravityInverted) {
        pGr.vy = (pGr.vy || 0) - 2400 * (dt || 0.016);
      }
    `);
    explanations.push("Permite invertir la gravedad para caminar por el techo o flotar (teclas G/E/Espacio).");
  }

  // M19. Salto en pared / Wall Jump
  if (/salto\s+en\s+pared|wall\s*jump|trepar\s+pared|escalar\s+muro|parkour|deslizar.*pared/.test(fullLower)) {
    hasSpecificMatch = true;
    jsHookSections.push(`
      var pWj = api && api.getPlayer ? api.getPlayer() : null;
      var inpWj = api && api.getInput ? api.getInput() : {};
      if (pWj && Math.abs(pWj.vy || 0) > 5) {
        var platsW = api && api.getEntities ? api.getEntities("platform") : [];
        for (var wji = 0; wji < platsW.length; wji++) {
          var pw = platsW[wji];
          var touchLeft = Math.abs((pWj.x + pWj.w) - pw.x) < 6 && pWj.y + pWj.h > pw.y + 4 && pWj.y < pw.y + pw.h - 4;
          var touchRight = Math.abs(pWj.x - (pw.x + pw.w)) < 6 && pWj.y + pWj.h > pw.y + 4 && pWj.y < pw.y + pw.h - 4;
          if (touchLeft || touchRight) {
            if (pWj.vy > 90) pWj.vy = 90;
            if (inpWj.jump) {
              pWj.vy = -510;
              pWj.vx = touchLeft ? -320 : 320;
              if (api && api.playSound) api.playSound("jump");
              if (api && api.emitBurst) api.emitBurst(pWj.x + (touchLeft ? pWj.w : 0), pWj.y + pWj.h / 2, "#38bdf8", 10);
            }
            break;
          }
        }
      }
    `);
    explanations.push("Habilita deslizamiento en muros y salto en pared (Wall Jump).");
  }

  // M20. Arcoíris / Estela / Aura de energía
  if (/arcoiris|arcoíris|estela|rastro|aura|super\s+saiyan|saiyajin|brillar|neon|neón|fiesta|disco/.test(fullLower)) {
    hasSpecificMatch = true;
    jsInitSections.push(`state.trailPoints = []; state.hue = 0;`);
    jsHookSections.push(`
      state.hue = ((state.hue || 0) + (dt || 0.016) * 260) % 360;
      var pAu = api && api.getPlayer ? api.getPlayer() : null;
      if (pAu) {
        if (!state.trailPoints) state.trailPoints = [];
        state.trailPoints.push({ x: pAu.x + pAu.w / 2, y: pAu.y + pAu.h / 2, hue: state.hue, alpha: 0.85 });
        if (state.trailPoints.length > 18) state.trailPoints.shift();
        for (var ti = 0; ti < state.trailPoints.length; ti++) {
          state.trailPoints[ti].alpha *= 0.92;
        }
      }
    `);
    jsRenderSections.push(`
      if (state.trailPoints) {
        ctx.save();
        for (var rti = 0; rti < state.trailPoints.length; rti++) {
          var tp = state.trailPoints[rti];
          ctx.fillStyle = "hsla(" + Math.round(tp.hue) + ", 90%, 60%, " + tp.alpha + ")";
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 6 + (rti * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    `);
    explanations.push("Rodea al jugador con un aura luminosa y estela arcoíris dinámica.");
  }

  // M16. Vehículo / Coche / Moto / Nave / Montura conducible
  if (/vehiculo|vehículo|coche|auto\b|carro|moto|nave|avion|avión|helicoptero|helicóptero|montura|conducir|manejar|tanque|submarino|barco|patineta|skate|bicicleta/.test(fullLower)) {
    hasSpecificMatch = true;
    const isFlyingVehicle = /nave|avion|avión|helicoptero|helicóptero/.test(fullLower);
    jsInitSections.push(`
      var pVehInit = api && api.getPlayer ? api.getPlayer() : null;
      state.vehicle = {
        x: pVehInit ? pVehInit.x + 90 : 220,
        y: pVehInit ? pVehInit.y - 10 : 260,
        w: 68,
        h: 34,
        vx: 0,
        vy: 0,
        mounted: false,
        flying: ${isFlyingVehicle},
        wheelAngle: 0
      };
    `);
    jsHookSections.push(`
      var pVeh = api && api.getPlayer ? api.getPlayer() : null;
      var inpVeh = api && api.getInput ? api.getInput() : {};
      if (pVeh && state.vehicle) {
        var v = state.vehicle;
        var distV = Math.hypot((pVeh.x + pVeh.w / 2) - (v.x + v.w / 2), (pVeh.y + pVeh.h / 2) - (v.y + v.h / 2));
        if (!v.mounted && distV < 54) {
          v.mounted = true;
          if (api && api.playSound) api.playSound("powerup");
        }
        if (v.mounted) {
          var moveDir = (inpVeh.right ? 1 : 0) - (inpVeh.left ? 1 : 0);
          pVeh.vx = moveDir * 440;
          v.wheelAngle += moveDir * (dt || 0.016) * 14;
          if (v.flying && inpVeh.jump) {
            pVeh.vy = -340;
          }
          v.x = pVeh.x + pVeh.w / 2 - v.w / 2;
          v.y = pVeh.y + pVeh.h - v.h + 6;
        }
      }
    `);
    jsRenderSections.push(`
      if (state.vehicle) {
        var vr = state.vehicle;
        ctx.save();
        ctx.translate(vr.x, vr.y);
        ctx.fillStyle = vr.flying ? "#38bdf8" : "#f43f5e";
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(0, 4, vr.w, vr.h - 10, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(186,230,253,0.85)";
        ctx.fillRect(vr.w * 0.55, 7, vr.w * 0.28, 10);
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(16, vr.h - 4, 9, 0, Math.PI * 2);
        ctx.arc(vr.w - 16, vr.h - 4, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    `);
    explanations.push("Crea un vehículo interactivo en HTML5 con ruedas/propulsores que el jugador puede montar y conducir a alta velocidad.");
  }

  // M17. Agua / Lava / Zona de Nado / Gravedad Cero
  if (/agua|nadar|piscina|mar\b|oceano|océano|lava|acido|ácido|flotar|ingravidez|bajo\s+el\s+agua/.test(fullLower)) {
    hasSpecificMatch = true;
    const isLava = /lava|acido|ácido/.test(fullLower);
    jsInitSections.push(`state.fluidWaveT = 0;`);
    jsHookSections.push(`
      state.fluidWaveT = (state.fluidWaveT || 0) + (dt || 0.016) * 3.2;
      var pFl = api && api.getPlayer ? api.getPlayer() : null;
      var inpFl = api && api.getInput ? api.getInput() : {};
      var sceneH = (api && api.scene && api.scene.height) || 540;
      var waterTop = sceneH - 150;
      if (pFl && pFl.y + pFl.h > waterTop) {
        if (${isLava}) {
          pFl.vy = -460;
          if (api && api.addLives) api.addLives(-1);
          if (api && api.emitBurst) api.emitBurst(pFl.x + pFl.w / 2, pFl.y + pFl.h, "#fb923c", 12);
        } else {
          pFl.vy = (pFl.vy || 0) * 0.86;
          if (inpFl.jump) {
            pFl.vy = -270;
          }
        }
      }
    `);
    jsRenderSections.push(`
      var scH = (api && api.scene && api.scene.height) || 540;
      var scW = (api && api.scene && api.scene.width) || 2400;
      var wTop = scH - 150;
      ctx.save();
      ctx.fillStyle = ${isLava ? '"rgba(249,115,22,0.52)"' : '"rgba(56,189,248,0.34)"'};
      ctx.beginPath();
      ctx.moveTo(0, scH);
      for (var wx = 0; wx <= scW; wx += 40) {
        var wy = wTop + Math.sin((wx * 0.03) + (state.fluidWaveT || 0)) * 7;
        ctx.lineTo(wx, wy);
      }
      ctx.lineTo(scW, scH);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    `);
    explanations.push(
      isLava
        ? "Crea un mar de lava incandescente con olas animadas en HTML5 Canvas."
        : "Crea una zona de agua animada donde el jugador puede nadar y flotar libremente.",
    );
  }

  // M18. Clima Dinámico: Lluvia / Tormenta con Rayos / Nieve / Viento
  if (/\b(lluvia|llover|tormenta|relampago|relámpago|trueno|nieve|nevar|ventisca|viento|huracan|huracán|tornado|clima)\b/.test(fullLower)) {
    hasSpecificMatch = true;
    const isSnow = /nieve|nevar|ventisca/.test(fullLower);
    const isWind = /viento|huracan|huracán|tornado/.test(fullLower);
    jsInitSections.push(`
      state.weatherDrops = [];
      for (var wi = 0; wi < 75; wi++) {
        state.weatherDrops.push({ x: Math.random() * 960, y: Math.random() * 540, s: 1 + Math.random() * 2.5 });
      }
    `);
    jsHookSections.push(`
      if (${isWind}) {
        var pWind = api && api.getPlayer ? api.getPlayer() : null;
        if (pWind) pWind.x += 55 * (dt || 0.016);
      }
    `);
    jsOverlaySections.push(`
      if (state.weatherDrops) {
        ctx.save();
        ctx.strokeStyle = "rgba(186,230,253,0.72)";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1.6;
        for (var wdi = 0; wdi < state.weatherDrops.length; wdi++) {
          var wd = state.weatherDrops[wdi];
          wd.y += (${isSnow ? 90 : 460}) * wd.s * 0.016;
          wd.x += (${isWind ? 140 : isSnow ? 25 : -45}) * 0.016;
          if (wd.y > H) { wd.y = -10; wd.x = Math.random() * W; }
          if (wd.x > W) wd.x = 0;
          if (wd.x < 0) wd.x = W;
          if (${isSnow}) {
            ctx.beginPath();
            ctx.arc(wd.x, wd.y, wd.s * 1.6, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.moveTo(wd.x, wd.y);
            ctx.lineTo(wd.x - 4, wd.y + 12);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    `);
    explanations.push("Genera un sistema climático dinámico en HTML5 Canvas (lluvia/nieve/viento) en tiempo real.");
  }

  // M19. Ciclo Día y Noche / Sol y Luna
  if (/dia\s+y\s+noche|día\s+y\s+noche|ciclo\s+solar|atardecer|amanecer|anochecer|sol\s+y\s+luna/.test(fullLower)) {
    hasSpecificMatch = true;
    jsInitSections.push(`state.dayCycleT = 0;`);
    jsHookSections.push(`state.dayCycleT = (state.dayCycleT || 0) + (dt || 0.016) * 0.35;`);
    jsOverlaySections.push(`
      var cyc = (Math.sin(state.dayCycleT || 0) + 1) * 0.5;
      var nightAlpha = (1 - cyc) * 0.55;
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, " + nightAlpha.toFixed(3) + ")";
      ctx.fillRect(0, 0, W, H);
      var orbX = 60 + cyc * (W - 120);
      var orbY = 48 + Math.sin(cyc * Math.PI) * -22;
      ctx.fillStyle = cyc > 0.45 ? "#facc15" : "#e2e8f0";
      ctx.beginPath();
      ctx.arc(orbX, orbY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    `);
    explanations.push("Activa un ciclo dinámico de día y noche con iluminación ambiental, sol y luna en el lienzo HTML5.");
  }

  // M20. Imán de Monedas y Objetos
  if (/iman|imán|magneto|magnetismo|atraer\s+monedas|absorber\s+monedas/.test(fullLower)) {
    hasSpecificMatch = true;
    jsHookSections.push(`
      var pMag = api && api.getPlayer ? api.getPlayer() : null;
      var coinsMag = api && api.getEntities ? api.getEntities("coin") : [];
      if (pMag) {
        var pmx = pMag.x + pMag.w / 2;
        var pmy = pMag.y + pMag.h / 2;
        for (var cmi = 0; cmi < coinsMag.length; cmi++) {
          var cm = coinsMag[cmi];
          if (cm.visible === false) continue;
          var dxM = pmx - (cm.x + cm.w / 2);
          var dyM = pmy - (cm.y + cm.h / 2);
          var distM = Math.hypot(dxM, dyM) || 1;
          if (distM < 280) {
            cm.x += (dxM / distM) * 340 * (dt || 0.016);
            cm.y += (dyM / distM) * 340 * (dt || 0.016);
          }
        }
      }
    `);
    explanations.push("Activa un campo magnético alrededor del jugador que atrae automáticamente todas las monedas cercanas.");
  }

  // M21. Trampolín / Resorte / Catapulta
  if (/trampolin|trampolín|resorte|muelle|colchoneta|rebotador|bouncy|catapulta/.test(fullLower)) {
    hasSpecificMatch = true;
    jsInitSections.push(`
      var pTrInit = api && api.getPlayer ? api.getPlayer() : null;
      state.trampoline = { x: pTrInit ? pTrInit.x + 110 : 240, y: pTrInit ? pTrInit.y + 18 : 300, w: 52, h: 16, bounceAnim: 0 };
    `);
    jsHookSections.push(`
      var pTr = api && api.getPlayer ? api.getPlayer() : null;
      if (pTr && state.trampoline) {
        var tr = state.trampoline;
        if (tr.bounceAnim > 0) tr.bounceAnim = Math.max(0, tr.bounceAnim - (dt || 0.016) * 4);
        if (pTr.x + pTr.w > tr.x && pTr.x < tr.x + tr.w && pTr.y + pTr.h >= tr.y - 8 && pTr.y + pTr.h <= tr.y + tr.h + 18 && (pTr.vy || 0) >= 0) {
          pTr.vy = -780;
          tr.bounceAnim = 1;
          if (api && api.playSound) api.playSound("jump");
          if (api && api.emitBurst) api.emitBurst(tr.x + tr.w / 2, tr.y, "#facc15", 14);
        }
      }
    `);
    jsRenderSections.push(`
      if (state.trampoline) {
        var trR = state.trampoline;
        var lift = (trR.bounceAnim || 0) * 8;
        ctx.save();
        ctx.fillStyle = "#f43f5e";
        ctx.fillRect(trR.x, trR.y - lift, trR.w, 8);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(trR.x + 10, trR.y + 16);
        ctx.lineTo(trR.x + 26, trR.y - lift + 8);
        ctx.lineTo(trR.x + 42, trR.y + 16);
        ctx.stroke();
        ctx.restore();
      }
    `);
    explanations.push("Coloca un trampolín elástico animado en el mapa que impulsa al jugador a gran altura.");
  }

  // M22. Torreta / Cañón Automático / Sierra Giratoria
  if (/torreta|cañon\s+automatico|cañón\s+automático|centinela|sentry|sierra\s+circular|sierra|laser\s+giratorio|láser\s+giratorio/.test(fullLower)) {
    hasSpecificMatch = true;
    jsInitSections.push(`
      var pTurInit = api && api.getPlayer ? api.getPlayer() : null;
      state.turret = { x: pTurInit ? pTurInit.x + 70 : 200, y: pTurInit ? pTurInit.y : 260, angle: 0, fireT: 0 };
    `);
    jsHookSections.push(`
      if (state.turret) {
        state.turret.angle += (dt || 0.016) * 5;
        state.turret.fireT += (dt || 0.016);
        var enemiesT = api && api.getEntities ? api.getEntities("enemy") : [];
        if (state.turret.fireT >= 0.9 && enemiesT.length > 0) {
          state.turret.fireT = 0;
          var enT = enemiesT[0];
          if (enT && enT.visible !== false && Math.hypot(enT.x - state.turret.x, enT.y - state.turret.y) < 340) {
            if (api && api.emitBurst) api.emitBurst(enT.x + enT.w / 2, enT.y + enT.h / 2, "#facc15", 16);
            enT.x = -99999;
            enT.visible = false;
            if (api && api.addScore) api.addScore(25);
          }
        }
      }
    `);
    jsRenderSections.push(`
      if (state.turret) {
        ctx.save();
        ctx.translate(state.turret.x, state.turret.y);
        ctx.rotate(state.turret.angle);
        ctx.fillStyle = "#eab308";
        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillRect(0, -4, 24, 8);
        ctx.restore();
      }
    `);
    explanations.push("Construye una torreta / sierra giratoria en HTML5 que apunta y elimina enemigos cercanos automáticamente.");
  }

  // M23. Inventario / Tienda / Cofre de Tesoro / Llave
  if (/inventario|mochila|tienda|comprar|cofre|tesoro|llave|pocion|poción|item|objeto\s+especial/.test(fullLower)) {
    hasSpecificMatch = true;
    jsInitSections.push(`
      var pChInit = api && api.getPlayer ? api.getPlayer() : null;
      state.chest = { x: pChInit ? pChInit.x + 120 : 250, y: pChInit ? pChInit.y + 8 : 270, opened: false };
      state.inventoryItems = ["⚡ Turbo", "🛡️ Escudo"];
    `);
    jsHookSections.push(`
      var pCh = api && api.getPlayer ? api.getPlayer() : null;
      if (pCh && state.chest && !state.chest.opened) {
        if (Math.hypot((pCh.x + pCh.w / 2) - state.chest.x, (pCh.y + pCh.h / 2) - state.chest.y) < 46) {
          state.chest.opened = true;
          state.inventoryItems.push("👑 Reliquia");
          if (api && api.addScore) api.addScore(100);
          if (api && api.playSound) api.playSound("powerup");
          if (api && api.emitBurst) api.emitBurst(state.chest.x, state.chest.y, "#facc15", 20);
        }
      }
    `);
    jsRenderSections.push(`
      if (state.chest) {
        ctx.save();
        ctx.fillStyle = state.chest.opened ? "#a16207" : "#eab308";
        ctx.strokeStyle = "#422006";
        ctx.lineWidth = 3;
        ctx.fillRect(state.chest.x - 18, state.chest.y - 14, 36, 28);
        ctx.strokeRect(state.chest.x - 18, state.chest.y - 14, 36, 28);
        ctx.restore();
      }
    `);
    jsOverlaySections.push(`
      if (state.inventoryItems) {
        ctx.save();
        ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
        ctx.fillRect(W / 2 - 120, H - 38, 240, 28);
        ctx.fillStyle = "#facc15";
        ctx.font = "bold 11px Inter, system-ui, sans-serif";
        ctx.fillText("INVENTARIO: " + state.inventoryItems.join(" · "), W / 2 - 110, H - 20);
        ctx.restore();
      }
    `);
    explanations.push("Añade un cofre del tesoro interactivo en el mapa y una barra de inventario en el HUD HTML5.");
  }

  // M24. Diálogo RPG / NPC Hablante / Historia / Misión
  if (/dialogo|diálogo|npc|hablar|conversar|historia|cinematica|cinemática|aldeano|sabio|cartel|letrero|mision|misión|quest/.test(fullLower)) {
    hasSpecificMatch = true;
    const npcQuote = cleanCode.match(/["“”'«»]([^"“”'«»]+)["“”'«»]/)?.[1] || "¡Bienvenido, viajero! Completa la misión para triunfar.";
    jsInitSections.push(`
      var pNpcInit = api && api.getPlayer ? api.getPlayer() : null;
      state.npc = { x: pNpcInit ? pNpcInit.x + 115 : 240, y: pNpcInit ? pNpcInit.y : 260, talking: false, text: ${JSON.stringify(npcQuote)} };
    `);
    jsHookSections.push(`
      var pNpc = api && api.getPlayer ? api.getPlayer() : null;
      if (pNpc && state.npc) {
        state.npc.talking = Math.hypot((pNpc.x + pNpc.w / 2) - state.npc.x, (pNpc.y + pNpc.h / 2) - state.npc.y) < 75;
      }
    `);
    jsRenderSections.push(`
      if (state.npc) {
        ctx.save();
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.roundRect(state.npc.x - 16, state.npc.y - 22, 32, 44, 8);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px sans-serif";
        ctx.fillText("NPC", state.npc.x - 11, state.npc.y - 28);
        ctx.restore();
      }
    `);
    jsOverlaySections.push(`
      if (state.npc && state.npc.talking) {
        ctx.save();
        ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.fillRect(30, H - 96, W - 60, 54);
        ctx.strokeRect(30, H - 96, W - 60, 54);
        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 12px Inter, system-ui, sans-serif";
        ctx.fillText(state.npc.text, 44, H - 64);
        ctx.restore();
      }
    `);
    explanations.push("Crea un NPC interactivo con cuadro de diálogo estilo RPG en el lienzo HTML5 cuando el jugador se acerca.");
  }

  parsedBlocks.forEach((block, blockIndex) => {
    let eventType: EventType = block.eventType;
    if (opts?.allowedEvents && opts.allowedEvents.length > 0 && !opts.allowedEvents.includes(eventType)) {
      eventType = opts.allowedEvents[0];
    }

    const scriptBlocks: Block[] = [];
    const jsActionStatements: string[] = [];

    // Expand compound instructions from custom dictionary meanings (e.g. "Sumar 500 puntos y sacudir camara 12")
    const atomicActions: string[] = [];
    for (const rawAction of block.actions) {
      const baseCmd = rawAction.split(" (")[0].trim();
      const isDirectMapSound = /sonido.*mapa|mostrar.*sonido|onda.*sonora|radar.*sonido|eco.*mapa|alarma.*mapa/i.test(baseCmd);
      const dictParens = rawAction.match(/\(([^)]+)\)/);
      if (!isDirectMapSound && dictParens && /\s+y\s+|;/i.test(dictParens[1])) {
        const subParts = dictParens[1]
          .split(/\s+y\s+|;/i)
          .map((s) => s.trim())
          .filter(Boolean);
        atomicActions.push(...subParts);
      } else {
        atomicActions.push(rawAction);
      }
    }

    for (const rawAction of atomicActions) {
      const lower = rawAction.toLowerCase();
      const quotedMatch = rawAction.match(/["“”'«»]([^"“”'«»]+)["“”'«»]/);
      const numMatch = rawAction.match(/(-?\d+(?:\.\d+)?)/);
      const numVal = numMatch ? Number(numMatch[1]) : null;

      // 1. MOSTRAR sonido en el mapa / Radar sonoro visual + acústico
      if (/sonido.*mapa|mostrar.*sonido|onda.*sonora|radar.*sonido|eco.*mapa|alarma.*mapa/.test(lower)) {
        hasSpecificMatch = true;
        const soundName = `user_lang_map_sound_${blockIndex + 1}`;
        synthSounds[soundName] = {
          name: soundName,
          wave: eventType === "onLose" ? "sawtooth" : "triangle",
          freq: eventType === "onLose" ? 240 : 520,
          endFreq: eventType === "onLose" ? 95 : 880,
          duration: 0.55,
          volume: 0.36,
        };
        scriptBlocks.push({
          id: uid(),
          kind: "playSound",
          text: eventType === "onLose" ? "lose" : "powerup",
          soundName: "Sonido en el mapa",
        });
        scriptBlocks.push({
          id: uid(),
          kind: "shake",
          value: 7,
        });
        scriptBlocks.push({
          id: uid(),
          kind: "sayForSecs",
          text: "🔊 SONIDO EN EL MAPA",
          value: 2,
        });

        jsActionStatements.push(`
          if (api && typeof api.playSound === "function") {
            api.playSound("synth:${soundName}");
          } else if (window.AsternalAudio && typeof window.AsternalAudio.play === "function") {
            window.AsternalAudio.play("${soundName}");
          }
          var srcEnt = (api && typeof api.getPlayer === "function" && api.getPlayer()) || { x: 320, y: 200, w: 36, h: 48 };
          state.soundWaves.push({
            x: (srcEnt.x || 0) + ((srcEnt.w || 36) / 2),
            y: (srcEnt.y || 0) + ((srcEnt.h || 48) / 2),
            radius: 12,
            maxRadius: 280,
            alpha: 1,
            label: "🔊 SONIDO EN EL MAPA",
            color: "${eventType === "onLose" ? "#fb7185" : "#38bdf8"}"
          });
        `);
        explanations.push(
          `Tradujo "${rawAction.split(" (")[0].trim()}" a un emisor de sonido WebAudio + radar visual de ondas acústicas en el mapa HTML5.`
        );
        continue;
      }

      // 2. Reproducir sonido general
      if (/sonido|audio|alarma|beep|musica|efecto\s+sonoro/.test(lower)) {
        hasSpecificMatch = true;
        const soundKey = /moneda|coin/.test(lower)
          ? "coin"
          : /salto|jump/.test(lower)
          ? "jump"
          : /explosion|bomba|laser/.test(lower)
          ? "hit"
          : eventType === "onLose"
          ? "lose"
          : "powerup";
        scriptBlocks.push({
          id: uid(),
          kind: "playSound",
          text: soundKey,
        });
        jsActionStatements.push(`
          if (api && typeof api.playSound === "function") {
            api.playSound("${soundKey}");
          }
        `);
        explanations.push(`Reproduce el sonido "${soundKey}" cuando se cumple la condición.`);
        continue;
      }

      // 3. Sacudir cámara / pantalla
      if (/sacudir|temblar|vibrar|terremoto|shake/.test(lower)) {
        hasSpecificMatch = true;
        const intensity = numVal ? Math.max(2, Math.min(25, Math.abs(numVal))) : 9;
        scriptBlocks.push({
          id: uid(),
          kind: "shake",
          value: intensity,
        });
        jsActionStatements.push(`
          if (api && typeof api.shake === "function") {
            api.shake(${intensity}, 0.35);
          }
        `);
        explanations.push(`Sacude la cámara del mapa con intensidad ${intensity}.`);
        continue;
      }

      // 4. Saltar / Impulso vertical (incluye "jugador = salto", "salto", "jump")
      if (/\b(salto|saltar|brincar|jump|impulso|elevar|volar)\b/.test(lower)) {
        hasSpecificMatch = true;
        const force = numVal ? Math.abs(numVal) : 520;
        scriptBlocks.push({
          id: uid(),
          kind: "jump",
          value: force,
        });
        scriptBlocks.push({
          id: uid(),
          kind: "playSound",
          text: "jump",
        });
        const isAssignmentStyle = /=/.test(rawAction) && eventType === "onStart";
        if (isAssignmentStyle) {
          jsKeyDownSections.push(`
            if (code === "Space" || code === "ArrowUp" || code === "KeyW" || key === " " || key === "w" || key === "W") {
              var pJumpK = self || (api && typeof api.getPlayer === "function" ? api.getPlayer() : null);
              if (pJumpK) {
                pJumpK.vy = -${force};
                if (api && typeof api.playSound === "function") api.playSound("jump");
              }
            }
          `);
          jsHookSections.push(`
            var pJumpA = self || (api && typeof api.getPlayer === "function" ? api.getPlayer() : null);
            var inpJumpA = api && typeof api.getInput === "function" ? api.getInput() : {};
            if (pJumpA && inpJumpA && inpJumpA.jump && Math.abs(pJumpA.vy || 0) < 2) {
              pJumpA.vy = -${force};
              if (api && typeof api.playSound === "function") api.playSound("jump");
            }
          `);
        } else {
          jsActionStatements.push(`
            var pJump = self || (api && typeof api.getPlayer === "function" ? api.getPlayer() : null);
            if (pJump) {
              pJump.vy = -${force};
              if (api && typeof api.playSound === "function") api.playSound("jump");
            }
          `);
        }
        explanations.push(`Impulsa la entidad hacia arriba con fuerza ${force} en HTML5.`);
        continue;
      }

      // 5. Empujar / Mover / Velocidad / Dash
      if (/empujar|mover|avanzar|desplazar|velocidad|dash|esquivar|turbo|correr|izquierda|derecha/.test(lower)) {
        hasSpecificMatch = true;
        const isDash = /dash|esquivar|turbo/.test(lower);
        const vx = /atras|izquierda|left/.test(lower)
          ? -(numVal ? Math.abs(numVal) : isDash ? 580 : 240)
          : numVal || (isDash ? 580 : 240);
        scriptBlocks.push({
          id: uid(),
          kind: "setVx",
          value: vx,
        });
        if (isDash) {
          scriptBlocks.push({ id: uid(), kind: "playSound", text: "powerup" });
        }
        jsActionStatements.push(`
          var pMove = self || (api && typeof api.getPlayer === "function" ? api.getPlayer() : null);
          if (pMove) {
            var dirMove = pMove.facing === -1 ? -1 : 1;
            pMove.vx = ${isDash ? `dirMove * ${Math.abs(vx)}` : vx};
            if (${isDash} && api && typeof api.emitBurst === "function") {
              api.emitBurst(pMove.x + pMove.w / 2, pMove.y + pMove.h / 2, "#38bdf8", 12);
            }
          }
        `);
        explanations.push(`Aplica velocidad horizontal (${vx} px/s).`);
        continue;
      }

      // 6. Perseguir al jugador
      if (/perseguir|seguir|cazar|buscar\s+jugador/.test(lower)) {
        hasSpecificMatch = true;
        const speed = numVal ? Math.max(40, Math.min(500, Math.abs(numVal))) : 140;
        scriptBlocks.push({
          id: uid(),
          kind: "chase",
          text: "player",
          value: speed,
        });
        jsActionStatements.push(`
          var chaser = self || (api && typeof api.getEntities === "function" ? api.getEntities("enemy")[0] : null);
          var plTarget = api && typeof api.getPlayer === "function" ? api.getPlayer() : null;
          if (chaser && plTarget && chaser !== plTarget) {
            chaser.vx = (plTarget.x >= chaser.x ? 1 : -1) * ${speed};
          }
        `);
        explanations.push(`Activa persecución hacia el jugador a velocidad ${speed}.`);
        continue;
      }

      // 7. Puntos / Score
      if (/punto|puntos|score|moneda|recompensa/.test(lower)) {
        hasSpecificMatch = true;
        const delta = /restar|quitar|perder/.test(lower)
          ? -(numVal ? Math.abs(numVal) : 10)
          : numVal || 10;
        scriptBlocks.push({
          id: uid(),
          kind: "addScore",
          value: delta,
        });
        jsActionStatements.push(`
          if (api && typeof api.addScore === "function") { api.addScore(${delta}); }
        `);
        explanations.push(`Modifica el puntaje en ${delta > 0 ? `+${delta}` : delta} puntos.`);
        continue;
      }

      // 8. Vidas / Salud / Daño
      if (/vida|vidas|salud|curar|daño|restar\s+vida|hurt/.test(lower)) {
        hasSpecificMatch = true;
        const delta = /restar|quitar|daño|perder|hurt/.test(lower)
          ? -(numVal ? Math.abs(numVal) : 1)
          : numVal || 1;
        scriptBlocks.push({
          id: uid(),
          kind: "addLives",
          value: delta,
        });
        jsActionStatements.push(`
          if (api && typeof api.addLives === "function") { api.addLives(${delta}); }
        `);
        explanations.push(`Cambia las vidas del jugador en ${delta > 0 ? `+${delta}` : delta}.`);
        continue;
      }

      // 9. Disparar / Proyectil / Láser / Ataque
      if (/dispar|proyectil|bala|laser|láser|fuego|lanzar/.test(lower)) {
        hasSpecificMatch = true;
        synthSounds.laser = {
          name: "laser",
          wave: "sawtooth",
          freq: 780,
          endFreq: 160,
          duration: 0.16,
          volume: 0.34,
        };
        scriptBlocks.push({
          id: uid(),
          kind: "playSound",
          text: "powerup",
        });
        scriptBlocks.push({
          id: uid(),
          kind: "shake",
          value: 4,
        });
        jsActionStatements.push(`
          var pShot = self || (api && typeof api.getPlayer === "function" ? api.getPlayer() : null);
          if (pShot) {
            if (api && typeof api.playSound === "function") api.playSound("synth:laser");
            if (api && typeof api.emitBurst === "function") {
              api.emitBurst(pShot.x + pShot.w / 2, pShot.y + pShot.h / 2, "#38bdf8", 14);
            }
            var enemiesNow = api && typeof api.getEntities === "function" ? api.getEntities("enemy") : [];
            for (var ei = 0; ei < enemiesNow.length; ei++) {
              var en = enemiesNow[ei];
              if (Math.abs((en.x || 0) - (pShot.x || 0)) < 320 && Math.abs((en.y || 0) - (pShot.y || 0)) < 140) {
                en.x = -99999;
                if (api && typeof api.addScore === "function") api.addScore(25);
                break;
              }
            }
          }
        `);
        explanations.push(`Dispara un pulso láser que impacta enemigos cercanos.`);
        continue;
      }

      // 10. Onda de energía / Explosión / Partículas
      if (/onda|energia|explosion|particula|destello|rayo|magia/.test(lower)) {
        hasSpecificMatch = true;
        scriptBlocks.push({
          id: uid(),
          kind: "shake",
          value: 8,
        });
        scriptBlocks.push({
          id: uid(),
          kind: "playSound",
          text: "powerup",
        });
        jsActionStatements.push(`
          var pWave = self || (api && typeof api.getPlayer === "function" && api.getPlayer()) || { x: 320, y: 200, w: 36, h: 48 };
          if (api && typeof api.emitBurst === "function") {
            api.emitBurst((pWave.x || 0) + 18, (pWave.y || 0) + 24, "#38bdf8", 18);
          }
        `);
        explanations.push(`Genera una onda de energía visual y partículas en el mapa.`);
        continue;
      }

      // 11. Decir / Mostrar texto o mensaje
      if (/^(decir|mostrar\s+texto|mensaje|avisar|alerta)\b/i.test(rawAction.trim()) || quotedMatch) {
        hasSpecificMatch = true;
        const msg =
          quotedMatch?.[1]?.trim() ||
          rawAction
            .replace(/^(decir|mostrar\s+texto|mensaje|avisar|alerta)\s*:?\s*/i, "")
            .split(" (")[0]
            .trim() ||
          "¡Acción activada!";
        scriptBlocks.push({
          id: uid(),
          kind: "sayForSecs",
          text: msg,
          value: 2000,
        });
        jsActionStatements.push(`
          var pMsg = self || (api && typeof api.getPlayer === "function" && api.getPlayer());
          if (pMsg) {
            pMsg._bubbleText = ${JSON.stringify(msg.slice(0, 48))};
            pMsg._bubbleKind = "say";
            pMsg._bubbleUntil = ((api && api.state && api.state.time) || 0) + 2.5;
          }
        `);
        explanations.push(`Muestra el mensaje "${msg}" en la entidad.`);
        continue;
      }

      // 12. Teletransportar / Posición
      if (/teletransport|transportar|mover\s+a|posicion/.test(lower)) {
        hasSpecificMatch = true;
        const coords = rawAction.match(/(-?\d+)\s*[,x\s]\s*(-?\d+)/);
        const tx = coords ? Number(coords[1]) : numVal ?? 200;
        const ty = coords ? Number(coords[2]) : 240;
        scriptBlocks.push({
          id: uid(),
          kind: "teleport",
          x: tx,
          y: ty,
        });
        jsActionStatements.push(`
          var pTp = self || (api && typeof api.getPlayer === "function" && api.getPlayer());
          if (pTp) { pTp.x = ${tx}; pTp.y = ${ty}; }
        `);
        explanations.push(`Teletransporta la entidad a (${tx}, ${ty}).`);
        continue;
      }

      // 13. Cambiar color / tamaño
      if (/color|pintar/.test(lower)) {
        hasSpecificMatch = true;
        const hexMatch = rawAction.match(/#[0-9a-fA-F]{3,6}/);
        const color = hexMatch
          ? hexMatch[0]
          : /rojo|red/.test(lower)
            ? "#ef4444"
            : /verde|green/.test(lower)
              ? "#22c55e"
              : /amarillo|oro|yellow/.test(lower)
                ? "#eab308"
                : /morado|purple/.test(lower)
                  ? "#a855f7"
                  : "#38bdf8";
        scriptBlocks.push({
          id: uid(),
          kind: "setColor",
          text: color,
          color,
        });
        jsActionStatements.push(`
          var pCol = self || (api && typeof api.getPlayer === "function" && api.getPlayer());
          if (pCol) { pCol.color = ${JSON.stringify(color)}; }
        `);
        explanations.push(`Cambia el color a ${color}.`);
        continue;
      }

      if (/tamaño|escala|agrandar|encoger|gigante|pequeño/.test(lower)) {
        hasSpecificMatch = true;
        const factor = /encoger|pequeño/.test(lower) ? 0.7 : /gigante/.test(lower) ? 1.8 : 1.35;
        scriptBlocks.push({
          id: uid(),
          kind: "changeSizeBy",
          value: Math.round((factor - 1) * 100),
        });
        jsActionStatements.push(`
          var pSz = self || (api && typeof api.getPlayer === "function" && api.getPlayer());
          if (pSz) {
            pSz.w = Math.max(8, Math.round((pSz.w || 36) * ${factor}));
            pSz.h = Math.max(8, Math.round((pSz.h || 48) * ${factor}));
          }
        `);
        explanations.push(`Escala el tamaño por ${factor}.`);
        continue;
      }

      // 14. Ganar / Perder
      if (/\b(ganar|victoria|completar\s+nivel)\b/.test(lower)) {
        hasSpecificMatch = true;
        scriptBlocks.push({ id: uid(), kind: "win" });
        jsActionStatements.push(`if (api && typeof api.win === "function") api.win();`);
        explanations.push(`Activa la victoria de la partida.`);
        continue;
      }

      if (/\b(perder|derrota|morir|game\s*over)\b/.test(lower)) {
        hasSpecificMatch = true;
        scriptBlocks.push({ id: uid(), kind: "lose" });
        jsActionStatements.push(`if (api && typeof api.lose === "function") api.lose();`);
        explanations.push(`Activa el fin de partida (derrota).`);
        continue;
      }

      // 15. Gravedad / Destruir
      if (/gravedad/.test(lower)) {
        hasSpecificMatch = true;
        const gVal = numVal !== null ? Math.max(0, numVal) : 800;
        scriptBlocks.push({
          id: uid(),
          kind: "setSceneGravity",
          value: gVal,
        });
        jsActionStatements.push(`if (api && typeof api.setGravity === "function") api.setGravity(${gVal});`);
        explanations.push(`Ajusta la gravedad de la escena a ${gVal}.`);
        continue;
      }

      if (/destruir|eliminar|borrar|desaparecer/.test(lower)) {
        hasSpecificMatch = true;
        scriptBlocks.push({
          id: uid(),
          kind: "destroySelf",
        });
        jsActionStatements.push(`
          var pDel = self || (api && typeof api.getPlayer === "function" && api.getPlayer());
          if (pDel) {
            if (api && typeof api.destroyEntity === "function") api.destroyEntity(pDel);
            else pDel.x = -99999;
          }
        `);
        explanations.push(`Destruye la entidad objetivo al cumplirse la regla.`);
        continue;
      }

      // 16. Asignación directa "propiedad = valor" (ej. x = 100, vx = 200, vy = -400)
      const assignMatch = rawAction.split(" (")[0].trim().match(/^([a-zA-ZáéíóúñÁÉÍÓÚÑ_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
      if (assignMatch && numVal !== null) {
        hasSpecificMatch = true;
        const lhs = assignMatch[1].toLowerCase();
        if (lhs === "x" || lhs === "posx") {
          scriptBlocks.push({ id: uid(), kind: "setX", value: numVal });
          jsActionStatements.push(`var tEnt = self || (api && api.getPlayer ? api.getPlayer() : null); if (tEnt) tEnt.x = ${numVal};`);
        } else if (lhs === "y" || lhs === "posy") {
          scriptBlocks.push({ id: uid(), kind: "setY", value: numVal });
          jsActionStatements.push(`var tEnt = self || (api && api.getPlayer ? api.getPlayer() : null); if (tEnt) tEnt.y = ${numVal};`);
        } else if (lhs === "vx" || lhs === "velx") {
          scriptBlocks.push({ id: uid(), kind: "setVx", value: numVal });
          jsActionStatements.push(`var tEnt = self || (api && api.getPlayer ? api.getPlayer() : null); if (tEnt) tEnt.vx = ${numVal};`);
        } else if (lhs === "vy" || lhs === "vely") {
          scriptBlocks.push({ id: uid(), kind: "setVy", value: numVal });
          jsActionStatements.push(`var tEnt = self || (api && api.getPlayer ? api.getPlayer() : null); if (tEnt) tEnt.vy = ${numVal};`);
        } else {
          scriptBlocks.push({ id: uid(), kind: "setVariable", text: assignMatch[1], value: numVal });
          jsActionStatements.push(`if (api && api.scene) { api.scene.variables = api.scene.variables || {}; api.scene.variables[${JSON.stringify(assignMatch[1])}] = ${numVal}; }`);
        }
        explanations.push(`Asigna ${assignMatch[1]} = ${numVal} en el motor HTML5.`);
        continue;
      }

      // Unknown syntax must never create or approximate gameplay.
      explanations.push(`Instrucción no reconocida: ${rawAction}. Traduce este script con Lovable AI.`);
    }

    const scriptObj: Script = {
      id: uid(),
      event: eventType,
      key: block.key,
      interval: block.intervalMs,
      withKind: block.withKind,
      blocks: scriptBlocks,
      customLanguageCode: `${block.header}\n${block.actions.map((a) => a.split(" (")[0]).join("\n")}`,
      languageName: lang.name,
      aiExplanation: explanations[explanations.length - 1] || `Traducido desde ${lang.name}`,
    };
    compiledScripts.push(scriptObj);

    const jsTriggerBody = jsActionStatements.join("\n");
    if (!jsTriggerBody.trim()) {
      return;
    }
    if (eventType === "onLose") {
      jsHookSections.push(`
        // Bloque ${blockIndex + 1}: ${block.header.replace(/\r?\n/g, " ")}
        var isDeadNow_${blockIndex} = Boolean(
          (api && api.state && (api.state.dead || api.state.lives <= 0 || api.state.status === "lost")) ||
          (api && typeof api.getLives === "function" && api.getLives() <= 0)
        );
        var playerNow_${blockIndex} = api && typeof api.getPlayer === "function" ? api.getPlayer() : null;
        var fellInAbyss_${blockIndex} = Boolean(playerNow_${blockIndex} && typeof playerNow_${blockIndex}.y === "number" && playerNow_${blockIndex}.y > 680);
        if ((isDeadNow_${blockIndex} || fellInAbyss_${blockIndex}) && !state.loseTriggered_${blockIndex}) {
          state.loseTriggered_${blockIndex} = true;
          ${jsTriggerBody}
        } else if (!isDeadNow_${blockIndex} && !fellInAbyss_${blockIndex}) {
          state.loseTriggered_${blockIndex} = false;
        }
      `);
    } else if (eventType === "onWin") {
      jsHookSections.push(`
        var isWonNow_${blockIndex} = Boolean(api && api.state && (api.state.won || api.state.status === "won"));
        if (isWonNow_${blockIndex} && !state.winTriggered_${blockIndex}) {
          state.winTriggered_${blockIndex} = true;
          ${jsTriggerBody}
        } else if (!isWonNow_${blockIndex}) {
          state.winTriggered_${blockIndex} = false;
        }
      `);
    } else if (eventType === "onTimer") {
      const intervalSec = (block.intervalMs || 2000) / 1000;
      jsHookSections.push(`
        state.timerAcc_${blockIndex} = (state.timerAcc_${blockIndex} || 0) + (dt || 0.016);
        if (state.timerAcc_${blockIndex} >= ${intervalSec}) {
          state.timerAcc_${blockIndex} = 0;
          ${jsTriggerBody}
        }
      `);
    } else if (eventType === "onStart") {
      jsHookSections.push(`
        if (!state.started_${blockIndex}) {
          state.started_${blockIndex} = true;
          ${jsTriggerBody}
        }
      `);
    } else if (eventType === "onCollide") {
      jsCollideSections.push(`
        ${jsTriggerBody}
      `);
    } else if (eventType === "onKeyDown") {
      jsKeyDownSections.push(`
        ${jsTriggerBody}
      `);
    } else {
      jsHookSections.push(`
        ${jsTriggerBody}
      `);
    }
  });

  const soundRegistrations = Object.entries(synthSounds)
    .map(
      ([name, spec]) =>
        `  if (window.AsternalAudio && typeof window.AsternalAudio.registerSound === "function") {\n` +
        `    window.AsternalAudio.registerSound(${JSON.stringify(name)}, ${JSON.stringify(spec)});\n` +
        `  }`
    )
    .join("\n");

  const compiledJs = [
    `// Script HTML5 · ${lang.name}`,
    `// Fuente: ${cleanCode.replace(/\r?\n/g, " | ")}`,
    `(function() {`,
    `  if (typeof window === "undefined" || !window.AsternalRuntime) return;`,
    `  var selfRef = typeof self !== "undefined" ? self : null;`,
    soundRegistrations,
    `  var state = { soundWaves: [], flashAlpha: 0 };`,
    `  window.AsternalRuntime.registerHook({`,
    `    id: ${JSON.stringify(programId)},`,
    `    onInit: function(api) {`,
    `      var self = selfRef;`,
    `      state.soundWaves = [];`,
    jsInitSections.join("\n"),
    `    },`,
    jsKeyDownSections.length > 0
      ? `    onKeyDown: function(code, key, api) {\n      var self = selfRef;\n${jsKeyDownSections.join("\n")}\n    },`
      : "",
    jsPointerDownSections.length > 0
      ? `    onPointerDown: function(worldX, worldY, api) {\n      var self = selfRef;\n${jsPointerDownSections.join("\n")}\n    },`
      : "",
    jsCollideSections.length > 0
      ? `    onCollide: function(a, b, api) {\n      var self = selfRef;\n${jsCollideSections.join("\n")}\n    },`
      : "",
    `    onTick: function(api, dt) {`,
    `      var self = selfRef;`,
    `      ${jsHookSections.join("\n")}`,
    `      for (var i = state.soundWaves.length - 1; i >= 0; i--) {`,
    `        var w = state.soundWaves[i];`,
    `        w.radius += (dt || 0.016) * 210;`,
    `        w.alpha = Math.max(0, 1 - (w.radius / (w.maxRadius || 260)));`,
    `        if (w.alpha <= 0.02) state.soundWaves.splice(i, 1);`,
    `      }`,
    `    },`,
    jsRenderSections.length > 0
      ? `    onRender: function(ctx, api) {\n      if (!ctx) return;\n      var self = selfRef;\n${jsRenderSections.join("\n")}\n    },`
      : "",
    jsOverlaySections.length > 0
      ? `    onRenderOverlay: function(ctx, api, W, H) {\n      if (!ctx) return;\n      var self = selfRef;\n${jsOverlaySections.join("\n")}\n    },`
      : "",
    `  });`,
    `})();`,
  ]
    .filter(Boolean)
    .join("\n");

  for (const s of compiledScripts) {
    s.compiledJs = compiledJs;
  }

  return {
    programId,
    title,
    sourceCode: cleanCode,
    expandedSourceCode: expandedCode,
    compiledJs,
    compiledScripts,
    synthSounds,
    explanation:
      explanations.join(" ") ||
      `Código en "${lang.name}" compilado a JavaScript/HTML5 nativo.`,
    detectedKeywords,
    hasSpecificMatch,
  };
}

/**
 * Detecta si un fragmento de JS guardado proviene del antiguo generador de
 * placeholders (círculos concéntricos `state.soundWaves.push` que repetían el
 * texto de la instrucción en pantalla) o si tiene errores de sintaxis como
 * `const me>` producidos por recorte de etiquetas `<script>`.
 */
export function isLegacyPlaceholderScriptJs(
  jsCode?: string | null,
  customLanguageCode?: string | null,
): boolean {
  const trimmed = (jsCode ?? "").trim();
  if (!trimmed) return false;
  if (/\b(?:const|let|var)\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*>/.test(trimmed)) {
    return true;
  }
  const asksForRadar = /mostrar\s+sonido.*mapa|radar.*sonido|eco.*mapa/i.test(
    customLanguageCode ?? "",
  );
  if (
    !asksForRadar &&
    /state\.soundWaves\.push\s*\(\s*\{[\s\S]*?label\s*:/i.test(trimmed)
  ) {
    return true;
  }
  return false;
}

/**
 * Limpia, repara y valida cualquier script JavaScript/HTML5 antes de inyectarlo
 * en el runtime. Si el código tiene un error de sintaxis (por ejemplo `const me>`)
 * o es un placeholder antiguo, lo recompila a HTML5 válido o devuelve un comentario
 * seguro para que nunca dispare `SyntaxError` en tiempo de ejecución.
 */
export function sanitizeOrUpgradeHtml5ScriptJs(
  jsCode?: string | null,
  customLanguageCode?: string | null,
  targetEntityId?: string,
  targetEntityKind?: EntityKind,
): string {
  let candidate = (jsCode ?? "").trim();

  // Desenvolver ```javascript ... ``` o <script>...</script> solo cuando envuelven el bloque
  const fenced = candidate.match(/^```(?:javascript|js|html)?\s*([\s\S]*?)```$/i);
  if (fenced) {
    candidate = fenced[1].trim();
  }
  const scriptWrapped = candidate.match(/^\s*<script\b[^>]*>([\s\S]*?)<\/script>\s*$/i);
  if (scriptWrapped) {
    candidate = scriptWrapped[1].trim();
  }

  // Reparar patrón corrupto `const me>` / `let me>` / `var me>` guardado en proyectos previos
  candidate = candidate.replace(
    /\b(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*>\s*/g,
    "$1 $2 = self || (api && api.getPlayer ? api.getPlayer() : null);\n",
  );

  const needsRecompile =
    !candidate ||
    isLegacyPlaceholderScriptJs(candidate, customLanguageCode);

  if (!needsRecompile) {
    try {
      // Validación sintáctica previa sin ejecutar efectos secundarios
      new Function("api", "self", candidate);
      return candidate;
    } catch {
      // Si falla la validación sintáctica, recompilar abajo
    }
  }

  // Never retranslate saved source with the retired heuristic compiler.
  return "// Script no ejecutado: requiere traducción con Lovable AI";
}
