import { createBrowserClient } from "@supabase/ssr"
import { 
    PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    PUBLIC_SUPABASE_URL,
} from "$env/static/public"

export const supabaseClient = createBrowserClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_PUBLISHABLE_KEY,
)