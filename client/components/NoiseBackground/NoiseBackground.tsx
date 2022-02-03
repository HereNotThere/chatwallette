import { RefObject, useEffect, useRef, useState } from "react";
import buildRegl from "regl";
import styled from "styled-components";
import fragmentShaderCode from "./noise.frag";
import vertexShaderCode from "./noise.vert";

const colors = [
  [0.001, 0.921, 1.001, 0.7],
  [0.812, 0.278, 1.001, 0.4],
  [0.996, 0.898, 0.401, 0.2],
];

const uniforms = {
  uIntensity: 0.06, //0.01,
  uGlobalAlpha: 0.3,
  uPatternMix: 0.2,
  uNoiseIntensity: 0.23,
  uOffsetSpeed: 0.5,
  uViewport: [0, 0],
  uTime: 0,
};

if (typeof window !== "undefined") {
  window.uniforms = uniforms;
}

const layers = [
  { uDisplacement: [+0, +0], uColor: colors[0] },
  { uDisplacement: [-2, -1], uColor: colors[1] },
  { uDisplacement: [+1, +1], uColor: colors[2] },
];

export const NoiseBackground = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  useShader(ref);

  const [dims, setDims] = useState([window.innerWidth, window.innerHeight]);

  const viewportRef = useRef(dims);

  useEffect(() => {
    const onResize = () => {
      setDims([window.innerWidth, window.innerHeight]);
      viewportRef.current = [window.innerWidth, window.innerHeight];
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <StyledBackground ref={ref} width={dims[0]} height={dims[1]} />;
};

const StyledBackground = styled.canvas`
  position: absolute;
  pointer-events: none;

  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
`;

const useShader = (ref: RefObject<HTMLCanvasElement>) => {
  useEffect(() => {
    if (!ref.current) {
      return;
    }
    const regl = buildRegl(ref.current);
    const draw = regl({
      depth: {
        enable: false,
      },
      blend: {
        enable: true,
        func: {
          srcRGB: "src alpha",
          srcAlpha: "src alpha",
          dstRGB: "one minus src alpha",
          dstAlpha: "one minus src alpha",
        },
      },
      frag: fragmentShaderCode,
      vert: vertexShaderCode,
      uniforms: {
        uIndex: regl.prop("uIndex"),
        uViewport: regl.prop("uViewport"),
        uTime: regl.prop("uTime"),
        uDisplacement: regl.prop("uDisplacement"),
        uColor: regl.prop("uColor"),
        uIntensity: regl.prop("uIntensity"),
        uGlobalAlpha: regl.prop("uGlobalAlpha"),
        uPatternMix: regl.prop("uPatternMix"),
        uNoiseIntensity: regl.prop("uNoiseIntensity"),
        uOffsetSpeed: regl.prop("uOffsetSpeed"),
      },
      attributes: {
        // a big triangles
        position: [
          [-1, -1],
          [-1, 3],
          [3, -1],
        ],
      },
      count: 3,
    });

    regl.frame(context => {
      const { viewportWidth, viewportHeight } = context;
      uniforms.uViewport[0] = viewportWidth; // / context.pixelRatio;
      uniforms.uViewport[1] = viewportHeight; // / context.pixelRatio;
      uniforms.uTime = context.time + 1000;

      layers.forEach((layer, index) => {
        draw({
          ...uniforms,
          ...layer,
          uIndex: index,
        });
      });
    });

    return () => {
      console.log("context destroyed");
      regl.destroy();
    };
  }, [ref]);
};
