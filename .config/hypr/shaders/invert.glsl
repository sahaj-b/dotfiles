#version 300 es
precision mediump float;

in vec2 v_texcoord;
out vec4 fragColor;

uniform sampler2D tex;

void main() {
    vec4 pixColor = texture(tex, v_texcoord);
    fragColor = vec4(1.0 - pixColor.r, 1.0 - pixColor.g, 1.0 - pixColor.b, pixColor.a);
}
