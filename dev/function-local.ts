import { handler } from "../functions/handler.mjs";

// Local fixture supabase client for development
const fakeSupabase = {
  from: (table: string) => ({
    select: (...args: any[]) => ({
      eq: (col: string, val: any) => ({
        order: (col2: string, opts: any) => ({
          limit: (n: number) => ({ data: [], error: null, count: 0 }),
          maybeSingle: () => ({ data: null, error: null }),
          single: () => ({ data: null, error: null }),
        }),
        maybeSingle: () => ({ data: null, error: null }),
        single: () => ({ data: null, error: null }),
        select: (...a2: any[]) => ({ data: [], error: null }),
      }),
      order: (col2: string, opts: any) => ({
        limit: (n: number) => ({ data: [], error: null, count: 0 }),
        maybeSingle: () => ({ data: null, error: null }),
        single: () => ({ data: null, error: null }),
        range: (a: number, b: number) => ({ data: [], error: null }),
      }),
      limit: (n: number) => ({ data: [], error: null, count: 0 }),
      range: (a: number, b: number) => ({ data: [], error: null }),
      maybeSingle: () => ({ data: null, error: null }),
      single: () => ({ data: null, error: null }),
    }),
    insert: (row: any) => ({
      select: () => ({
        single: () => ({ data: row, error: null }),
      }),
    }),
    update: (fields: any) => ({
      eq: (col: string, val: any) => ({
        select: () => ({
          maybeSingle: () => ({ data: { ...fields, id: val }, error: null }),
        }),
      }),
    }),
    delete: () => ({
      eq: (col: string, val: any) => ({ error: null }),
    }),
  }),
};

const localHandler = async (request: Request) => {
  return handleApp({ request, supabase: fakeSupabase as any });
};

Deno.serve({ hostname: "127.0.0.1", port: 8000 }, localHandler);
