import puter from "@heyputer/puter.js";
import { ROOMIFY_RENDER_PROMPT } from "./constants";

export async function fetchAsDataUrl(url: string): Promise<string> {
  // Fetch the image
  const response = await fetch(url);

  // Throw error if response fails
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  // Convert response to blob
  const blob = await response.blob();

  // Create promise that uses FileReader to read blob as data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error("Failed to read blob as data URL"));
    };
    reader.readAsDataURL(blob);
  });
}

export const generate3DView = async ({ sourceImage }: Generate3DViewParams) => {
  const dataUrl = sourceImage.startsWith("data:")
    ? sourceImage
    : await fetchAsDataUrl(sourceImage);

  const base64Data = dataUrl.split(",")[1];
  const mimeType = dataUrl.split(";")[0].split(":")[1];

  if (!mimeType || !base64Data) throw new Error("Invalid source image payload");

  const response = await puter.ai.txt2img(ROOMIFY_RENDER_PROMPT, {
    provider: "gemini",
    model: "gemini-2.5-flash-image-preview",
    input_image: base64Data,
    input_image_mime_type: mimeType,
    ratio: { w: 1024, h: 1024 },
  });

  const rawImageUrl = (response as HTMLImageElement).src ?? null;

  if (!rawImageUrl) return {renderedImage: null, renderedPath: undefined};

  const renderedImage = rawImageUrl.startsWith("data:")
    ? rawImageUrl
    : await fetchAsDataUrl(rawImageUrl);

  return { renderedImage, renderedPath: undefined };
};
