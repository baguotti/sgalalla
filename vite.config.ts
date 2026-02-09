
import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// Read package.json to get version
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
    define: {
        '__APP_VERSION__': JSON.stringify(packageJson.version)
    },
    server: {
        host: '0.0.0.0'
    }
});
