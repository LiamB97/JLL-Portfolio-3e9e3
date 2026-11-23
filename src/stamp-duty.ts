export type StampDutyPurchase = 'standard' | 'first-time' | 'additional';

// Residential purchase price bands from 1 April 2025.
// https://www.gov.uk/stamp-duty-land-tax/residential-property-rates
const standardBands = [
  [125_000, 0],
  [250_000, 2],
  [925_000, 5],
  [1_500_000, 10],
  [Infinity, 12],
] as const;
const firstTimeBands = [[300_000, 0], [500_000, 5]] as const;
const firstTimeLimitPence = 50_000_000;
const surchargeThresholdPence = 4_000_000;

export function parseStampDutyPrice(input: string): number | null {
  const value = input.normalize('NFKC').trim().replace(/^£\s*/, '')
    .replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) - (digit <= '٩' ? 0x660 : 0x6f0)))
    .replaceAll('٬', ',').replaceAll('٫', '.');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value)) return null;

  const [pounds, pence = ''] = value.replaceAll(',', '').split('.');
  const amount = Number(pounds) * 100 + Number(pence.padEnd(2, '0'));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function calculateStampDuty(pricePence: number, purchase: StampDutyPurchase, nonResident: boolean) {
  const firstTimeRelief = purchase === 'first-time' && pricePence <= firstTimeLimitPence;
  const bands = firstTimeRelief ? firstTimeBands : standardBands;
  const surchargeApplies = pricePence >= surchargeThresholdPence;
  const surcharge = surchargeApplies ? (purchase === 'additional' ? 5 : 0) + (nonResident ? 2 : 0) : 0;

  let taxedPence = 0;
  let taxInHundredthsOfAPenny = 0n;
  for (const [upperLimit, rate] of bands) {
    const bandEnd = Math.min(pricePence, upperLimit * 100);
    if (bandEnd <= taxedPence) break;
    taxInHundredthsOfAPenny += BigInt(bandEnd - taxedPence) * BigInt(rate + surcharge);
    taxedPence = bandEnd;
  }

  // HMRC rounds the total tax down to whole pounds.
  return {pounds: Number(taxInHundredthsOfAPenny / 10_000n), firstTimeRelief};
}
