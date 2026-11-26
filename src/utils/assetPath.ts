/**
 * Resolves static asset paths (images, iframes, audio) so they work
 * consistently both on root domains (e.g. http://localhost:3000/) and on
 * subpath deployments such as GitHub Pages (e.g. https://<user>.github.io/<repo>/).
 */
export function resolveAssetUrl(path: string, baseUrl = './'): string {
  if (!path) return '';
  if (/^(https?:|data:|blob:|\/\/)/i.test(path)) {
    return path;
  }
  // In Vite with base: './', import.meta.env.BASE_URL is './'
  const rawBase = baseUrl || './';
  const cleanBase = rawBase.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\.?\/+/, '');

  if (!cleanBase || cleanBase === '.') {
    return `./${cleanPath}`;
  }
  return `${cleanBase}/${cleanPath}`;
}

export function getAssetUrl(path: string): string {
  return resolveAssetUrl(path, import.meta.env?.BASE_URL || './');
}
