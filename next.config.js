const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^\/api\/.*$/,
      handler: 'NetworkOnly',
    },
  ],
})

const WebpackObfuscator = require('webpack-obfuscator')

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.plugins.push(
        new WebpackObfuscator({
          rotateStringArray: true,
          stringArray: true,
          stringArrayEncoding: ['base64'],
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.7,
          deadCodeInjection: false,
          disableConsoleOutput: true,
          debugProtection: true,
          debugProtectionInterval: 2000,
        }, [])
      )
    }
    return config
  },
}

module.exports = withPWA(nextConfig)