#version 300 es
precision highp float;

in vec2 vTextureCoord;
in vec2 vLightmapCoord;
in vec2 vTileColorCoord;
in float vLightWeighting;
in vec2 vCell;
in float vUp;
out vec4 fragColor;

uniform sampler2D uDiffuse;
uniform sampler2D uLightmap;
uniform sampler2D uTileColor;
uniform bool uLightMapUse;
uniform bool uPosterize;
uniform bool uGammaCorrection;

uniform bool  uFogUse;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3  uFogColor;

uniform vec3  uLightAmbient;
uniform vec3  uLightDiffuse;
uniform float uLightOpacity;
uniform vec3  uLightDirection;
uniform vec3 uLightEnv;

// Display helpers (Renderer/VisualOptions.js): flat grey ground, and the cell grid with the cells nobody can walk on
// tinted as RCX's dead cells (uCells: one texel per cell, red 1 = walkable).
uniform bool  uFlat;
uniform float uFlatGrey;
uniform bool  uGrid;
uniform sampler2D uCells;
uniform vec2  uCellsSize;
uniform float uGridLine;
uniform vec4  uDeadCell;

vec3 posterize(vec3 c) {
    c *= 255.0;
    c = floor(c / 16.0) * 16.0;
    c /= 255.0;
    return c;
}

void main(void) {
    vec4 textureSample = texture(uDiffuse, vTextureCoord.st);
    if (textureSample.a < 0.1)
        discard;

    if (uFlat) {
        textureSample = vec4(vec3(uFlatGrey), 1.0);
    }

    if (vTileColorCoord.st != vec2(0.0,0.0)) {
        textureSample    *= texture( uTileColor, vTileColorCoord.st);
    }

    vec3 color = (vLightWeighting * uLightDiffuse + uLightAmbient);
    textureSample.rgb *= clamp(color, 0.0, 1.0);
    textureSample.rgb *= clamp(uLightEnv, 0.0, 1.0);

    if (uLightMapUse) {
        vec4 lightmap = texture( uLightmap, vLightmapCoord.st);
        if(uPosterize) {
            lightmap.rgb = posterize(lightmap.rgb);
        } else if(uGammaCorrection){
            lightmap.rgb = pow(lightmap.rgb, vec3(1.1));
        }
        textureSample.rgb *= lightmap.a;
        textureSample.rgb += clamp(lightmap.rgb, 0.0, 1.0);
    }

    // cell grid on the ground's top surfaces (walls stay as they are)
    if (uGrid && vUp > 0.5) {
        vec2 cell = floor(vCell);
        float walkable = texture(uCells, (cell + 0.5) / uCellsSize).r;
        textureSample.rgb = mix(textureSample.rgb, uDeadCell.rgb, uDeadCell.a * (1.0 - step(0.5, walkable)));
        vec2 f = fract(vCell);
        vec2 w = fwidth(vCell) * 1.2;
        vec2 line = 1.0 - smoothstep(vec2(0.0), w, min(f, 1.0 - f));
        textureSample.rgb *= mix(1.0, uGridLine, max(line.x, line.y));
    }

    fragColor = textureSample;

    if (uFogUse) {
        float depth     = gl_FragCoord.z / gl_FragCoord.w;
        float fogFactor = smoothstep( uFogNear, uFogFar, depth );
        fragColor    = mix( fragColor, vec4(uFogColor, fragColor.w), fogFactor );
    }

}