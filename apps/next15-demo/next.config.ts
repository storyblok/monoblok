import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ["https://localhost:3000", "storyblok-demo-default-v2.netlify.app"],
  trailingSlash: false,
};

export default nextConfig;
