import React, { Suspense } from "react";
import { NoSSR } from "../../pages/_app";
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
        <NoSSR>
          <Suspense fallback={<Box style={{ height: 56 }} />}>{<UserForm />}</Suspense>
        </NoSSR>
      </Box>
    </>
  );
};

export default IntroModule;
