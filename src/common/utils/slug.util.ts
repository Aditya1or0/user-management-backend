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

export function generatePublicSlug(name: string): string {
  // Normalize string: convert to lowercase, replace spaces with hyphens, remove non-alphanumeric chars
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-');

  // Generate a random 4-character alphanumeric suffix
  const suffix = Math.random().toString(36).substring(2, 6);

  // If the normalized string is empty, fallback to generic
  const prefix = normalized || 'user';

  return `${prefix}-${suffix}`;
}
