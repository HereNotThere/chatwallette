import { NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback } from "react";
import { Box } from "../components/Box";
import { Button } from "../components/Button";
import { Stack } from "../components/Stack";
import { Header, HeaderLarge, Paragraph } from "../components/Text/Text";

const TOSText = `ChatWallette is the first side project from the team Here not There. The project has not been audited, and the
team does not claim advanced security measures beyond those outlined in the FAQ. By using this website you are
accepting sole responsibility, use at your own risk. Be cautious when sharing information and never provide your
password or seed phrase.`;

const TOS: NextPage = () => {
  const router = useRouter();
  const onBack = useCallback(() => router.push("/"), [router]);

  return (
    <>
      <Head>
        <title>{"Chat Wallette TOS"}</title>
        <meta name="description" content="Chat Wallette Terms of Service" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Stack grow centerContent itemSpace="lg">
        <HeaderLarge textColor="NeonPurple">ChatWallette</HeaderLarge>
        <Header textColor="Turqoise">Terms of Service</Header>
        <Box padding="md" style={{ width: "33%" }}>
          <Paragraph style={{ lineBreak: "loose", textAlign: "justify" }}>{TOSText}</Paragraph>
        </Box>
        <Button onClick={onBack}>Accept</Button>
      </Stack>
    </>
  );
};
export default TOS;
