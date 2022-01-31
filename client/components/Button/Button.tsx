import React, { forwardRef } from "react";
import styled from "styled-components";
import { Box } from "../Box";
import { BoxProps } from "../Box/Box";

type ButtonProps = {
  icon?: JSX.Element;
  square?: boolean;
} & BoxProps &
  React.ComponentPropsWithoutRef<"button">;

const StyledButton = styled(Box).attrs((props: ButtonProps) => ({
  centerContent: true,
  padding: props.padding ?? "xs",
  horizontalPadding: props.horizontalPadding ?? props.padding ?? "xs",
  border: props.border ?? "backdrop",
  background: props.background ?? "button",
  textColor: props.textColor ?? "white",
  aspect: props.square ? 1 : props.aspect,
}))<ButtonProps>`
  cursor: pointer;
  appearance: none;
  ${({ background }) => !background && `background: inherit;`}
  ${({ border, borderColor }) => border !== true && !borderColor && `border: none;`}
  ${({ padding }) => !padding && `padding: 0;`}
  flex-flow: row;
  > * + * {
    /* space between icon + button */
    margin-left: calc(var(--bl) / 2);
  }
  &:hover {
    box-shadow: none;
    ${({ border }) => border === "backdrop" && `transform: translate(2px, 2px);`}
  }
`;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  return (
    <StyledButton as="button" {...props} ref={ref}>
      {props.icon}
      {props.children && <Box>{props.children}</Box>}
    </StyledButton>
  );
});
