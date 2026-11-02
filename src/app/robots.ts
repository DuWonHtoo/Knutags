import type { MetadataRoute } from 'next';

// Profiles also send "noindex" (header + meta), which search engines can only
// see if they are allowed to fetch the page, so /p/ is not blocked here.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: ['/admin', '/api'] }],
  };
}
