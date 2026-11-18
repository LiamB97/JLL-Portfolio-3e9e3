import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import snapshot from './data/initial-portfolio.json' with {type:'json'};

const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const sessionSeconds = 24 * 60 * 60;
const attemptWindow = 15 * 60 * 1000;
const maxAttempts = 6;
const portfolioCookie = 'jll_buyer_portfolio';
const revision = () => randomBytes(16).toString('base64url');
const snapshotIds = snapshot.developments.filter(row => row.source === 'JLL website').map(row => row.id);

export class BuyerAccessError extends Error {
  constructor(message, status = 422, scope) {
    super(message);
    this.status = status;
    this.scope = scope;
  }
}

function ensureKey(state) {
  state.buyerAccess ??= {};
  state.buyerAccess.key ??= randomBytes(32).toString('base64url');
}

function mac(state, parts) {
  return createHmac('sha256', state.buyerAccess.key).update(JSON.stringify(parts)).digest();
}

function sharePassword(state, type, id, version) {
  if (!state.buyerAccess?.key || !version) return null;
  const code = [...mac(state, ['password', type, id, version]).subarray(0, 8)]
    .map(byte => alphabet[byte & 31]).join('');
  return code.slice(0, 4) + '-' + code.slice(4);
}

function brokerVersion(state, user) {
  const policy = state.buyerAccess?.portfolioVersion;
  return policy && user._buyerPasswordVersion ? policy + '.' + user._buyerPasswordVersion : null;
}

export function brokerPortfolioPassword(state, user) {
  return user?.active ? sharePassword(state, 'portfolio', user.id, brokerVersion(state, user)) : null;
}

export function issueBrokerPassword(state, user, rotate = false) {
  if (!state.buyerAccess?.portfolioVersion || !user.active || (!rotate && user._buyerPasswordVersion)) return;
  const used = new Set((state.users ?? []).map(broker => brokerPortfolioPassword(state, broker)).filter(Boolean));
  do {
    user._buyerPasswordVersion = revision();
  } while (used.has(brokerPortfolioPassword(state, user)));
}

function setPortfolioProtection(state, enabled) {
  if (enabled === Boolean(state.buyerAccess?.portfolioVersion)) return;
  if (!enabled) {
    delete state.buyerAccess.portfolioVersion;
    return;
  }
  ensureKey(state);
  state.buyerAccess.portfolioVersion = revision();
  for (const user of state.users ?? []) issueBrokerPassword(state, user, true);
}

export function updateBuyerAccessSettings(state, body) {
  if (!body || (body.enabled === undefined && body.instructedOnly === undefined) ||
      [body.enabled, body.instructedOnly].some(value => value !== undefined && typeof value !== 'boolean')) {
    throw new BuyerAccessError('Choose valid buyer access settings.');
  }
  if (body.enabled !== undefined) setPortfolioProtection(state, body.enabled);
  if (body.instructedOnly !== undefined) {
    state.buyerAccess ??= {};
    state.buyerAccess.instructedOnly = body.instructedOnly;
  }
}

export function portfolioProtectionSettings(state) {
  const enabled = Boolean(state.buyerAccess?.portfolioVersion);
  return {
    enabled,
    instructedOnly: state.buyerAccess?.instructedOnly === true,
    brokers: enabled ? (state.users ?? []).filter(user => user.active).map(user => ({
      id: user.id, name: user.name, password: brokerPortfolioPassword(state, user),
    })) : [],
  };
}

export function collectionPassword(state, collection) {
  return sharePassword(state, 'collection', collection.id, collection._buyerPasswordVersion);
}

export function updateCollectionPassword(state, collection, action) {
  if (action === undefined) return;
  if (action === 'remove') {
    delete collection._buyerPasswordVersion;
    return;
  }
  if (action !== 'protect' && action !== 'rotate') throw new BuyerAccessError('Choose a valid collection password action.');
  if (action === 'protect' && collection._buyerPasswordVersion) return;
  if (action === 'rotate' && !collection._buyerPasswordVersion) throw new BuyerAccessError('Turn on collection password protection first.', 409);
  ensureKey(state);
  const previous = collectionPassword(state, collection);
  do {
    collection._buyerPasswordVersion = revision();
  } while (previous === collectionPassword(state, collection));
}

export function privateCollection(state, collection) {
  const {_buyerPasswordVersion, ...fields} = collection;
  const owner = (state.users ?? []).find(user => user.id === collection.ownerId);
  return {
    ...fields, passwordProtected: Boolean(_buyerPasswordVersion),
    password: collectionPassword(state, collection) ?? brokerPortfolioPassword(state, owner),
  };
}

function readCookie(request, name) {
  const prefix = name + '=';
  return (request.headers.get('cookie') ?? '').split(';').map(value => value.trim())
    .find(value => value.startsWith(prefix))?.slice(prefix.length) ?? '';
}

function grantCookieName(scope, id) {
  return scope === 'collection' ? 'jll_buyer_collection_' + id : portfolioCookie;
}

function grantSignature(state, scope, id, version, expires) {
  return mac(state, ['grant', scope, id, version, expires]).toString('base64url');
}

