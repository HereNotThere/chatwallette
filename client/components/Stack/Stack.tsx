import styled, { css } from "styled-components";
import { Box } from "../Box";
import { BoxProps } from "../Box/Box";

export type StackProps = {
  row?: boolean;
  itemSpace?: boolean | "no" | "xs" | "sm" | "md" | "lg";
  spaceBetween?: boolean;
  overflowVisible?: boolean;
} & BoxProps;

export const Stack = styled(Box).attrs<StackProps>(({ row, grow, shrink }) => {
  return {
    grow: grow ?? !shrink,
    flexFlow: row ? "row" : "column",
  };
})<StackProps>`
  position: relative;
  overflow: ${({ overflowVisible }) => (overflowVisible ? "visible" : "hidden")};
  flex-flow: ${({ row }) => (row ? "row" : "column")};

  ${({ spaceBetween }) =>
    spaceBetween &&
    css`
      justify-content: space-between;
    `}
  ${({ row, itemSpace }) =>
    typeof itemSpace === "boolean"
      ? null
      : row
      ? css`
          > ${Box} + ${Box} {
            margin-left: var(--spacing-${itemSpace ?? "sm"});
          }
        `
      : css`
          > ${Box} + ${Box} {
            margin-top: var(--spacing-${itemSpace ?? "sm"});
          }
        `}
`;
