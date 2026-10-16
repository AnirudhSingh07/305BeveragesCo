import type { MetadataRoute } from "next";

/**
 * Web app manifest — makes the console installable on a phone home screen
 * ("Add to Home Screen" / PWA install). Served at /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "305 Beverages Co. — Business Console",
    short_name: "305 POS",
    description:
      "Point of sale, orders, expenses, and reporting for 305 Beverages Co.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF4DB",
    theme_color: "#07689C",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
