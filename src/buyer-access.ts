import {buyerShareLink} from './sharing';
import type {BrokerCard, BuyerCollection, Development} from './types';

export type BuyerLock = 'collection' | 'portfolio';

export interface BuyerPortfolio {
  developments: Development[];
  collection: BuyerCollection | null;
  broker: BrokerCard | null;
  collectionOnly: boolean;
  linkError: string;
}

export function buyerApiPath(path: string) {
  const url = new URL(path, location.origin);
  const context = new URL(buyerShareLink(location.href)).searchParams;
  for (const [key, value] of context) url.searchParams.set(key, value);
  return url.pathname + url.search;
}
