/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Ostium SDK pulls in `ws` for its price stream; both load from
  // node_modules at runtime instead of being bundled, which trips on ws's
  // optional native helpers (M-Ostium).
  serverExternalPackages: ["@ostium/builder-sdk", "ws"],
};

export default nextConfig;
