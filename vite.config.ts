
import { defineConfig, type Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

// Read package.json to get version
// Force reload for v0.10.2
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

/** Dev server only: saves matches posted by MatchRecorder (F9 with ?record) as replay tests. */
function saveReplays(): Plugin {
    const MAX_BYTES = 10_000_000;
    return {
        name: 'save-replays',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use('/__save-replay', (req, res) => {
                if (req.method !== 'POST') {
                    res.statusCode = 405;
                    res.end();
                    return;
                }
                let body = '';
                req.on('data', chunk => { body += chunk; });
                req.on('end', () => {
                    try {
                        if (body.length > MAX_BYTES) throw new Error('too large');
                        JSON.parse(body);
                    } catch {
                        res.statusCode = 400;
                        res.end();
                        return;
                    }
                    const file = `match-${Date.now()}.json`;
                    fs.writeFileSync(path.resolve(__dirname, 'tests/replays', file), body);
                    res.end(file);
                });
            });
        },
    };
}

export default defineConfig({
    base: './',
    define: {
        '__APP_VERSION__': JSON.stringify(packageJson.version)
    },
    plugins: [saveReplays()],
    server: {
        host: '0.0.0.0',
        port: 5175,
        strictPort: true
    }
});
