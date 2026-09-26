/**
 * Packs a character's single 256x256 sprites into the atlas the game loads:
 * public/assets/<character>/<character>.png and .json (Phaser 3 format).
 *
 *   node scripts/pack-character.cjs <character> <folder of single sprites>
 *   node scripts/pack-character.cjs sgu "../assets/fioi_sprites/Sgu/Single Sprites/256x256"
 *
 * Files starting with 00_ (icons) are left out. Frames are trimmed, never
 * rotated, and kept 4 pixels apart: the lighting's rim shader reads up to 4
 * pixels past a frame's edge and must only ever find empty space there.
 */
const fs = require('fs');
const path = require('path');
const texturePacker = require('free-tex-packer-core');

const [character, inputDir] = process.argv.slice(2);
if (!character || !inputDir) {
    console.error('Usage: node scripts/pack-character.cjs <character> <folder of single sprites>');
    process.exit(1);
}

const outputDir = path.join(__dirname, '..', 'public', 'assets', character);
fs.mkdirSync(outputDir, { recursive: true });

const images = fs.readdirSync(inputDir)
    .filter(file => path.extname(file).toLowerCase() === '.png' && !file.startsWith('00_'))
    .sort()
    .map(file => ({ path: file, contents: fs.readFileSync(path.join(inputDir, file)) }));
console.log(`Packing ${images.length} sprites for ${character}`);

const options = {
    textureName: character,
    width: 2048,
    height: 2048,
    quality: 100,
    scale: 1,
    padding: 4,
    allowRotation: false,
    detectIdentical: false,
    allowTrim: true,
    exporter: 'Phaser3',
    removeFileExtension: true,
    prependFolderName: false,
};

texturePacker(images, options, (files, error) => {
    if (error) {
        console.error('Packing failed:', error);
        process.exit(1);
    }
    for (const file of files) {
        const outPath = path.join(outputDir, file.name);
        fs.writeFileSync(outPath, file.buffer);
        console.log(`Saved ${outPath}`);
    }
});
