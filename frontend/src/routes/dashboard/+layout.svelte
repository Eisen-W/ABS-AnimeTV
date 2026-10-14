<script>
    import { unresolvedCount, loadAlerts } from '$lib/stores/alerts.js';
    import { onMount } from 'svelte';

    onMount(loadAlerts);
</script>

<div class="dash">
    <nav>
        <span class="brand">AniTV</span>
        <a href="/dashboard">Overview</a>
        <a href="/dashboard/channels">Channels</a>
        <a href="/">← Watch</a>
        {#if $unresolvedCount > 0}
            <span class="badge">{$unresolvedCount}</span>
        {/if}
    </nav>
    <main>
        <slot />
    </main>
</div>

<style>
    .dash { display: flex; height: 100vh; }
    nav {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem;
        width: 180px;
        background: #111;
        border-right: 1px solid #222;
    }
    .brand { font-weight: 700; color: #e05; margin-bottom: 0.5rem; }
    nav a  { font-size: 0.85rem; color: #aaa; text-decoration: none; padding: 0.3rem 0; }
    nav a:hover { color: #fff; }
    .badge {
        background: #e05;
        color: #fff;
        font-size: 0.7rem;
        padding: 0.1rem 0.4rem;
        border-radius: 10px;
        align-self: flex-start;
    }
    main { flex: 1; padding: 1.5rem; overflow-y: auto; }
</style>