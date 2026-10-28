import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NCR Wheelz",
    short_name: "NCR Wheelz",
    description:
      "Used passenger cars and commercial cabs in Delhi NCR. Compare listings, check car values and plan an EMI.",
    start_url: "/",
    display: "browser",
    background_color: "#f5f6f8",
    theme_color: "#101c2c",
    lang: "en-IN",
    icons: [
      {
        src: "/brandings/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brandings/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
