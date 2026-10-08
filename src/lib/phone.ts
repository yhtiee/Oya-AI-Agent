import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Normalises a phone number to E.164 ("+2348031234567"). Local formats ("0803 123 4567")
 * are read as Nigerian by default (SPEC §4.6). Returns null if the number isn't valid.
 */
export function toE164(input: string, defaultCountry: CountryCode = "NG"): string | null {
  const parsed = parsePhoneNumberFromString(input.trim(), defaultCountry);
  return parsed?.isValid() ? parsed.number : null;
}

// Nigerian mobile ranges: 070x, 080x, 081x, 090x, 091x. Checked directly so the browser bundle
// doesn't need libphonenumber's full metadata just to tell mobiles from landlines.
const NG_MOBILE_NATIONAL = /^[789][01]\d{8}$/;

/** True for a valid Nigerian mobile number in any common format. */
export function isNigerianMobile(input: string): boolean {
  const parsed = parsePhoneNumberFromString(input.trim(), "NG");
  return Boolean(parsed?.isValid() && parsed.country === "NG" && NG_MOBILE_NATIONAL.test(parsed.nationalNumber));
}

/** "+234 803 *** 4567": safe to show in logs, ops lists and confirmations. */
export function maskPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return "***";
  const national = parsed.nationalNumber;
  if (national.length < 7) return `+${parsed.countryCallingCode} ***`;
  return `+${parsed.countryCallingCode} ${national.slice(0, 3)} *** ${national.slice(-4)}`;
}
