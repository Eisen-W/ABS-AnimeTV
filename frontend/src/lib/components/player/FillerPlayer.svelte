<script>
    import { onDestroy } from 'svelte';

    // sequence: [{ path, duration_s }, ...]
    // backend serves these as static files from the filler/ directory
    export let sequence  = [];
    export let onDone    = () => {};

    let videoEl;
    let index = 0;

    function playNext() {
        if (index >= sequence.length) { onDone(); return; }
        const item = sequence[index++];
        // backend must serve filler files as static — path is relative to filler/
        videoEl.src = `/filler-static/${encodeURIComponent(item.path.split('/').pop())}`;
        videoEl.play().catch(() => {});
    }

    $: if (videoEl && sequence.length) { index = 0; playNext(); }

    onDestroy(() => { if (videoEl) videoEl.pause(); });
</script>

<video
    bind:this={videoEl}
    on:ended={playNext}
    playsinline
    style="width:100%;height:100%;object-fit:contain;background:#000;"
></video>