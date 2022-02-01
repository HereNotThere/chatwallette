This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

To run the development servers you will need to run two seperate dev instances, one to server the Client (via Next.JS) and the other to server the Server.

They will both need to be served with TLS to enable the code served to the client to make requests against the server. To support this you will need to install local-ssl-proxy and mkcert.

```bash
 npm install -g local-ssl-proxy
 brew install mkcert
```

First, create the certificates needed by both servers.

```bash
mkcert localhost
```

In Chrome, paste this in the URL to allow the locally generated ssl cert:
chrome://flags/#allow-insecure-localhost

Next start the Next.JS server behind a local-ssl-proxy:

```bash
cd client
yarn install
yarn dev-ssl
```

Then in another Terminal window start the server backend:

```bash
cd server
yarn install
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

## Deployment

This project is build by Google Cloud Build and deployed to Google Cloud Run

The [Cloud Build Project](https://console.cloud.google.com/cloud-build/dashboard?project=here-web3-playground) watched the main branch and dpeloys anything that hits it

The Docker image created by Cloud Build is then deployed to [Cloud Run](https://console.cloud.google.com/run/detail/us-central1/here-web3-playground/metrics?project=here-web3-playground)

You can create the docker image locally and run it using these commands

```bash
docker build . -t here-web3-server
docker run -p 3000:3000 here-web3-server
```

## Local development with redis

```bash
docker pull redis
docker run -p 6379:6379 redis
```

Use the client tool (redis-cli) to connect to the redis instance:

[Install redis/redis-cli using brew](https://medium.com/@petehouston/install-and-config-redis-on-mac-os-x-via-homebrew-eb8df9a4f298)

```bash
redis-cli ping

# You should see PONG as a response.
```
