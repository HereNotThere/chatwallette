precision highp float;

uniform float uIndex;
uniform float uTime;
uniform vec2 uViewport;
uniform vec4 uColor;
uniform vec2 uDisplacement;
uniform float uIntensity;
uniform float uGlobalAlpha;
uniform float uPatternMix;
uniform float uNoiseIntensity;
uniform float uOffsetSpeed;


varying vec2 uv;
varying vec2 wuv;


float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 get_area(vec2 co, vec2 cell) {
  return vec2(floor(co / cell) + 0.0);
}

float get_grid_stencil(vec2 co, float st, float sz) {
  return floor((1.0 - step(sz, mod(co.x, st)))) * floor((1.0 - step(sz, mod(co.y, st))));
}

void main() {

  // pixel coordinates
  vec2 co = get_area(wuv, vec2(4.0));
  if (get_grid_stencil(co, 4.0, 1.0) < 1.0) {
    discard;
  }
  
  // area coordinates (context of pixel)
  vec2 area_1 = get_area(
    wuv, 
    vec2(
      256.0, 
      256.0 * (1.0 + uDisplacement.x * 0.1)
    )
  );
  vec2 area_2 = get_area(
    wuv, 
    uViewport.yy * 0.33
  );

  // random time/speed interval based on current area
  float t_span = (1.0 + rand(area_2) * 20.0);
  float t_floor = floor(uTime / t_span);
  float t_base = (t_floor + mod(uTime, t_span) * step(0.99, rand(area_2 * t_floor)));

  // time variables
  float t0 = (uOffsetSpeed * 10.0) * t_base;
  float t1 = floor(t_base);
  float t8 = floor(t0 * 8.0);

  // blocky pattern
  float pattern_1 = rand(area_1 + vec2(t1, 0.0)) 
    * step(0.2, rand(vec2(co.yx)));

  // line pattern
  float pattern_2 = step(0.9, 
    sin(
      t8 + 0.2 * 
        (mod(co.x, uViewport.x) + co.y * uViewport.x) 
        * rand(vec2(area_2.yx))) 
  );

  float first_layer = 1.0 - step(1.0, uIndex);
  float noise = rand(vec2(uTime, 1.0) * co);
  float pattern_noise = uNoiseIntensity * 0.2 * mix(first_layer, noise, 0.01) *  rand(vec2(t1, 1.0) * co);

  float opaque = mix(1.0, noise, 0.2) 
    * (
      step( 
        1.0 - uIntensity, 
        mix(pattern_1, pattern_2, uPatternMix)
      )
    );
  

  gl_FragColor = vec4( uColor.rgb, pattern_noise + opaque * uGlobalAlpha * uColor.a);
}