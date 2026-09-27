import { mount } from 'svelte';
import '@fontsource-variable/manrope';
import './style.css';
import App from './App.svelte';
mount(App, { target: document.getElementById('app')! });
document.getElementById('startup')?.remove();
