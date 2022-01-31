import styled, { css } from "styled-components";
import { ColorAttr } from "../Theme/Theme";

type TextProps = {
  textColor?: ColorAttr;
  bold?: boolean;
  fontSize?: string;
  centerText?: boolean;
};

const BaseText = styled.span<TextProps>`
  ${({ textColor }) =>
    textColor &&
    css`
      color: var(--color-${textColor.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()});
    `}
  ${({ bold }) =>
    bold &&
    css`
      font-weight: bold;
    `}
  ${({ fontSize }) =>
    fontSize &&
    css`
      font-size: ${fontSize};
    `}
  ${({ centerText }) =>
    centerText &&
    css`
      text-align: center;
    `}
`;

export const SpanText = styled(BaseText).attrs(() => ({ as: "span" }))``;
export const HeaderLarge = styled(BaseText).attrs(() => ({ as: "h1" }))``;
export const Header = styled(BaseText).attrs(() => ({ as: "h2" }))``;
export const Paragraph = styled(BaseText).attrs(() => ({ as: "p" }))``;

export const Text = {
  span: SpanText,
  h1: HeaderLarge,
  h2: Header,
  p: Paragraph,
};
