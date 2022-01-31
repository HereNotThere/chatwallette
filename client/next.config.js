const optimizedImages = require("next-optimized-images");
const withPlugins = require("next-compose-plugins");
const zlib = require("zlib");
const CompressionPlugin = require("compression-webpack-plugin");

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
  images: {
    disableStaticImages: true,
  },
  reactStrictMode: true,
  experimental: {
    externalDir: true,
  },
  webpack: (config, options) => {
    config.plugins.push(
      new CompressionPlugin({
        filename: "[path][base].gz",
        algorithm: "gzip",
        test: /\.(js|css|html|svg|map|wav)$/,
        threshold: 2048,
      }),
      new CompressionPlugin({
        filename: "[path][base].br",
        algorithm: "brotliCompress",
        test: /\.(js|css|html|svg|map|wav)$/,
        compressionOptions: {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
            [zlib.constants.BROTLI_PARAM_MODE]: 1,
          },
        },
        threshold: 2048,
      }),
    );

    config.module.rules.push({
      test: /\.(wav)$/i,
      loader: "file-loader",
      options: {
        name: "static/media/[name].[hash:8].[ext]",
      },
    });

    return config;
  },
};

const config = withPlugins(
  [
    [withBundleAnalyzer],

    [
      optimizedImages,
      {
        // optimisation disabled by default, to enable check https://github.com/cyrilwanner/next-optimized-images
        optimizeImages: false,
      },
    ],
  ],
  nextConfig,
);

module.exports = config;
