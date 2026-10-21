<script lang="ts">
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '\$env/static/public';
  import { createBrowserClient } from '@supabase/ssr';
  import type { Provider } from '@supabase/supabase-js';

  const supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  async function signInWithOAuth(provider: Provider): Promise<void> {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  }
</script>

<div class="login-container">
  <h1>Portal Authentication</h1>
  <p>Sign up or log in below to access the website.</p>
  <button onclick={() => signInWithOAuth('google')}>Sign in with Google</button>
</div>
