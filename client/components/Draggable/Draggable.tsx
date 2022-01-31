import { motion } from "framer-motion";
import React, { RefObject, useCallback, useMemo, useRef, useState } from "react";
import styled, { css } from "styled-components";

const dragTransition = {
  power: 0,
  min: 0,
  max: 200,
  timeConstant: 250,
};

type DraggableProps = {
  boxRef: RefObject<HTMLDivElement>;
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  maxHeight?: string;
  left: string;
  top: string;
  onStartDrag?: (index: number) => void;
  lastDraggedPanelIndex: number;
};

let INDEX = 0;

export const Draggable = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
  } & DraggableProps
>((props, ref) => {
  const { left, top, width, height, minWidth, minHeight, maxWidth, maxHeight, onStartDrag } = props;
  const [isDragging, setDragging] = useState(false);
  const onDragStart = useCallback(() => {
    setDragging(true);
    if (onStartDrag) {
      onStartDrag(indexRef.current);
    }
  }, [onStartDrag]);

  const onClick = useCallback(() => {
    if (onStartDrag) {
      onStartDrag(indexRef.current);
    }
  }, [onStartDrag]);

  const onDragEnd = useCallback(() => {
    setDragging(false);
  }, []);

  // keep track of last dragged panel in order to place it on top of the other ones
  const indexRef = useRef(INDEX++);
  const isTopmost = props.lastDraggedPanelIndex === indexRef.current;

  const style = useMemo(() => {
    return {
      left,
      top,
      width: width ?? height ?? "25vw",
      height: height ?? width ?? "25vw",
      minWidth: minWidth ?? minHeight ?? "100px",
      minHeight: minHeight ?? minWidth ?? "100px",
      maxWidth: maxWidth ?? maxHeight ?? "80vw",
      maxHeight: maxHeight ?? maxWidth ?? "80vh",
    };
  }, [height, left, maxHeight, maxWidth, minHeight, minWidth, top, width]);
  return (
    <MotionDraggable
      ref={ref}
      drag
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      dragConstraints={props.boxRef}
      dragElastic={0.1}
      dragTransition={dragTransition}
      style={style}
      isDragging={isDragging}
      isTopMost={isTopmost}
    >
      {props.children}
    </MotionDraggable>
  );
});

const StyledDraggable = styled.div<{ isDragging: boolean; isTopMost: boolean }>`
  position: absolute;
  cursor: grab;

  ${({ isTopMost: topMost }) =>
    topMost &&
    css`
      z-index: 10;
    `}

  ${({ isDragging }) =>
    isDragging &&
    css`
      cursor: grabbing;
      > * {
        --drag-color: var(--fg-primary);
      }
      /* unset border color for sub-children */
      > * > * {
        --drag-color: initial;
      }
    `}
  > * {
    width: 100%;
    height: 100%;
  }
`;

const MotionDraggable = motion(StyledDraggable);

Draggable.displayName = "Draggable";
export default Draggable;
