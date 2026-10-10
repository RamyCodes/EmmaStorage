export const ACTIONS = ["Take", "Return", "Consume"] as const;
export type ActivityAction = (typeof ACTIONS)[number];
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateActivity(action: unknown, person: unknown, photo: unknown): string | null {
  if (!ACTIONS.includes(action as ActivityAction)) return "Choose Take, Return, or Consume.";
  if (typeof person !== "string" || !person.trim()) return "Enter your name.";
  if (person.trim().length > 100) return "Keep your name under 100 characters.";
  if (!(photo instanceof File) || photo.size === 0) return "Add a photo of all the items.";
  if (!PHOTO_TYPES.includes(photo.type)) return "Use a JPEG, PNG, or WebP photo.";
  if (photo.size > MAX_PHOTO_BYTES) return "Your photo is too large. Choose a photo under 3 MB.";
  return null;
}

export function matchesPhotoType(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") {
    return [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  }
  if (type === "image/webp") {
    return String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  }
  return false;
}