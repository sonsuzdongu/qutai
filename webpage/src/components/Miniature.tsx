import type { MessageKey } from '../i18n/en';
import { useI18n } from '../lib/i18n';

export type ArtName = 'hero' | 'compare' | 'checkout' | 'booking' | 'research' | 'memory';

// The paintings that exist (made by `npm run art` from art-src/, see ART.md), resolved at build time.
const FILES = import.meta.glob<string>('../art/*.webp', { eager: true, query: '?url', import: 'default' });

/** Every size of one painting (`<name>-<width>.webp`), narrowest first. */
function sources(name: ArtName) {
  return Object.entries(FILES)
    .map(([path, url]) => ({ m: path.match(new RegExp(`/${name}-(\\d+)\\.webp$`)), url }))
    .filter((s) => s.m)
    .map((s) => ({ w: Number(s.m![1]), url: s.url }))
    .sort((a, b) => a.w - b.w);
}

/**
 * A miniature in a gilded frame. Until the painting exists it shows a tiled placeholder of the same size, so the
 * layout never shifts when the art arrives.
 */
export function Miniature({
  name,
  ratio = '4x3',
  sizes = '(min-width: 960px) 50vw, 100vw',
  className,
  priority,
}: {
  name: ArtName;
  ratio?: '4x3' | '3x2';
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  const { t } = useI18n();
  const src = sources(name);
  const alt = t(`art.${name}.alt` as MessageKey);
  return (
    // A class, not an inline style: the site's Content-Security-Policy allows no inline styles.
    <figure className={`miniature ratio-${ratio}${className ? ` ${className}` : ''}`}>
      {src.length ? (
        <img
          src={src[Math.min(1, src.length - 1)].url}
          srcSet={src.map((s) => `${s.url} ${s.w}w`).join(', ')}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'low'}
          decoding="async"
        />
      ) : (
        // No painting yet: decorative, so screen readers are not told about a picture that is not there.
        <div className="miniature-placeholder" aria-hidden="true">
          <span>{t('art.placeholder')}</span>
        </div>
      )}
    </figure>
  );
}
