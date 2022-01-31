import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { Box } from "../Box";
import { ColorAttr } from "../Theme/Theme";

const Coins = {
  coin1: "/a1.png",
  coin2: "/a2.png",
  coin3: "/a3.png",
  coin4: "/a4.png",
};

const CoinList = Object.keys(Coins) as Array<keyof typeof Coins>;

type Props = {
  name: keyof typeof Coins;
  color?: ColorAttr;
};

export const Coin = styled(Box)<Props>`
  width: 50px;
  height: 50px;
  background: url(${({ name }) => Coins[name]}) no-repeat center;
  background-size: contain;
`;

const colors: ColorAttr[] = ["NeonPurple", "Turqoise", "Pink", "Yellow"];
const msFrameRate = 40;
const msUpdateInterval = 1000;
export const RandomCoin = (props: { index: number }) => {
  const { index } = props;

  const [count, setCount] = useState(0);
  useEffect(() => {
    const msSyncedStart = msUpdateInterval - (Date.now() % msUpdateInterval);
    let interval: NodeJS.Timer;
    const timeout = setTimeout(() => {
      interval = setInterval(function update() {
        setCount(c => c + 1);
      }, msUpdateInterval);
    }, msSyncedStart + index * msFrameRate);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [index]);
  const name = useRef<keyof typeof Coins>(CoinList[index]);
  const color = useRef<ColorAttr>(colors[index]);

  useEffect(() => {
    name.current = CoinList[(CoinList.length - index + count) % CoinList.length];
    color.current = colors[(index + count) % colors.length];
  }, [count, index]);

  return <Coin name={name.current} />;
};
