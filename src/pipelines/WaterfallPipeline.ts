import Phaser from 'phaser';

const fragShader = `
#define SHADER_NAME WATERFALL_FS

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform float uTime;
varying vec2 outTexCoord;

void main(void) {
    vec2 uv = outTexCoord;
    
    // time in seconds
    float t = uTime * 0.001;
    
    // Create a distortion factor that flows downwards
    // We add time to y so the wave moves down 
    float distortionX = sin((uv.y - t * 0.5) * 50.0) * 0.0015;
    
    // Secondary higher frequency wave
    distortionX += sin((uv.y - t * 0.8) * 120.0) * 0.0005;
    
    // Horizontal distortion slowly moving
    float distortionY = cos((uv.x + t * 0.2) * 30.0) * 0.001;
    
    uv.x += distortionX;
    uv.y += distortionY;
    
    vec4 color = texture2D(uMainSampler, uv);
    gl_FragColor = color;
}
`;

export default class WaterfallPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    constructor(game: Phaser.Game) {
        super({
            game,
            name: 'WaterfallPipeline',
            fragShader
        });
    }

    onPreRender(): void {
        this.set1f('uTime', this.game.loop.time);
    }
}
