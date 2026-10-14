<script>
    import ChannelSwitcher from '$lib/components/channel/ChannelSwitcher.svelte';
</script>

<div class="home">
    <ChannelSwitcher />
    <main>
        <h2>Select a channel to start watching.</h2>
    </main>
</div>

<style>
    .home { display: flex; height: 100vh; }
    main {
        flex: 1;
        display: grid;
        place-items: center;
        color: #444;
    }
</style>