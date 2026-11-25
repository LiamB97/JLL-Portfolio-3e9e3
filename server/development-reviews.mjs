import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {reviewRegions} from '../shared/development-review.ts';
import {canReviewDevelopments} from '../shared/staff-roles.ts';
import {priceFromAfterBedroomRemoval} from '../shared/pricing.ts';
import {AccessError} from './access.mjs';
import {recordStaff} from './activity.mjs';
import {newDevelopmentReview, reviewInterval} from './development-review-record.mjs';
import {validateUnitPrices} from './model.mjs';
import {markManualEdit} from './source-review.mjs';

// Resend honours a request's idempotency key for 24 hours. Leave room for a slow invocation.
const retryWindow = 20 * 60 * 60 * 1000;
const batchSize = 4;

const developments = state => state.developments.filter(development => !development.sample);
const canTakeAssignments = user => Boolean(user?.active && user.email && canReviewDevelopments(user.role));
const activeReviewers = state => (state.users ?? []).filter(canTakeAssignments);
const summary = ({id, name, area, postcode, _reviewRegion}) => ({id, name, area, postcode, region: _reviewRegion ?? null});

export function developmentReviewWorkspace(state, actor, emailConfigured) {
  const canAssign = actor.role === 'admin';
  if (!canAssign && !canReviewDevelopments(actor.role)) {
    throw new AccessError('Development reviews require Broker admin or Development consultant access.', 403);
  }
  const stock = developments(state);
  const consultants = state.users ?? [];
  const reviews = (state.developmentReviews ?? []).flatMap(review => {
    const development = stock.find(item => item.id === review.developmentId);
    if (!development || (!canAssign && review.assigneeId !== actor.id)) return [];
    const assignee = consultants.find(user => user.id === review.assigneeId);
    return [{
      ...review,
      development: {...summary(development), bedrooms: development.bedrooms, unitPrices: development.unitPrices ?? {}},
      assigneeName: assignee?.name ?? 'Former staff member',
      assigneeActive: canTakeAssignments(assignee),
    }];
  });
  return {
    reviews,
    canAssign,
    emailConfigured,
    developments: canAssign ? stock.map(summary) : [],
    consultants: canAssign ? activeReviewers(state).map(({id, name, email}) => ({id, name, email})) : [],
  };
}

export function assignDevelopmentReview(state, body, now = Date.now()) {
  const development = developments(state).find(item => item.id === body?.developmentId);
  if (!development) throw new AccessError('Published development not found.', 404);
  const reviews = state.developmentReviews ?? [];
  const current = reviews.filter(review => review.developmentId === development.id);
  const currentAssignments = Object.fromEntries(current.map(review => [review.assigneeId, review.version]));
  const shared = body.assigneeIds !== undefined;
  const stillCurrent = shared
    ? isDeepStrictEqual(body.expectedAssignments, currentAssignments)
    : current.length < 2 && (current[0]?.version ?? null) === body.version;
  if (!stillCurrent) throw new AccessError('The assignment changed. Refresh the list and try again.', 409);

  const assigneeIds = shared ? body.assigneeIds : body.assigneeId === null ? [] : [body.assigneeId];
  const eligible = new Set([...activeReviewers(state).map(user => user.id), ...current.map(review => review.assigneeId)]);
  if (!Array.isArray(assigneeIds) || new Set(assigneeIds).size !== assigneeIds.length ||
      assigneeIds.some(id => typeof id !== 'string' || !eligible.has(id))) {
    throw new AccessError('Choose active Broker admins or Development consultants.');
  }
  if (body.region !== undefined) {
    if (body.region !== null && !reviewRegions.includes(body.region)) throw new AccessError('Choose East London, Core or PCL.');
    if (body.expectedRegion !== (development._reviewRegion ?? null)) throw new AccessError('The region changed. Refresh the list and try again.', 409);
    if (body.region === null) delete development._reviewRegion;
    else development._reviewRegion = body.region;
  }
  const selected = new Set(assigneeIds);
  state.developmentReviews = reviews.filter(review => review.developmentId !== development.id || selected.has(review.assigneeId));
  for (const assigneeId of selected) {
    if (!Object.hasOwn(currentAssignments, assigneeId)) {
      state.developmentReviews.push(newDevelopmentReview(development.id, assigneeId, now));
    }
  }
  return {ok: true};
}

