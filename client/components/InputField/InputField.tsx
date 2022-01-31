import styled from "styled-components";
import { Box } from "../Box";
import { BoxProps } from "../Box/Box";

type InputProps = {
  value: string | number;
} & BoxProps &
  React.ComponentPropsWithoutRef<"input">;

export const InputField = (props: InputProps) => {
  return <StyledInput as="input" {...props}></StyledInput>;
};

const StyledInput = styled(Box).attrs((props: InputProps) => ({
  background: props.background ?? "input",
  border: props.border ?? true,
  textColor: props.textColor ?? "White",
  padding: props.padding ?? "xs",
}))`
  appearance: none;
  ${({ border }) => !border && `border:none;`}
  outline: none;
`;
