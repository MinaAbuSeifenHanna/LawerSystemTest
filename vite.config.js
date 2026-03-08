import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                login: resolve(__dirname, 'pages/login.html'),
                dashboard: resolve(__dirname, 'pages/dashboard.html'),
                clients: resolve(__dirname, 'pages/clients.html'),
                cases: resolve(__dirname, 'pages/cases.html'),
            }
        }
    }
});
