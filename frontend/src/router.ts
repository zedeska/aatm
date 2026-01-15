import { createRouter } from 'sv-router';
import Home from './routes/Home.svelte';
import About from './routes/About.svelte';
import Settings from './routes/Settings.svelte';
import Process from './routes/Process.svelte';

export const { p, navigate, isActive, route } = createRouter({
	'/': Home,
    '/about': About,
    '/settings': Settings,
    '/process': Process
});