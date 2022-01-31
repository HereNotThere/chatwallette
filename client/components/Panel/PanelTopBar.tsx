import styled from "styled-components";
import { Box } from "../Box";
import { Button } from "../Button";
import { CloseIcon } from "../Icons";
import { Stack } from "../Stack";
import { Paragraph } from "../Text/Text";

interface Props {
  onClose?: () => void;
  panelTitle?: string | JSX.Element;
}

export const PanelTopBar = ({ onClose, panelTitle }: Props) => (
  <Stack overflowVisible row itemSpace="xs" shrink>
    {onClose && (
      <Box>
        <Button
          onClick={onClose}
          background="panel"
          square
          icon={<CloseIcon />}
          padding={false}
          textColor="NeonPurple"
          borderColor="NeonPurple"
        />
      </Box>
    )}
    <StripeContainer>
      <Stripe />
      <Stripe />
      <Stripe />
      <Stripe />
      <Stripe />
    </StripeContainer>
    {panelTitle && (
      <Box textColor="NeonPurple" centerContent>
        <Paragraph bold>{panelTitle}</Paragraph>
      </Box>
    )}
  </Stack>
);

const StripeContainer = styled(Box)`
  flex: 1;
  /* 2px = even out to fix stripe spacing consistency */
  height: calc(var(--bl3) + 2px);
  display: flex;
  flex-flow: column;
  justify-content: space-between;
`;

const Stripe = styled.div`
  display: flex;
  border-bottom: 2px solid var(--bg-border);
`;
