import styled, { css } from "styled-components";
import { Box, BoxProps } from "../Box/Box";

type Props = {
  itemSpace?: "no" | "xs" | "sm" | "md" | "lg";
  itemSize?: string;
  scrollable?: boolean;
} & BoxProps;

export const Grid = styled(Box).attrs((props: Props) => ({
  itemSpace: props.itemSpace,
  itemSize: props.itemSize ?? "33%",
  scrollable: props.scrollable,
}))`
  display: grid;
  ${({ scrollable }) =>
    scrollable &&
    css`
      overflow: scroll;
    `}
  ${({ itemSpace, itemSize }) =>
    css`
      grid-gap: var(--spacing-${itemSpace ?? "sm"});
      grid-template-columns: repeat(auto-fill, minmax(${itemSize}, 1fr));
    `}

  grid-auto-rows: min-content;
`;
