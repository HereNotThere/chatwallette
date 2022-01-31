import { Stack } from "../Stack";
import styled from "styled-components";
import { Box } from "../Box";

export const TestScreen = () => (
  <Stack fullscreen padding="no" itemSpace="no">
    <Stack grow={20} itemSpace="no" padding="no" row>
      <Stripe color="white" />
      <Stripe color="yellow" />
      <Stripe color="cyan" />
      <Stripe color="chartreuse" />
      <Stripe color="magenta" />
      <Stripe color="red" />
      <Stripe color="blue" />
      <Stripe color="black" />
    </Stack>
  </Stack>
);

const Stripe = styled(Box).attrs((props: { color: string }) => ({
  grow: true,
  style: { backgroundColor: props.color },
}))``;
