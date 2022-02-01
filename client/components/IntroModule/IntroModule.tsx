import React from "react";
import { Box } from "../Box";
import { HeaderLarge, Paragraph, SpanText } from "../Text/Text";
import UserForm from "./UserForm";

const IntroModule = () => {
  return (
    <>
      <Box justifyContent="center" alignItems="center" padding>
        <Box>
          <HeaderLarge>
            <SpanText textColor="Turqoise">chat</SpanText>
            <SpanText textColor="NeonPurple">wallette</SpanText>
          </HeaderLarge>
        </Box>
        <Box>
          <Paragraph bold>Talk to fellow jpeg holders</Paragraph>
        </Box>
        <UserForm />
      </Box>
    </>
  );
};

export default IntroModule;
