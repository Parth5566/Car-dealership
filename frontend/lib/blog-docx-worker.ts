import mammoth from "mammoth";
import { checkDocxArchive } from "./blog-import";
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    checkDocxArchive(event.data);
    const images: {
      token: string;
      mime: string;
      base64: string;
      alt: string;
    }[] = [];
    let imageCount = 0;
    const result = await mammoth.convertToHtml(
      { arrayBuffer: event.data },
      {
        externalFileAccess: false,
        includeEmbeddedStyleMap: false,
        styleMap: [
          "u => u",
          "strike => s",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
        ],
        convertImage: mammoth.images.imgElement(async (image: any) => {
          if (
            ++imageCount > 30 ||
            !["image/jpeg", "image/png", "image/webp"].includes(
              image.contentType,
            )
          )
            throw new Error(
              "Word images must be JPEG, PNG or WebP (up to 30 images).",
            );
          const base64 = await image.read("base64");
          if (base64.length > 12 * 1024 * 1024)
            throw new Error("A Word image is larger than 8 MB.");
          const token = `docx-image-${images.length}`;
          images.push({
            token,
            mime: image.contentType,
            base64,
            alt: image.altText || "",
          });
          return { src: token, alt: image.altText || "" };
        }),
      },
    );
    self.postMessage({
      html: result.value,
      images,
      warnings: result.messages.map((message: any) => message.message),
    });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
