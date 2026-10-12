<script>
    import { onMount, onDestroy } from 'svelte';
    import Hls from 'hls.js';

    export let src    = '';
    export let offset = 0;         // seconds to seek to on load
    export let muted  = false;

    let videoEl;
    let hls;

    function destroy() {
        if (hls) { hls.destroy(); hls = null; }
    }

    function load(url, seekTo) {
        destroy();

        if (!url || !videoEl) return;

        if (Hls.isSupported()) {
            hls = new Hls({ startPosition: seekTo });
            hls.loadSource(url);
            hls.attachMedia(videoEl);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoEl.currentTime = seekTo;
                videoEl.play().catch(() => {});
            });
            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) console.error('[HLSPlayer] fatal error:', data);
            });
        } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari native HLS
            videoEl.src = url;
            videoEl.addEventListener('loadedmetadata', () => {
                videoEl.currentTime = seekTo;
                videoEl.play().catch(() => {});
            }, { once: true });
        }
    }

    // reload whenever src or offset changes
    $: if (videoEl && src) load(src, offset);

    onMount(() => { if (src) load(src, offset); });
    onDestroy(destroy);
</script>

<video
    bind:this={videoEl}
    {muted}
    controls={false}
    playsinline
    style="width:100%;height:100%;object-fit:contain;background:#000;"
></video>