import { NextPage } from "next";
import { Box } from "../components/Box";
import { Button } from "../components/Button";
import { CloseIcon, Coin1 } from "../components/Icons/Icons";
import { Panel } from "../components/Panel";
import { Header, HeaderLarge } from "../components/Text/Text";

const Guide: NextPage = () => (
  <>
    <Panel row background="body" noBorder itemSpace="md">
      <Panel grow={2}>
        <h1>H1 Header 1</h1>
        <h2>H2 Header 2</h2>
        <p>Paragraph</p>
        <HeaderLarge textColor="NeonPurple">Header Large (H1) + NeonPurple</HeaderLarge>
        <Header textColor="Turqoise">Header Large (H1) + NeonPurple</Header>
      </Panel>
      <Panel centerContent>
        <Box>
          <Coin1 />
        </Box>
        <Button icon={<CloseIcon />}>Button Content</Button>
        <Button>Button No Icon</Button>
      </Panel>
    </Panel>
  </>
);
export default Guide;
