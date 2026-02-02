import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
    plugins: [tsconfigPaths()],
    server: {
        host: '0.0.0.0' // Explicitly bind to all interfaces
    },
    resolve: {
        alias: {
            '@colyseus/schema': path.resolve(process.cwd(), 'node_modules/@colyseus/schema')
        }
    }
});
