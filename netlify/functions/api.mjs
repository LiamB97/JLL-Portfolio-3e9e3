import {brochureFileRepository} from '../../server/brochure-files.mjs';
import {engagementRepository} from '../../server/engagement-store.mjs';
import {translations} from '../../server/netlify-translations.mjs';
import {network,connections} from '../../server/netlify-transport.mjs';
import {createNetlifyApi} from '../../server/netlify-api.mjs';
import {portfolioRepository} from '../../server/netlify-store.mjs';
export default async function handler(request){return createNetlifyApi({repository:portfolioRepository(),brochureFiles:brochureFileRepository(),visitorRepository:engagementRepository(),password:process.env.ADMIN_PASSWORD,network,connections,translations})(request);}
export const config={rateLimit:{windowSize:60,windowLimit:120,aggregateBy:['ip','domain']}};
