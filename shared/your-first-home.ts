export const YOUR_FIRST_HOME_SLUG = 'z7Ju149n5WthLs_-';
export const YOUR_FIRST_HOME_PHONE = '447354821292';
export const YOUR_FIRST_HOME_GUIDANCE = 'https://www.gov.uk/government/publications/your-first-home/your-first-home';
export const YOUR_FIRST_HOME_CAPS = YOUR_FIRST_HOME_GUIDANCE + '-local-authority-property-price-caps';
export const YOUR_FIRST_HOME_NOTICE = 'These developments are potential Your First Home options. Developer and development participation is not confirmed. Individual home prices, availability and scheme eligibility must be checked with our team.';
export const isYourFirstHomeSlug = (slug: unknown) => slug === YOUR_FIRST_HOME_SLUG || slug === 'your-first-home';

// GOV.UK local authority caps, updated 3 November 2026. Use the local authority,
// never a postcode district or the portfolio's approximate London sectors.
export const yourFirstHomeCaps: Record<string, number> = {
 'Barking and Dagenham':500000, Barnet:500000, Bexley:500000, Brent:500000,
 Bromley:500000, Camden:650000, 'City of London':650000, Croydon:500000,
 Ealing:500000, Enfield:500000, Greenwich:650000, Hackney:650000,
 'Hammersmith and Fulham':650000, Haringey:500000, Harrow:500000, Havering:500000,
 Hillingdon:500000, Hounslow:500000, Islington:650000, 'Kensington and Chelsea':650000,
 'Kingston upon Thames':500000, Lambeth:650000, Lewisham:650000, Merton:500000,
 Newham:650000, Redbridge:500000, 'Richmond upon Thames':500000, Southwark:650000,
 Sutton:500000, 'Tower Hamlets':650000, 'Waltham Forest':500000, Wandsworth:650000,
 Watford:420000, Westminster:650000,
};

export function yourFirstHomeIllustration(price:number, depositPercent=2.5, rate=5, years=30) {
 if (![price,depositPercent,rate,years].every(Number.isFinite) || price<=0 || price>2000000 ||
     depositPercent<2.5 || depositPercent>=80 || rate<0 || rate>20 || years<1 || years>40) return null;
 const deposit=price*depositPercent/100, equityLoan=price*.2, mortgage=price-deposit-equityLoan;
 const monthlyRate=rate/1200, payments=years*12;
 const monthlyMortgage=monthlyRate===0?mortgage/payments:mortgage*monthlyRate/(1-Math.pow(1+monthlyRate,-payments));
 return {deposit,equityLoan,mortgage,monthlyMortgage,yearSix:monthlyMortgage+equityLoan*.015/12,yearSeven:monthlyMortgage+equityLoan*.03/12};
}
