/** A steady colour per site for letter badges; lightness 33% keeps white letters at 4.5:1 for every hue. */
export function siteColor(host: string): string {
  let hash = 0;
  for (let i = 0; i < host.length; i++) hash = (hash * 31 + host.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(hash) % 360}, 45%, 33%)`;
}