function grantMatches(state, scope, token, id, version, now) {
  if (!state.buyerAccess?.key || !version || !token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [holder, expires, signed] = parts;
  if (holder !== id || !/^\d{10,14}$/.test(expires) || Number(expires) <= now || !/^[\w-]{43}$/.test(signed)) return false;
  return timingSafeEqual(Buffer.from(signed), Buffer.from(grantSignature(state, scope, id, version, expires)));
}

function hasPortfolioGrant(state, request, owner, now) {
  const token = readCookie(request, portfolioCookie);
  if (!token) return false;
  const holder = (state.users ?? []).find(user => user.active && user.id === token.split('.', 1)[0]);
  return Boolean(holder && (!owner || owner.id === holder.id) &&
    grantMatches(state, 'portfolio', token, holder.id, brokerVersion(state, holder), now));
}

export function buyerContext(state, request, target, staff = null, now = Date.now()) {
  const users = state.users ?? [];
  const collection = target.collection ? (state.collections ?? []).find(row => row.slug === target.collection) : null;
  const owner = collection ? users.find(user => user.active && user.id === collection.ownerId) : null;
  const selectedCollection = owner ? collection : null;
  const broker = target.collection ? owner : target.broker
    ? users.find(user => user.active && user.whatsapp && user.shareSlug === target.broker) : null;
  const linkError = target.collection && !selectedCollection ? 'This collection is no longer available.'
    : !target.collection && target.broker && !broker ? 'This broker link is unavailable.' : '';
  const view = {collection: selectedCollection, broker: broker ?? null, linkError, collectionOnly: false, required: null};

  if (selectedCollection?._buyerPasswordVersion && staff?.role !== 'admin' && staff?.id !== owner.id) {
    const token = readCookie(request, grantCookieName('collection', selectedCollection.id));
    if (!grantMatches(state, 'collection', token, selectedCollection.id, selectedCollection._buyerPasswordVersion, now)) {
      return {...view, required: 'collection'};
    }
  }
  if (staff || !state.buyerAccess?.portfolioVersion || hasPortfolioGrant(state, request, broker, now)) return view;
  if (selectedCollection?._buyerPasswordVersion) return {...view, collectionOnly: true};
  return {...view, required: 'portfolio'};
}

export function requireBuyerAccess(context) {
  if (context.required) throw new BuyerAccessError('A password is required to open this link.', 423, context.required);
}

export function buyerDevelopments(state, context) {
  requireBuyerAccess(context);
  const selected = context.collectionOnly ? new Set(context.collection.developmentIds) : null;
  const instructed = state.buyerAccess?.instructedOnly
    ? new Set(state.lastSync?.websiteDevelopmentIds ?? snapshotIds) : null;
  if (!selected && !instructed) return state.developments;
  return state.developments.filter(development => (!selected || selected.has(development.id)) &&
    (!instructed || instructed.has(development.id)));
}

function fitsPassword(expected, supplied) {
  if (!expected || typeof supplied !== 'string' || supplied.length > 24) return false;
  const code = supplied.trim().toUpperCase().replace(/[-\s]/g, '');
  return /^[A-Z2-9]{8}$/.test(code) && timingSafeEqual(Buffer.from(expected.replace('-', '')), Buffer.from(code));
}

function makeGrant(state, request, scope, id, version, now) {
  const expires = String(now + sessionSeconds * 1000);
  const token = id + '.' + expires + '.' + grantSignature(state, scope, id, version, expires);
  return grantCookieName(scope, id) + '=' + token + '; Path=/api; HttpOnly; SameSite=Lax; Max-Age=' +
    sessionSeconds + (new URL(request.url).protocol === 'https:' ? '; Secure' : '');
}

export async function unlockBuyerLink(repository, {request, target, password, ip, staffUser, now = Date.now()}) {
  const state = await repository.read();
  const context = buyerContext(state, request, target, staffUser(state), now);
  if (!context.required) return null;
  const scope = context.required;
  const challenge = scope === 'collection' ? context.collection.id : context.broker?.id ?? 'general';
  const version = scope === 'collection' ? context.collection._buyerPasswordVersion
    : context.broker ? brokerVersion(state, context.broker) : state.buyerAccess.portfolioVersion;
  const key = createHash('sha256').update(JSON.stringify([ip || 'unknown', scope, challenge, version])).digest('hex');
  const tooMany = () => new BuyerAccessError('Too many attempts. Try again in 15 minutes.', 429);
  const failure = (state.buyerPasswordAttempts ?? []).find(attempt => attempt.key === key && attempt.until > now);
  if (failure?.count >= maxAttempts) throw tooMany();

  if (scope === 'collection') {
    const collection = context.collection;
    if (fitsPassword(collectionPassword(state, collection), password)) {
      return makeGrant(state, request, scope, collection.id, collection._buyerPasswordVersion, now);
    }
  } else {
    const users = context.broker ? [context.broker] : (state.users ?? []);
    const broker = users.find(user => fitsPassword(brokerPortfolioPassword(state, user), password));
    if (broker) return makeGrant(state, request, scope, broker.id, brokerVersion(state, broker), now);
  }

  await repository.update(current => {
    current.buyerPasswordAttempts = (current.buyerPasswordAttempts ?? []).filter(attempt => attempt.until > now);
    let attempt = current.buyerPasswordAttempts.find(item => item.key === key);
    if (attempt?.count >= maxAttempts) throw tooMany();
    if (!attempt) {
      attempt = {key, count: 0, until: now + attemptWindow};
      current.buyerPasswordAttempts.push(attempt);
    }
    attempt.count++;
    current.buyerPasswordAttempts = current.buyerPasswordAttempts.slice(-500);
  });
  throw new BuyerAccessError('Incorrect password. Please try again.', 401);
}
