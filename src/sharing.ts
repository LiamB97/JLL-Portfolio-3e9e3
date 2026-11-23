export {portfolioInvitation,portfolioEmail,emailHref,buyerShareLink} from '../shared/sharing';

export function personalPortfolioLink(origin: string, shareSlug: string) {
  if (!shareSlug) return '';
  const link = new URL('/', origin);
  link.searchParams.set('broker', shareSlug);
  return link.href;
}
