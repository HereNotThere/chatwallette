import React, { RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { Box } from "../Box";

const CELL_SIZE = 70;
const UPDATE_INTERVAL_MS = 750;
const Logos = ["/a1.png", "/a2.png", "/a3.png", "/a4.png", "/a5.png", "/a6.png", "/a7.png", "/a8.png", "/a9.png"];

export const LogoBackground = React.memo(() => {
  const [logos, setLogos] = useState<number[]>([]);
  const randomizedLogos = useMemo(() => new Array(logos.length).fill(undefined).map((_, i) => i), [logos.length]);
  const [gridDims, setGridDims] = useState<[number, number]>([0, 0]);

  const pattern = useMemo(() => {
    // available logos
    const list = Array(Logos.length)
      .fill(0)
      .map((_, i) => i);

    return (
      // repeat enough times to ensure the pattern is longer than a row on screen
      Array(10)
        .fill(0)
        // a sequence of randomised pattern lists [[0,1,2][1,2,0][2,1,0]...] to
        // limit repetitions
        .map(() => list.slice().sort(() => Math.random() - 0.5))
        // flatten the sequence
        .reduce((result, current) => [...result, ...current], [])
    );
  }, []);

  useEffect(() => {
    if ((gridDims[0] > 0 && gridDims[1] > 0) === false) {
      return;
    }

    const width = Math.floor(gridDims[0] / CELL_SIZE);
    const height = Math.floor(gridDims[1] / CELL_SIZE);

    const logos = Array(width * height)
      .fill(undefined)
      .map((_, i) => pattern[i % pattern.length]);

    // apply logos
    setLogos(logos);
    // remove selection
    setSelected([-1, -1]);
  }, [gridDims, pattern]);

  const updateDims = useCallback(() => {
    setGridDims([window.innerWidth, window.innerHeight]);
  }, []);

  useLayoutEffect(() => {
    updateDims();
    window.addEventListener("resize", updateDims);
    return () => {
      window.removeEventListener("resize", updateDims);
    };
  }, [updateDims]);

  const [selected, setSelected] = useState<number[]>([-1, -1]);
  const [showing, setShowing] = useState<number[]>([]);

  const hiddenListRef = useRef<boolean[]>([]);

  useLayoutEffect(() => {
    const selectMatchingPair = () => {
      // choose random logo
      const logo = Math.floor(Math.random() * Logos.length);

      const selection: number[] = [];
      // randomize list
      randomizedLogos.sort(() => Math.random() - 0.5);
      // iterate list until reaches end or enough items (2) are selected
      for (let j = 0; j < randomizedLogos.length && selection.length < 2; j++) {
        const index = randomizedLogos[j];
        // should match coin, not figure in hidden list or previously selected
        if (logos[index] === logo && !hiddenListRef.current[index] && selection.indexOf(index) === -1) {
          selection.push(index);
        }
      }

      setShowing(s => [...s, ...selection]);

      // add new selection but restrict to N pairs
      setSelected(s => s.concat(selection).slice(6 * -2));
    };

    let raf: number;
    // only update when browser tab is active
    const selectMatchingPairDebounce = () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
      raf = requestAnimationFrame(selectMatchingPair);
    };

    const interval = setInterval(selectMatchingPairDebounce, UPDATE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [logos, randomizedLogos]);

  return (
    <StyledBackground>
      {logos.map((logoIndex, index) => {
        return (
          <Logo
            key={index}
            index={index}
            logoIndex={logoIndex}
            dims={gridDims}
            showing={true || showing.indexOf(index) > -1}
            selected={selected}
            hiddenListRef={hiddenListRef}
          />
        );
      })}
    </StyledBackground>
  );
});

LogoBackground.displayName = "LogoBackground";

const StyledBackground = styled.div`
  position: absolute;
  pointer-events: none;

  top: 0;
  left: 0;
  width: 100%;
  height: 100%;

  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
  justify-content: space-evenly;
  align-content: space-around;
`;

type LogoProps = {
  index: number;
  logoIndex: number;
  selected: number[];
  showing?: boolean;
  hiddenListRef?: RefObject<boolean[]>;
  dims: [number, number];
};

const Logo = React.memo((props: LogoProps) => {
  const { dims, index, showing, hiddenListRef } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(true);

  useLayoutEffect(() => {
    const timeout = setTimeout(() => {
      const bounds = ref.current?.getBoundingClientRect();
      if (bounds) {
        // if the logo is placed in the central area of screen it should be
        // removed in order to make the logo / intro readable
        const dx = Math.abs(dims[0] / 2 - (bounds.left + CELL_SIZE / 2));
        const dy = Math.abs(dims[1] / 2 - (bounds.top + CELL_SIZE / 2));
        const hiddenCentral = dx < 200 && dy < 110;
        const hiddenBottom = dx < 200 && Math.abs(dims[1] - (bounds.top + CELL_SIZE / 2)) < 50;

        setHidden(hiddenCentral || hiddenBottom);
      }
    }, 0);
    return () => {
      clearTimeout(timeout);
    };
  }, [dims]);

  useEffect(() => {
    const hiddenList = hiddenListRef?.current;
    if (hiddenList) {
      hiddenList[index] = hidden;
    }
  }, [hidden, index, hiddenListRef]);
  const intensity = (Math.ceil(props.selected.indexOf(index) / 2) * 2) / props.selected.length;
  return (
    <StyledLogo
      {...props}
      ref={ref}
      intensity={intensity}
      status={
        hidden || (!showing && true)
          ? LogoStatus.Hidden
          : props.selected.indexOf(index) > -1
          ? LogoStatus.Selected
          : LogoStatus.Idle
      }
    />
  );
});

Logo.displayName = "BackgroundCoin";

enum LogoStatus {
  Idle = "Idle",
  Selected = "Selected",
  Hidden = "Hidden",
}

const StyledLogo = styled(Box)<{
  logoIndex: number;
  intensity: number;
  status: LogoStatus;
}>`
  width: ${CELL_SIZE}px;
  height: ${CELL_SIZE}px;

  background: url(${({ logoIndex }) => Logos[logoIndex]}) no-repeat center;
  background-size: 60px;

  --faded: 0.2;

  ${({ status, intensity }) =>
    status === LogoStatus.Hidden
      ? `
          visibility: hidden;
          opacity: var(--faded);
        `
      : `
          opacity: ${status === LogoStatus.Idle ? `var(--faded)` : `calc(var(--faded) + ${intensity})`};
        `}
  transition: opacity 750ms ease-in-out;
`;
