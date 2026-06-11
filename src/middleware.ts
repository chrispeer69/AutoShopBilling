export { default } from "next-auth/middleware";

// NOTE: /approve/[token] (public customer signing) and /api/stripe/webhook stay open intentionally.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customers/:path*",
    "/docs/:path*",
    "/followups/:path*",
    "/settings/:path*",
    "/parts/:path*",
    "/canned-jobs/:path*",
    "/reports/:path*",
    "/account/:path*",
    "/api/docs/:path*",
    "/api/vin/:path*",
    "/api/parts/:path*",
    "/api/customers/:path*",
  ],
};
