import sharp from "sharp";

export async function optimizeImage(file: File) {
  const arrBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrBuffer);

  return await sharp(buffer)
    .resize({
      withoutEnlargement: true,
      width: 1920,
    })
    .webp({
      quality: 80,
      effort: 6,
    })
    .toBuffer();
}
