import { handleApp } from "../functions/handler.mjs";
import { createFixture } from "./fixture.mjs";

// In-memory only: never connects to a real database or reads credentials.
const supabase = createFixture();
Deno.serve({ hostname: "127.0.0.1", port: 8000 }, (request: Request) =>
  handleApp({ request, supabase }));
