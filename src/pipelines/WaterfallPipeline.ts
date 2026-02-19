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
    
    vec4 color = texture2D(uMainSampler, uv);
    
    // Only apply effect where the texture is not fully transparent
    if (color.a > 0.05) {    
        // We want the flow to be on the opposite axis (horizontal) and WAY more subtle
        // Slowing down 't' and swapping x/y influence for horizontal flow
        float highlight1 = sin(uv.y * 200.0 + uv.x * 10.0 + t * 15.0);
        float highlight2 = sin(uv.y * 100.0 + uv.x * 5.0 + t * 25.0 + 2.0);
        
        // Combine into a smooth flow pattern
        float flow = (highlight1 + highlight2) * 0.5;
        
        // Map flow from [-1, 1] to [0, 1]
        flow = flow * 0.5 + 0.5;
        
        // Very subtle specular reflection (reduced by 10x from 0.3 to 0.03)
        float specular = smoothstep(0.6, 1.0, flow) * 0.03;
        
        // Add sweeping shining highlights
        color.rgb += specular * vec3(0.8, 0.9, 1.0) * color.a;
        
        // Extremely subtle darkening in troughs (reduced by 10x from 0.05 to 0.005)
        color.rgb -= (1.0 - flow) * 0.005 * color.a;
    }
    
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
