import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";
import glassCss from "../glass.css?url";

import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        {/* M3: el número usa el rol display y el texto los roles headline/body. */}
        <h1 className="m3-display-large text-primary">404</h1>
        <h2 className="m3-headline-small mt-4 text-foreground">Página no encontrada</h2>
        <p className="m3-body-medium mt-2 text-muted-foreground">
          La página que buscas no existe o fue movida.
        </p>
        <div className="mt-6">
          <Link to="/" className="m3-btn">
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error instanceof Error ? error : new Error(String(error)), { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="m3-headline-small text-foreground">
          No se pudo cargar la página
        </h1>
        <p className="m3-body-medium mt-2 text-muted-foreground">
          Algo salió mal. Intenta recargar o vuelve al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="m3-btn"
          >
            Reintentar
          </button>
          <a href="/" className="m3-btn m3-btn-outlined">
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

const THEME_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("ast_preferences")||"{}");var t=p.theme==="dark"?"dark":"light";var r=document.documentElement;r.classList.toggle("dark",t==="dark");r.style.colorScheme=t;}catch(e){}})();`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: "Editor Asternal" },
      { name: "description", content: "Editor nativo de escenas y juegos de Asternal." },
      { property: "og:title", content: "Editor Asternal" },
      { property: "og:description", content: "Editor nativo de escenas y juegos de Asternal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: glassCss },
      { rel: "icon", type: "image/svg+xml", href: "/logo.svg?v=2" },
      { rel: "alternate icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&family=Fredoka:wght@500;600;700&family=Geist+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Sin menú de clic derecho del navegador en toda la app: el menú nativo
  // (Chrome/«Google») tapaba la interfaz y no aportaba nada aquí. Se conserva
  // dentro de campos de texto para no romper pegar/cortar/seleccionar.
  useEffect(() => {
    document.documentElement.removeAttribute("data-theme-style");
    const blockContextMenu = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", blockContextMenu);
    return () => document.removeEventListener("contextmenu", blockContextMenu);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
