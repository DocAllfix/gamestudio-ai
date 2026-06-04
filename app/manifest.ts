import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GameSmith — Forge real games",
    short_name: "GameSmith",
    description:
      "A real game that runs and that you own. On 5 engines, browser and mobile.",
    start_url: "/",
    display: "standalone",
    background_color: "#0E0F12",
    theme_color: "#F5582B",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