function assignedReview(state, actor, body) {
  if (!canReviewDevelopments(actor.role)) {
    throw new AccessError('Development reviews require Broker admin or Development consultant access.', 403);
  }
  const reviews = (state.developmentReviews ?? []).filter(item => item.developmentId === body?.developmentId);
  const development = developments(state).find(item => item.id === body?.developmentId);
  if (!reviews.length || !development) throw new AccessError('Development review not found.', 404);
  const review = reviews.find(item => item.assigneeId === actor.id);
  if (!review) throw new AccessError('Only assigned consultants can update this review.', 403);
  if (review.version !== body.version) throw new AccessError('The review changed. Refresh the list and try again.', 409);
  return {review, development};
}

export function saveDevelopmentReviewPrices(state, actor, body) {
  const {review, development} = actor.role === 'admin'
    ? {development: developments(state).find(item => item.id === body?.developmentId)}
    : assignedReview(state, actor, body);
  if (!development) throw new AccessError('Published development not found.', 404);
  const prices = development.unitPrices ?? {};
  if (!isDeepStrictEqual(body.expectedUnitPrices, prices) || !isDeepStrictEqual(body.expectedBedrooms, development.bedrooms)) {
    throw new AccessError('The bedroom options or prices changed. Refresh the list and try again.', 409);
  }
  const removed = body.removeBedrooms === undefined ? [] : body.removeBedrooms;
  if (!Array.isArray(removed) || new Set(removed).size !== removed.length ||
      removed.some(beds => !development.bedrooms.includes(beds))) {
    throw new AccessError('Choose existing bedroom types to remove.');
  }
  const bedrooms = development.bedrooms.filter(beds => !removed.includes(beds));
  if (!bedrooms.length && removed.length) throw new AccessError('Keep at least one bedroom type on the listing.');
  let unitPrices;
  try {
    unitPrices = validateUnitPrices(body.unitPrices, bedrooms);
  } catch (error) {
    throw new AccessError(error.message);
  }
  if (!removed.length && isDeepStrictEqual(unitPrices, prices)) return {ok: true};
  const index = state.developments.indexOf(development);
  const priceFrom = priceFromAfterBedroomRemoval(development, bedrooms, unitPrices);
  state.developments[index] = markManualEdit(development, {bedrooms, unitPrices, priceFrom}, actor);
  if (review) review.version = randomUUID();
  recordStaff(state, actor, 'stock_edit', {id: development.id, label: development.name});
  return {ok: true};
}

export function confirmDevelopmentReview(state, actor, body, now = Date.now()) {
  const {review} = assignedReview(state, actor, body);
  Object.assign(review, {version: randomUUID(), lastConfirmedAt: now, nextReminderAt: now + reviewInterval});
  delete review.lastFailureAt;
  return {ok: true};
}

function sameCycle(review, job, cycle) {
  return review.developmentId === cycle.developmentId && review.assigneeId === job.assigneeId &&
    review.version === cycle.version && review.nextReminderAt === cycle.nextReminderAt;
}

function currentJob(state, job) {
  return activeReviewers(state).some(user => user.id === job.assigneeId && user.email === job.to) &&
    job.cycles.every(cycle => developments(state).some(d => d.id === cycle.developmentId) &&
      (state.developmentReviews ?? []).some(review => sameCycle(review, job, cycle)));
}

