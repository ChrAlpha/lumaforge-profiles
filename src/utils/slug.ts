import path from "node:path";

export function slugify(input: string, fallback = "profile") {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

export function sanitizeFileName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  const stem = path.basename(fileName, path.extname(fileName));
  return `${slugify(stem, "asset")}${ext}`;
}

export function titleFromStem(stem: string) {
  const words = toWords(stem)
    .split(" ")
    .filter(Boolean);

  return words
    .map((word) => {
      if (/[A-Z]/.test(word)) {
        return word;
      }
      return `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
}

export function toWords(value: string) {
  return value
    .replace(/[_/\\.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
