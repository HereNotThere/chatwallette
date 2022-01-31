export const IPFS_GATEWAYS = [
  "https://cf-ipfs.com",
  "https://cloudflare-ipfs.com",
  "https://gateway.pinata.cloud",
  "https://ipfs.moralis.io:2053",
  "https://ipfs.infura.io",
  "https://dweb.link",
  "https://ipfs.io",
  "https://astyanax.io",
];

export const delay = (retryCount: number): number => {
  const expTime = 1000 * Math.pow(2, retryCount);
  return expTime + Math.floor(Math.random() * expTime);
};

export const randomIpfsGateway = () => {
  return IPFS_GATEWAYS[Math.floor(Math.random() * IPFS_GATEWAYS.length)];
};

export const ipfsURL = (path: string): string => {
  return randomIpfsGateway() + "/ipfs/" + path;
};

export function getTokenBaseUrl() {
  const hostname = window.location.hostname;
  const port = window.location.port;
  const protocol = "https";
  const nextPort = Number(port) + 1;
  if (port) {
    return `${protocol}://${hostname}:${nextPort}/cors`;
  } else {
    return `${protocol}://${hostname}/cors`;
  }
}
