/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'd3v0px0pttie1i.cloudfront.net',
        pathname: '/uploads/**',
      },
    ],
  },
}

module.exports = nextConfig



