import React from "react";
import { Box } from "../Box";
import { Stack } from "../Stack";
import { HeaderLarge, Paragraph, SpanText } from "../Text/Text";
import UserForm from "./UserForm";

export const IntroModule = () => {
  return (
    <Stack centerContent alignItems="center" justifyContent="center">
      <Stack shrink alignItems="center" basis={220} itemSpace="sm">
        <Box>
          <HeaderLarge>
            <SpanText textColor="Turqoise">chat</SpanText>
            <SpanText textColor="NeonPurple">wallette</SpanText>
          </HeaderLarge>
        </Box>
        <Box padding="xs">
          <Paragraph centerText>Talk to NFT holders</Paragraph>
        </Box>
        <UserForm />
      </Stack>
    </Stack>
  );
};

IntroModule.WIDTH = 500;
IntroModule.HEIGHT = 300;
