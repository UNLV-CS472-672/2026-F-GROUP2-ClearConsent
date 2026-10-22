<script lang="ts">
    import type { ActionData } from './$types';

    // Svelte 5 rune to read form response statuses sent back by the server
    let { form }: { form: ActionData & { message?: string; success?: boolean }} = $props();
</script>

<main class="register-container">
    <h2>Login to your Account</h2>

    <!-- Display status alerts back to the user -->
    {#if form?.message}
        <div class="alert" class:success={form?.success} class:error={!form?.success}>
            {form.message}
        </div>
    {/if}

    <!-- Standard HTML Form submitting natively via POST to our default action -->
    <form method="POST">
        <div class="form-group">
            <label for="email">Email Address</label>
            <input type="email" id="email" name="email" required placeholder="name@example.com" />
        </div>

        <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required minlength="6" placeholder="••••••••" />
        </div>

        <button type="submit" class="btn-submit">Log In</button>
    </form>

    <p class="toggle-text">
        Don't have an account? <a href="/register">Sign up instead</a>
    </p>
</main>

<style>
    .register-container { max-width: 400px; margin: 3rem auto; padding: 2rem; border: 1px solid #e2e8f0; border-radius: 8px; font-family: sans-serif; }
    .form-group { margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
    input { padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px; }
    .btn-submit { width: 100%; padding: 0.75rem; background-color: #2563eb; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
    .btn-submit:hover { background-color: #1d4ed8; }
    .alert { padding: 0.75rem; margin-bottom: 1rem; border-radius: 4px; font-size: 0.9rem; }
    .alert.error { background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .alert.success { background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .toggle-text { margin-top: 1.5rem; text-align: center; font-size: 0.9rem; }
</style>