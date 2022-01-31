import { AppProps } from "next/app";
import { useRouter } from "next/router";
import React, { useEffect } from "react";
import styled from "styled-components";
import { Box } from "../components/Box";
import { Panel } from "../components/Panel";
import { Web3Provider } from "../hooks/use_web3";
import { useStore } from "../store/store";
import "../styles/fonts.css";
import "../styles/globals.css";
import "../styles/layout.scss";
import "../styles/Typist.css";
import { pageview } from "../utils/google_analytics";

// Surpress all SSR rendering, force all rendering onto the client
export function NoSSR({ children }: { children: JSX.Element }) {
  return <div suppressHydrationWarning>{typeof window === "undefined" ? null : children}</div>;
}
function MyApp(props: AppProps) {
  const { Component, pageProps } = props;

  return (
    <BodyPanel padding="sm" grow noBorder noTopbar background="body">
      <Web3Provider>
        <MainContainer>
          <Component {...pageProps} />
        </MainContainer>
      </Web3Provider>
    </BodyPanel>
  );
}

const BodyPanel = styled(Panel)`
  width: 100vw;
  height: 100vh;
`;

const MainContainer: React.FC = props => {
  const router = useRouter();
  const { isAuthenticated } = useStore();

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      pageview(url);
    };
    //When the component is mounted, subscribe to router changes
    //and log those page views
    router.events.on("routeChangeComplete", handleRouteChange);

    // If the component is unmounted, unsubscribe
    // from the event with the `off` method
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);

  useEffect(() => {
    if (router.route !== "/tos") {
      if (isAuthenticated && router.route !== "/chat") {
        // Ignore promise that resolves when push completes
        void router.push("/chat");
      } else if (!isAuthenticated && router.route !== "/") {
        // Ignore promise that resolves when push completes
        void router.push("/");
      }
    }
  }, [isAuthenticated, router]);
  return <Box grow>{props.children}</Box>;
};

export default MyApp;
