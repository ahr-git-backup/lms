/**
 * Shrink a profile photo before upload (max 320px, JPEG ~80%).
 * A phone photo is often 1-5 MB and every view of an avatar downloads it
 * again; a 320px JPEG is ~20-40 KB, which cuts Supabase Storage egress a lot.
 * Never throws: if anything fails (unsupported type, canvas error, result not
 * smaller) the original file is returned unchanged, so uploads always work.
 */
export async function compressAvatar(file: File, maxSize = 320, quality = 0.82): Promise<File> {
  try {
    if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "avatar";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
