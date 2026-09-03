export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function regionPath(name: string, m49: string): string {
  const slug = slugify(name);
  return slug || `m49-${m49}`;
}
