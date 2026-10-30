<script lang="ts">
	interface Props {
		/** 0 to 1 position of the level bar. */
		level: number;
		/** 0 to 1 position of the held peak marker. */
		peak: number;
		/** Level in dBFS, for screen readers. */
		db: number;
		clipping?: boolean;
	}
	let { level, peak, db, clipping = false }: Props = $props();
</script>

<div
	class="meter"
	role="meter"
	aria-label="Volume"
	aria-valuemin={-60}
	aria-valuemax={0}
	aria-valuenow={Math.round(db)}
	aria-valuetext={`${Math.round(db)} decibels`}
>
	<div class="fill" class:hot={clipping} style:width={`${Math.round(level * 100)}%`}></div>
	<div class="peak" style:left={`${Math.round(peak * 100)}%`}></div>
</div>

<style>
	.meter {
		position: relative;
		height: 28px;
		border-radius: 14px;
		background: var(--sand);
		border: 1.5px solid var(--line);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		background: var(--gold);
		border-radius: 14px 0 0 14px;
		transition: width 60ms linear;
	}
	/* Too loud is shown with a deeper tone, not a warning colour. */
	.fill.hot {
		background: var(--clay);
	}
	.peak {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 3px;
		margin-left: -2px;
		background: var(--ink);
		opacity: 0.7;
	}
</style>
