/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // three.js scene mounts once; StrictMode double-invoke would re-init WebGL
  webpack: (config) => {
    // Allow importing .glb/.hdr as static assets if ever needed via import
    config.module.rules.push({
      test: /\.(glb|gltf|hdr)$/,
      type: "asset/resource",
    });
    return config;
  },
};

export default nextConfig;
