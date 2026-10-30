<script lang="ts">
	import '../lib/styles/app.css';
	import { page } from '$app/state';
	import Mic from '@lucide/svelte/icons/mic';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const tabs = [
		{ href: '/', label: 'Practice', icon: Mic },
		{ href: '/settings', label: 'Settings', icon: SettingsIcon }
	];

	const here = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<div class="shell">
	<main>{@render children()}</main>

	<nav aria-label="Main">
		{#each tabs as tab (tab.href)}
			<a href={tab.href} aria-current={here(tab.href) ? 'page' : undefined} class:active={here(tab.href)}>
				<tab.icon size={22} aria-hidden="true" />
				<span>{tab.label}</span>
			</a>
		{/each}
	</nav>
</div>

<style>
	.shell {
		max-width: 520px;
		margin: 0 auto;
		min-height: 100dvh;
		padding: env(safe-area-inset-top) 1.1rem calc(5.5rem + env(safe-area-inset-bottom));
	}
	main {
		padding-top: 1.25rem;
	}
	nav {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem calc(0.5rem + env(safe-area-inset-bottom));
		background: var(--paper);
		border-top: 1.5px solid var(--line);
	}
	nav a {
		flex: 1;
		max-width: 200px;
		min-height: var(--tap);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.1rem;
		border-radius: var(--radius-small);
		color: var(--muted);
		text-decoration: none;
		font-size: 0.78rem;
		font-weight: 500;
	}
	nav a.active {
		color: var(--ink);
		background: var(--gold-soft);
	}
</style>
