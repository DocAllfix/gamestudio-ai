import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GameSmith — Forgia giochi veri",
    short_name: "GameSmith",
    description:
      "Un gioco vero, che giri e possiedi. Su 5 motori, browser e mobile.",
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
