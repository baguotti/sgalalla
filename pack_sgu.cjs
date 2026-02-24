const fs = require('fs');
const path = require('path');
const texturePacker = require('free-tex-packer-core');

const INPUT_DIR = "/Users/riccardofusetti/Documents/Coding/assets/fioi_sprites/Sgu/Single Sprites/256x256";
const OUTPUT_DIR = "/Users/riccardofusetti/Documents/Coding/sgalalla/public/assets/sgu";

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Collect images, excluding icon files (00_*)
const files = fs.readdirSync(INPUT_DIR)
    .filter(f => path.extname(f).toLowerCase() === '.png' && !f.startsWith('00_'))
    .sort();

console.log(`Found ${files.length} images`);

const images = files.map(file => ({
    path: file,
    contents: fs.readFileSync(path.join(INPUT_DIR, file))
}));

const options = {
    textureName: "sgu",
    width: 2048,
    height: 2048,
    quality: 100,
    scale: 1,
    padding: 3,
    allowRotation: false,
    detectIdentical: false,
    allowTrim: true,
    exporter: "JsonHash",   // Standard Phaser hash format: { "frames": { "name": {...} } }
    removeFileExtension: true,
    prependFolderName: false
};

texturePacker(images, options, (outputFiles, error) => {
    if (error) {
        console.error('Packaging failed:', error);
        process.exit(1);
    }

    outputFiles.forEach(item => {
        const outPath = path.join(OUTPUT_DIR, item.name);
        fs.writeFileSync(outPath, item.buffer);
        console.log(`Saved ${outPath}`);
    });

    // Verify: read back JSON and list idle frame names
    const jsonPath = path.join(OUTPUT_DIR, 'sgu.json');
    const atlas = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // JsonHash format: { "frames": { "name": { "frame": {...} } }, "meta": {...} }
    const frameNames = Object.keys(atlas.frames);
    console.log(`\nAtlas contains ${frameNames.length} frames total`);

    const idleFrames = frameNames.filter(n => n.startsWith('sgu_idle_')).sort();
    console.log(`Idle frames (${idleFrames.length}):`);
    idleFrames.forEach(name => {
        const f = atlas.frames[name];
        console.log(`  ${name} → (${f.frame.x}, ${f.frame.y}, ${f.frame.w}x${f.frame.h})`);
    });

    const ghostFrames = frameNames.filter(n => n.includes('ghost')).sort();
    console.log(`\nGhost frames (${ghostFrames.length}):`);
    ghostFrames.forEach(name => {
        const f = atlas.frames[name];
        console.log(`  ${name} → (${f.frame.x}, ${f.frame.y}, ${f.frame.w}x${f.frame.h})`);
    });

    console.log(`\nJSON format: ${atlas.textures ? 'textures[]' : 'frames{}'}`);
    console.log("Done!");
});
