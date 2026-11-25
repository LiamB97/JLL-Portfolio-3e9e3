import {reviewRegions} from '../shared/development-review.ts';
import {canReviewDevelopments} from '../shared/staff-roles.ts';
import {assignDevelopmentReview} from './development-reviews.mjs';

function validConsultant(value) {
  if (typeof value !== 'string') return false;
  return value.includes('@')
    ? value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    : value.length <= 100 && /^[a-z][a-z .’'-]*$/i.test(value);
}

function parsePlan(raw) {
  const plan = JSON.parse(raw);
  if (!Number.isSafeInteger(plan?.revision) || plan.revision < 1 || !Array.isArray(plan.groups) || !plan.groups.length) {
    throw Error('Invalid regional review plan.');
  }
  const regions = new Set();
  const ids = new Set();
  for (const group of plan.groups) {
    const hasIds = Array.isArray(group?.developmentIds) && group.developmentIds.length > 0;
    const usesCurrentRegion = group?.allInRegion === true && group.developmentIds === undefined;
    if (!reviewRegions.includes(group?.region) || regions.has(group.region) ||
        !Array.isArray(group.consultants) || !group.consultants.length ||
        group.consultants.some(name => !validConsultant(name)) ||
        new Set(group.consultants.map(name => name.toLowerCase())).size !== group.consultants.length ||
        (group.allInRegion !== undefined && group.allInRegion !== true) ||
        (!usesCurrentRegion && (!hasIds || group.allInRegion === true))) {
      throw Error('Invalid group in regional review plan.');
    }
    regions.add(group.region);
    for (const id of group.developmentIds ?? []) {
      if (typeof id !== 'string' || ids.has(id)) throw Error('Use each published development ID once in the review plan.');
      ids.add(id);
    }
  }
  return plan;
}

function matchesConsultant(person, name) {
  if (!person.email) return false;
  const key = name.toLowerCase();
  if (key.includes('@')) return person.email.toLowerCase() === key;
  if (/\s/.test(key)) {
    const normalise = value => (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalise(person.name) === normalise(key) || normalise(person.email.split('@')[0]) === normalise(key);
  }
  const firstName = person.name?.trim().toLowerCase().split(/\s+/)[0];
  const emailPrefix = person.email?.toLowerCase().split(/[^a-z0-9]/)[0];
  return firstName === key || emailPrefix === key;
}

function resolveConsultant(users, name) {
  const matches = users.filter(user => user.active && matchesConsultant(user, name));
  const [user] = matches;
  return matches.length === 1 && canReviewDevelopments(user.role) ? user.id : null;
}

function resolveInvitation(state, name, now) {
  const matches = (state.invites ?? []).filter(invite => invite.expiresAt > now && matchesConsultant(invite, name));
  const [invite] = matches;
  return matches.length === 1 && canReviewDevelopments(invite.role) ? invite : null;
}

function developmentIdsForGroup(group, stock) {
  if (!group.allInRegion) return group.developmentIds;
  return [...stock.values()].filter(item => item._reviewRegion === group.region).map(item => item.id);
}

export async function applyRegionalReviewPlan(repository, raw, now = Date.now()) {
  const plan = parsePlan(raw);
  const isNew = state => plan.revision > (state.regionalReviewPlanRevision ?? 0);
  if (!isNew(await repository.read())) return null;

  return repository.update(state => {
    if (!isNew(state)) return null;
    const stock = new Map(state.developments.filter(item => !item.sample).map(item => [item.id, item]));
    const groups = plan.groups.map(group => ({...group, developmentIds: developmentIdsForGroup(group, stock)}));
    const targets = groups.flatMap(group => group.developmentIds);
    if (groups.some(group => !group.developmentIds.length) || new Set(targets).size !== targets.length) {
      throw Error('Review groups must target nonempty, distinct sets of published developments.');
    }
    const results = [];
    for (const {region, consultants, developmentIds, allInRegion} of groups) {
      const reviewers = consultants.map(name => {
        const id = resolveConsultant(state.users ?? [], name);
        return {name, id, invite: id || allInRegion ? null : resolveInvitation(state, name, now)};
      });
      const active = reviewers.filter(reviewer => reviewer.id &&
        reviewers.filter(other => other.id === reviewer.id).length === 1);
      if (allInRegion && active.length !== consultants.length) {
        throw Error(`Every reviewer for ${region} must match a distinct, active review account.`);
      }
      const pending = reviewers.filter(reviewer => reviewer.invite &&
        reviewers.filter(other => other.invite === reviewer.invite).length === 1);
      const reviewerIds = active.map(reviewer => reviewer.id);
      for (const developmentId of developmentIds) {
        const development = stock.get(developmentId);
        if (!development) throw Error('The regional review plan includes stock that is no longer published.');
        const current = (state.developmentReviews ?? []).filter(review => review.developmentId === developmentId);
        assignDevelopmentReview(state, {
          developmentId, region, expectedRegion: development._reviewRegion ?? null,
          assigneeIds: [...new Set([...current.map(review => review.assigneeId), ...reviewerIds])],
          expectedAssignments: Object.fromEntries(current.map(review => [review.assigneeId, review.version])),
        }, now);
      }
      for (const {invite} of pending) {
        const previous = new Map((invite._reviewDevelopments ?? []).map(entry => [entry.id, entry]));
        for (const id of developmentIds) previous.set(id, {id, region});
        invite._reviewDevelopments = [...previous.values()];
      }
      results.push({
        region, count: developmentIds.length,
        consultants: active.map(reviewer => reviewer.name),
        pending: pending.map(reviewer => reviewer.name),
        unavailable: reviewers.filter(reviewer => !active.includes(reviewer) && !pending.includes(reviewer)).map(reviewer => reviewer.name),
      });
    }
    state.regionalReviewPlanRevision = plan.revision;
    return results;
  });
}

export function regionalReviewPlanCoverage(state, raw, now = Date.now()) {
  const plan = parsePlan(raw);
  const stock = new Map(state.developments.filter(item => !item.sample).map(item => [item.id, item]));
  const reviews = state.developmentReviews ?? [];
  return plan.groups.map(group => {
    const {region, consultants, allInRegion} = group;
    const developmentIds = developmentIdsForGroup(group, stock);
    const grouped = developmentIds.filter(id => stock.get(id)?._reviewRegion === region);
    return {
      region, expected: developmentIds.length, grouped: grouped.length,
      consultants: consultants.map(name => {
        const id = resolveConsultant(state.users ?? [], name);
        const assigned = new Set(reviews.filter(review => review.assigneeId === id).map(review => review.developmentId));
        const invitation = id || allInRegion ? null : resolveInvitation(state, name, now);
        const queued = new Set((invitation?._reviewDevelopments ?? []).filter(entry => entry.region === region).map(entry => entry.id));
        return {
          name, matched: Boolean(id), count: grouped.filter(developmentId => assigned.has(developmentId)).length,
          queued: grouped.filter(developmentId => queued.has(developmentId)).length,
        };
      }),
    };
  });
}
