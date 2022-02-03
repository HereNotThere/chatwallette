 precision highp float;
    
    uniform vec2 uViewport;
    uniform vec2 uDisplacement;
    

    attribute vec2 position;

    varying vec2 uv;
    varying vec2 wuv;
    

    void main() {
      uv = clamp(position, 0.0, 1.0);
      wuv = abs(
        vec2(
          (position.x * 0.5 + 0.5) * uViewport.x * 1.0, 
          (position.y * 0.5 + 0.5) * uViewport.y * 1.0
        )  + (uDisplacement.xy * 4.0)
      );
      gl_Position = vec4(position, 0.0, 1.0);
    }