<script>
    import { onMount } from 'svelte';
    import { auth } from '$lib/utils/api.js';

    let authenticated = false;
    let checked = false;

    onMount(async () => {
        try {
            const status = await auth.status();
            authenticated = status.authenticated && !status.expired;
        } catch {
            authenticated = false;
        } finally {
            checked = true;
        }
    });
</script>

{#if !checked}
    <div class="loading">Loading...</div>
{:else if !authenticated}
    <div class="login">
        <h1>AniTV</h1>
        <p>Connect your MyAnimeList account to get started.</p>
        <a href="http://localhost:3001/auth/login" class="btn">Login with MAL</a>
    </div>
{:else}
    <slot />
{/if}

<style>
    :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
    :global(body) { background: #0d0d0d; color: #eee; font-family: sans-serif; }
    :global(a) { color: inherit; }

    .loading {
        display: grid;
        place-items: center;
        height: 100vh;
        color: #666;
    }
    .login {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        gap: 1rem;
    }
    .login h1 { font-size: 2rem; }
    .login p  { color: #888; }
    .btn {
        padding: 0.6rem 1.5rem;
        background: #e05;
        border-radius: 6px;
        text-decoration: none;
        font-weight: 600;
        color: #fff;
    }
    .btn:hover { background: #c04; }
</style>