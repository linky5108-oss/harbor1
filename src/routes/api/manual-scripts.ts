import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/manual-scripts")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleManualTranslation } = await import("@/lib/ai/manual-translator.server");
    return handleManualTranslation(request, { key: process.env["LOVABLE_API_KEY"], url: process.env["SUPABASE_URL"], publicKey: process.env["SUPABASE_PUBLISHABLE_KEY"] });
  } } },
});