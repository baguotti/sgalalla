const fs = require('fs');
const path = require('path');
const texturePacker = require('free-tex-packer-core');

const INPUT_DIR = "/Users/riccardofusetti/Documents/Coding/assets/fioi_sprites/Sga/Single Sprites/256x256";
const OUTPUT_DIR = "/Users/riccardofusetti/Documents/Coding/sgalalla/public/assets"; // Will generate sga.json/png here

const images = [];

fs.readdirSync(INPUT_DIR).forEach(file => {
    if (path.extname(file).toLowerCase() === '.png' && !file.startsWith('00_')) {
        images.push({
            path: file,
            contents: fs.readFileSync(path.join(INPUT_DIR, file))
        });
    }
});

console.log(`Found ${images.length} images.`);

const options = {
    textureName: "sga",
    width: 2048,
    height: 2048,
    quality: 100,
    scale: 1,
    prefix: "",
    padding: 3,
    allowRotation: false,
    detectIdentical: true,
    allowTrim: true,
    exporter: "Phaser3",
    removeFileExtension: true,
    prependFolderName: false
};

texturePacker(images, options, (files, error) => {
    if (error) {
        console.error('Packaging failed', error);
    } else {
        files.forEach(item => {
            const outPath = path.join(OUTPUT_DIR, item.name);
            fs.writeFileSync(outPath, item.buffer);
            console.log(`Saved ${outPath}`);
        });
        console.log("Sga atlas generated successfully!");
    }
});
