const fs = require('fs');
const path = require('path');
const texturePacker = require('free-tex-packer-core');

const INPUT_DIR = "/Users/riccardofusetti/Documents/Coding/assets/fioi_sprites/P/Single Sprites/256x256";
const OUTPUT_DIR = "/Users/riccardofusetti/Documents/Coding/sgalalla/public/assets/pe";

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
    textureName: "pe",
    width: 2048,
    height: 2048,
    quality: 100,
    scale: 1,
    padding: 3,
    allowRotation: false,
    detectIdentical: false,
    allowTrim: true,
    exporter: "Phaser3",    // Array format: { textures: [ { frames: [...] } ] }
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

    console.log("Pe atlas generated successfully!");
});
