import type { MessageKey } from '../i18n';
import type { Language } from '../i18n/languages';

/**
 * "Use my location" on the city question (`INTRO-31`): the platform's reverse geocoder (expo-location
 * `reverseGeocodeAsync`: Android's `Geocoder`, which asks Google's service on most phones, and iOS `CLGeocoder`, which
 * asks Apple's) names the place, and this turns its answer into the line the user sees and can edit: district,
 * city or province, and country. Never a street, house number or neighbourhood, and never the coordinates. Pure (no
 * React Native), so scripts/intro-tests/ runs it.
 */

/** The fields of expo-location's `LocationGeocodedAddress` used here (all may be null). */
export type GeocodedAddress = {
  /** "Additional city-level information like district name" (a district or neighbourhood). */
  district?: string | null;
  /** The city (locality). In Türkiye often the ilçe, sometimes the il. */
  city?: string | null;
  /** "Additional information about administrative area": a county, or in Türkiye the ilçe. */
  subregion?: string | null;
  /** The state or province; in Türkiye the il. */
  region?: string | null;
  /** The localised country name. */
  country?: string | null;
  isoCountryCode?: string | null;
};

/** What is kept of the address: smallest to largest, any of them may be missing. */
export type Place = { district: string | null; city: string | null; country: string | null };

const clean = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() || null;
const same = (a: string | null, b: string | null, locale?: string) =>
  !!a && !!b && a.toLocaleLowerCase(locale) === b.toLocaleLowerCase(locale);

/**
 * District, city or province, and country from the geocoder's answer.
 * - Türkiye: ilçe (the subregion, else the city when it isn't the il), il (the region, else the city), ülke.
 * - Elsewhere: the district, the city (else the county, else the state or province), the country.
 * A part equal to a larger one is left out ("İstanbul, İstanbul" → "İstanbul").
 */
export function placeFromAddress(a: GeocodedAddress): Place {
  const turkey = clean(a.isoCountryCode)?.toUpperCase() === 'TR';
  const locale = turkey ? 'tr' : undefined;
  let district: string | null;
  let city: string | null;
  if (turkey) {
    city = clean(a.region) ?? clean(a.city);
    district = clean(a.subregion) ?? (same(clean(a.city), city, locale) ? null : clean(a.city));
  } else {
    city = clean(a.city) ?? clean(a.subregion) ?? clean(a.region);
    district = clean(a.district);
  }
  const country = clean(a.country);
  if (same(district, city, locale) || same(district, country, locale)) district = null;
  if (same(city, country, locale)) city = null;
  return { district, city, country };
}

/** True when nothing usable came back (the question then says so and keeps its text field). */
export function isEmptyPlace(place: Place): boolean {
  return !place.district && !place.city && !place.country;
}

/**
 * The line shown in the answer field, in the interface language's usual order: smallest first with commas
 * ("Kadıköy, İstanbul, Türkiye", "Mitte, Berlin, Deutschland"), largest first in Japanese and Korean ("日本 東京都
 * 渋谷区", "대한민국 서울특별시 강남구").
 */
export function formatPlace(place: Place, language: Language): string {
  const parts = [place.district, place.city, place.country].filter((p): p is string => !!p);
  if (language === 'ja' || language === 'ko') return parts.reverse().join(' ');
  return parts.join(', ');
}

/**
 * Why no place name came back: not allowed, location off on the phone, no position in time (no fix), a build without
 * the module, or no name for the position (no network, an unknown place, the service failed). Each is one short line
 * under the button; the question keeps its text field and can be skipped.
 */
export type LocationProblem = 'denied' | 'servicesOff' | 'timeout' | 'needsBuild' | 'failed';

export const LOCATION_PROBLEM_TEXT: Record<LocationProblem, MessageKey> = {
  denied: 'profile.locationDenied',
  servicesOff: 'profile.locationOff',
  timeout: 'profile.locationTimeout',
  needsBuild: 'profile.locationUnavailable',
  failed: 'profile.locationFailed',
};
