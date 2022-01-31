import { AuthRequest, AuthRequestWalletData } from "../../protocol/auth";
import { logger } from "./logger";

function getAuthUrl() {
  const hostname = window.location.hostname;
  const port = window.location.port;
  const protocol = "https";
  if (port === "3000" || port === "3001") {
    return `${protocol}://${hostname}:3001/auth`;
  } else {
    return `${protocol}://${hostname}/auth`;
  }
}

function getIceServersUrl() {
  const hostname = window.location.hostname;
  const port = window.location.port;
  const protocol = "https";
  if (port === "3000" || port === "3001") {
    return `${protocol}://${hostname}:3001/iceservers`;
  } else {
    return `${protocol}://${hostname}/iceservers`;
  }
}

export async function getIceServers(): Promise<RTCIceServer[] | undefined> {
  try {
    const response = await fetch(getIceServersUrl(), {
      method: "GET",
      mode: "cors",
      cache: "no-cache",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      redirect: "follow",
      referrerPolicy: "no-referrer",
    });

    logger.info(`getIceServers`, response);
    if (response.status === 200) {
      const { iceServers } = await response.json();
      return [...iceServers.ice_servers];
    }
  } catch (err) {
    logger.error(`getIceServers error`, err);
  }
}
export async function postAuthRequest(request: AuthRequest): Promise<number | void> {
  try {
    const response = await fetch(getAuthUrl(), {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      redirect: "follow",
      referrerPolicy: "no-referrer",
      body: JSON.stringify(request),
    });
    return response.status;
  } catch (err) {
    logger.error(`postAuthRequest error`, err);
  }
}

export async function getAuthRequestWalletData(
  chainId: string,
  walletAddress: string,
  nonce: string,
): Promise<AuthRequestWalletData | void> {
  try {
    const response = await fetch(getAuthUrl() + `?chainId=${chainId}&walletAddress=${walletAddress}&nonce=${nonce}`, {
      method: "GET",
      mode: "cors",
      cache: "no-cache",
      credentials: "include",
      redirect: "follow",
      referrerPolicy: "no-referrer",
    });
    const data: AuthRequestWalletData = await response.json();
    logger.info(`getAuthRequestWalletData JSON `, data);
    return data;
  } catch (err) {
    logger.error(`getAuthRequestWalletData error`, err);
  }
}

export async function deleteAuth(): Promise<number | void> {
  try {
    const response = await fetch(getAuthUrl(), {
      method: "DELETE",
      mode: "cors",
      cache: "no-cache",
      credentials: "include",
      redirect: "follow",
      referrerPolicy: "no-referrer",
    });
    const status = response.status;
    logger.info(`deleteAuth `, status);
    return status;
  } catch (err) {
    logger.error(`deleteAuth error`, err);
  }
}
