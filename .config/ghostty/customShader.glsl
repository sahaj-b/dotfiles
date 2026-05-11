void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec4 terminalColor = texture(iChannel0, uv);
    // a 100x100 box in the bottom-left filled with the uniform color
    if (fragCoord.x < 100.0 && fragCoord.y < 100.0) {
        fragColor = iCurrentCursorColor;
    } else {
        fragColor = terminalColor;
    }
}
