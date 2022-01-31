import React from "react";
import styled from "styled-components";
import { Stack } from "../Stack";
import { StackProps } from "../Stack/Stack";
import { PanelTopBar } from "./PanelTopBar";

type PanelProps = {
  panelTitle?: string | JSX.Element;
  noBorder?: boolean;
  noTopbar?: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
} & StackProps;

const StyledPanel = styled(Stack).attrs<PanelProps>(props => {
  return {
    grow: props.grow ?? true,
    padding: props.padding ?? "sm",
    border: props.border ?? !props.noBorder,
    background: props.background ?? "panel",
    itemSpace: props.itemSpace ?? "xs",
  };
})<PanelProps>``;

export const Panel = (props: PanelProps) => (
  <StyledPanel grow {...props}>
    {!props.noTopbar && <PanelTopBar onClose={props.onClose} panelTitle={props.panelTitle} />}
    {props.children}
  </StyledPanel>
);
