<script lang="ts">
	import UpdatePanel from '../../lib/components/UpdatePanel.svelte';
</script>

<svelte:head><title>Settings - Warbler</title></svelte:head>

<h1>Settings</h1>

<UpdatePanel />

<section class="card">
	<h2>Tools</h2>
	<p class="muted">Used while Warbler is being set up.</p>
	<a class="button" href="/diagnostics">Diagnostics</a>
</section>

<p class="muted small">Goals, session limits and the rest arrive in later phases.</p>
