<script>
    import { page } from '$app/stores';
    import ScheduleGrid from '$lib/components/dashboard/ScheduleGrid.svelte';

    $: channelId = $page.params.channel_id;
</script>

<div class="schedule-view">
    <h1>Schedule</h1>
    <ScheduleGrid {channelId} />
</div>

<style>
    .schedule-view { display: flex; flex-direction: column; gap: 1rem; }
    h1 { font-size: 1.4rem; }
</style>