function finishJob(state, job, time, delivered) {
  for (const cycle of job.cycles) {
    const review = (state.developmentReviews ?? []).find(item => sameCycle(item, job, cycle));
    if (!review) continue;
    review.nextReminderAt = time + reviewInterval;
    if (delivered) {
      review.lastReminderAt = time;
      delete review.lastFailureAt;
    } else review.lastFailureAt = time;
  }
  state.developmentReviewMail = (state.developmentReviewMail ?? []).filter(item => item.id !== job.id);
}

function dueDigests(state, time) {
  const stock = new Map(developments(state).map(development => [development.id, development]));
  const staff = new Map(activeReviewers(state).map(user => [user.id, user]));
  const digests = new Map();
  for (const review of state.developmentReviews ?? []) {
    const consultant = staff.get(review.assigneeId), development = stock.get(review.developmentId);
    if (!consultant || !development || review.nextReminderAt > time) continue;
    if (!digests.has(consultant.id)) digests.set(consultant.id, {consultant, items: []});
    digests.get(consultant.id).items.push({review, development});
  }
  return digests;
}

function queueDigests(state, time, from, workspaceUrl) {
  state.developmentReviewMail ??= [];
  for (const job of state.developmentReviewMail) {
    if (time - job.queuedAt >= retryWindow || !currentJob(state, job)) finishJob(state, job, time, false);
  }
  const queued = new Set(state.developmentReviewMail.map(job => job.assigneeId));
  for (const {consultant, items} of dueDigests(state, time).values()) {
    if (state.developmentReviewMail.length >= batchSize) break;
    if (queued.has(consultant.id)) continue;
    const names = items.map(({development}) => `• ${development.name} (${development.area}, ${development.postcode})`).join('\n');
    state.developmentReviewMail.push({
      id: randomUUID(), assigneeId: consultant.id, queuedAt: time, from, to: consultant.email,
      subject: 'JLL portfolio development details due for review',
      text: `Hi ${consultant.name},\n\nPlease check the published description, pricing and availability. Use Bedroom prices to enter confirmed starting prices by bedroom type and arrange any other corrections with a stock manager before confirming the review.\n\n${names}\n\nOpen Development reviews: ${workspaceUrl}\n`,
      cycles: items.map(({review: {developmentId, version, nextReminderAt}}) => ({developmentId, version, nextReminderAt})),
    });
  }
  return state.developmentReviewMail.slice(0, batchSize);
}

export async function sendDevelopmentReviewReminders(repository, {send, from, siteUrl, now = Date.now}) {
  const time = now(), state = await repository.read();
  if (!state.developmentReviewMail?.length && !dueDigests(state, time).size) return {sent: 0, pending: 0};
  const workspaceUrl = new URL('/?staff=reviews#admin', siteUrl).href;
  const jobs = await repository.update(next => queueDigests(next, time, from, workspaceUrl));
  let sent = 0, pending = 0;
  for (const job of jobs) {
    const current = await repository.read();
    if (!current.developmentReviewMail?.some(item => item.id === job.id) || !currentJob(current, job)) continue;
    try {
      await send(job);
    } catch {
      pending++;
      continue;
    }
    await repository.update(next => finishJob(next, job, now(), true));
    sent++;
  }
  return {sent, pending};
}

export function developmentReviewEmailSettings() {
  const get = name => globalThis.Netlify?.env?.get(name) ?? process.env[name];
  return {apiKey: get('DEVELOPMENT_REVIEW_RESEND_API_KEY'), from: get('DEVELOPMENT_REVIEW_FROM')};
}

export function resendDevelopmentReview(apiKey, fetchEmail = fetch) {
  return async ({id, from, to, subject, text}) => {
    const response = await fetchEmail('https://api.resend.com/emails', {
      method: 'POST',
      headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `development-review/${id}`},
      body: JSON.stringify({from, to: [to], subject, text}),
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) throw Error(`Email provider returned ${response.status}`);
  };
}
