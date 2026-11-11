import {developmentReviewEmailSettings, resendDevelopmentReview, sendDevelopmentReviewReminders} from '../../server/development-reviews.mjs';
import {portfolioRepository} from '../../server/netlify-store.mjs';

export default async function handler(_request, context) {
  const {apiKey, from} = developmentReviewEmailSettings();
  if (!apiKey || !from || context?.deploy?.context !== 'production') return new Response(null, {status: 204});
  const siteUrl = new URL(context.site.url);
  siteUrl.protocol = 'https:';
  const result = await sendDevelopmentReviewReminders(portfolioRepository(), {from, siteUrl, send: resendDevelopmentReview(apiKey)});
  if (result.pending) console.warn(`${result.pending} development review email(s) will be retried.`);
  return new Response(null, {status: 204});
}

export const config = {schedule: '20 * * * *'};
