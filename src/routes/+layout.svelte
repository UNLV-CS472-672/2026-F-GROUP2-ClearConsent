<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import { supabaseClient } from '$lib/supabase.client';
    import './layout.css';

    let { children } = $props();

    $effect(() => {
        const {
            data: { subscription }
        } = supabaseClient.auth.onAuthStateChange(() => {
            invalidateAll();
        });

        // The returned function automatically runs when the component is destroyed
        return () => {
            subscription.unsubscribe();
        };
    });
</script>

{@render children()}
