/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ["pdfkit", "nodemailer"] },
};
module.exports = nextConfig;
