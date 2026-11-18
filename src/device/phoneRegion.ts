/**
 * Turning a number saved in the address book without a country code ("0532 123 45 67") into the international form
 * WhatsApp needs (docs/contacts.md). Pure. The country comes from the phone's region; the table says each country's
 * calling code and the trunk prefix dialled before a local number there (removed), if any.
 */

type Country = { code: string; trunk?: string };

/** ISO 3166 region → calling code and trunk prefix. Countries without a trunk prefix keep the number whole. */
const COUNTRIES: Record<string, Country> = {
  TR: { code: '90', trunk: '0' },
  DE: { code: '49', trunk: '0' },
  AT: { code: '43', trunk: '0' },
  CH: { code: '41', trunk: '0' },
  GB: { code: '44', trunk: '0' },
  IE: { code: '353', trunk: '0' },
  FR: { code: '33', trunk: '0' },
  BE: { code: '32', trunk: '0' },
  NL: { code: '31', trunk: '0' },
  LU: { code: '352' },
  // Italy keeps the leading 0 of landlines in international form; mobiles start with 3.
  IT: { code: '39' },
  ES: { code: '34' },
  PT: { code: '351' },
  GR: { code: '30' },
  CY: { code: '357' },
  DK: { code: '45' },
  NO: { code: '47' },
  SE: { code: '46', trunk: '0' },
  FI: { code: '358', trunk: '0' },
  IS: { code: '354' },
  PL: { code: '48' },
  CZ: { code: '420' },
  SK: { code: '421', trunk: '0' },
  HU: { code: '36', trunk: '06' },
  RO: { code: '40', trunk: '0' },
  BG: { code: '359', trunk: '0' },
  HR: { code: '385', trunk: '0' },
  SI: { code: '386', trunk: '0' },
  RS: { code: '381', trunk: '0' },
  BA: { code: '387', trunk: '0' },
  AL: { code: '355', trunk: '0' },
  MK: { code: '389', trunk: '0' },
  UA: { code: '380', trunk: '0' },
  RU: { code: '7', trunk: '8' },
  KZ: { code: '7', trunk: '8' },
  BY: { code: '375', trunk: '8' },
  AZ: { code: '994', trunk: '0' },
  GE: { code: '995', trunk: '0' },
  AM: { code: '374', trunk: '0' },
  US: { code: '1', trunk: '1' },
  CA: { code: '1', trunk: '1' },
  MX: { code: '52' },
  BR: { code: '55', trunk: '0' },
  AR: { code: '54', trunk: '0' },
  CL: { code: '56' },
  CO: { code: '57' },
  PE: { code: '51', trunk: '0' },
  AU: { code: '61', trunk: '0' },
  NZ: { code: '64', trunk: '0' },
  JP: { code: '81', trunk: '0' },
  KR: { code: '82', trunk: '0' },
  CN: { code: '86', trunk: '0' },
  TW: { code: '886', trunk: '0' },
  HK: { code: '852' },
  SG: { code: '65' },
  MY: { code: '60', trunk: '0' },
  ID: { code: '62', trunk: '0' },
  TH: { code: '66', trunk: '0' },
  VN: { code: '84', trunk: '0' },
  PH: { code: '63', trunk: '0' },
  IN: { code: '91', trunk: '0' },
  PK: { code: '92', trunk: '0' },
  BD: { code: '880', trunk: '0' },
  AE: { code: '971', trunk: '0' },
  SA: { code: '966', trunk: '0' },
  QA: { code: '974' },
  KW: { code: '965' },
  IL: { code: '972', trunk: '0' },
  EG: { code: '20', trunk: '0' },
  MA: { code: '212', trunk: '0' },
  TN: { code: '216' },
  ZA: { code: '27', trunk: '0' },
  NG: { code: '234', trunk: '0' },
  KE: { code: '254', trunk: '0' },
  IR: { code: '98', trunk: '0' },
  IQ: { code: '964', trunk: '0' },
  AF: { code: '93', trunk: '0' },
};

export type International =
  | { ok: true; number: string; added?: string }
  | { ok: false; error: string };

/**
 * `number`: digits with an optional leading "+" (already through normalizePhone). With "+" or "00" it is used as it
 * is. Otherwise `countryCode` (what the user said, e.g. "+44") or the region's code is put in front, without the
 * region's trunk prefix; `added` is the code that was added, for the card and the model. An unknown region and no
 * country code: refused, so the user is asked instead of a guess.
 */
export function toInternational(number: string, region: string | null, countryCode?: string): International {
  if (number.startsWith('+')) return { ok: true, number };
  if (number.startsWith('00')) return { ok: true, number: `+${number.slice(2)}` };
  const given = countryCode ? countryCode.replace(/[^\d]/g, '') : '';
  if (countryCode !== undefined && countryCode !== '' && !/^\+?\d{1,3}$/.test(countryCode.trim()))
    return { ok: false, error: 'country_code must be a calling code such as "+44".' };
  const country = region ? COUNTRIES[region.toUpperCase()] : undefined;
  const code = given || country?.code;
  if (!code)
    return {
      ok: false,
      error:
        "This contact's number has no country code and the phone's region is not known. Ask the user which country " +
        'code it has (e.g. +44) and call again with country_code; do not guess it.',
    };
  // The trunk prefix of the country whose code is used (the region's, or a known country with that code).
  const trunk = given ? Object.values(COUNTRIES).find((c) => c.code === given)?.trunk : country?.trunk;
  let local = number;
  if (trunk && local.startsWith(trunk)) local = local.slice(trunk.length);
  if (local.length < 4) return { ok: false, error: 'This number is too short for a WhatsApp number.' };
  return { ok: true, number: `+${code}${local}`, added: `+${code}` };
}
