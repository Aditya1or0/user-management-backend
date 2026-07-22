import { randomBytes } from 'crypto';

export function generateSlug(name: string): string {
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

  // Append a random 6-character hex string for entropy
  const entropy = randomBytes(3).toString('hex');
  return `${slug}-${entropy}`;
}
