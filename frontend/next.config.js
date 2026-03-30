/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**" }
    ],
  },
  // cPanel / Phusion Passenger compatibility
  experimental: {
    // Tắt server actions nếu gây lỗi trên Passenger
  },
};
module.exports = nextConfig;
