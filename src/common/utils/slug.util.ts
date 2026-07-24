export function generateBaseSlug(name: string): string {
  // Convert to lowercase and remove leading/trailing spaces
  let slug = name.trim().toLowerCase();

  // Replace spaces, non-word characters (excluding dashes) with hyphens
  slug = slug.replace(/[^a-z0-9]+/g, '-');

  // Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');

  // If the string is empty after cleaning, use a generic fallback
  if (!slug) {
    slug = 'organization';
  }

  return slug;
}

export function formatSequentialSlug(baseSlug: string, counter: number): string {
  if (counter <= 0) {
    return baseSlug;
  }
  return `${baseSlug}-${counter}`;
}
