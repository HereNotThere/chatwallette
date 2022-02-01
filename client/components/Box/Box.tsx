import styled, { css } from "styled-components";
import { BackgroundAttr, ColorAttr } from "../Theme/Theme";

export type BoxProps = {
  border?: boolean | "backdrop";
  borderColor?: ColorAttr;
  space?: boolean | "xs" | "sm" | "md" | "lg";
  padding?: boolean | "no" | "xs" | "sm" | "md" | "lg";
  horizontalPadding?: boolean | "no" | "xs" | "sm" | "md" | "lg";
  fullscreen?: boolean;
  grow?: boolean | number;
  shrink?: boolean | number;
  basis?: number | string;
  alignItems?: "start" | "end" | "center";
  justifyContent?: "start" | "end" | "center";
  centerContent?: boolean;
  background?: BackgroundAttr;
  aspect?: number;
  /** color is a HTML attr */
  textColor?: ColorAttr;
};

const colorToCssVar = (c: string) =>
  `var(--color-${c?.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase() ?? "default"})`;

export const Box = styled.div.attrs<BoxProps>(({ space, padding, grow }) => {
  return {
    space: space === true ? "sm" : space,
    padding: padding === true ? "sm" : padding,
    grow: grow === true ? 1 : grow,
  };
})<BoxProps>`
  display: flex;
  flex-flow: column;
  ${({ centerContent }) =>
    centerContent &&
    css`
      justify-content: center;
      align-items: center;
    `}
  ${({ border, borderColor }) =>
    (border === true || borderColor) &&
    `border: var(--border-size) solid ${
      !borderColor ? `var(--drag-color, var(--bg-border))` : `${colorToCssVar(borderColor)}`
    };`}
  ${({ border }) => border === "backdrop" && ` box-shadow: 4px 4px 0 0 var(--bg-shadow); `}
  ${({ padding }) => typeof padding === "string" && `padding: var(--spacing-${padding});`}
  ${({ horizontalPadding }) =>
    typeof horizontalPadding === "string" &&
    css`
      padding-left: var(--spacing-${horizontalPadding});
      padding-right: var(--spacing-${horizontalPadding});
    `}
  ${({ fullscreen }) =>
    fullscreen &&
    css`
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    `} 
  ${({ grow }) => grow && `flex-grow: ${grow === true ? 1 : grow};`} 
  ${({ shrink }) => shrink && `flex-shrink: ${shrink === true ? 1 : shrink};`} 
  ${({ basis }) => basis && `flex-basis: ${typeof basis === "number" ? `${basis}px` : basis};`} 
  ${({ alignItems }) => alignItems && `align-items: ${alignItems};`} 
  ${({ justifyContent }) => justifyContent && `justify-content: ${justifyContent};`} 
  ${({ aspect }) => aspect && `aspect-ratio: ${aspect};`} 
  ${({ background }) =>
    background === "body"
      ? css`
          background: var(--bg-body);
          color: var(--fg);
        `
      : background === "panel"
      ? css`
          background: var(--bg-panel);
          color: var(--fg);
        `
      : background === "panel2"
      ? css`
          background: var(--bg-panel2);
          color: var(--fg);
        `
      : background === "input"
      ? css`
          background: var(--bg-input);
          color: var(--fg-muted);
        `
      : background === "button"
      ? css`
          background: var(--bg-button);
          color: var(--fg);
        `
      : null}  

    ${({ textColor }) =>
    textColor &&
    css`
      --color: ${colorToCssVar(textColor)};
      color: var(--color);
      * {
        color: var(--color);
      }
    `}
`;
