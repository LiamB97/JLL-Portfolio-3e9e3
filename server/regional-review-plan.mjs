import {reviewRegions} from '../shared/development-review.ts';
import {assignDevelopmentReview} from './development-reviews.mjs';

function parsePlan(raw) {
  const plan = JSON.parse(raw);
  if (!Number.isSafeInteger(plan?.revision) || plan.revision < 1 || !Array.isArray(plan.groups) || !plan.groups.length) {
    throw Error('Invalid regional review plan.');
  }
  const regions = new Set();
  const ids = new Set();
  for (const group of plan.groups) {
    if (!reviewRegions.includes(group?.region) || regions.has(group.region) ||
        !Array.isArray(group.consultants) || !group.consultants.length ||
        group.consultants.some(name => typeof name !== 'string' || !/^[a-z]+$/i.test(name)) ||
        new Set(group.consultants.map(name => name.toLowerCase())).size !== group.consultants.length ||
        !Array.isArray(group.developmentIds) || !group.developmentIds.length) {
      throw Error('Invalid group in regional review plan.');
    }
    regions.add(group.region);
    for (const id of group.developmentIds) {
      if (typeof id !== 'string' || ids.has(id)) throw Error('Use each published development ID once in the review plan.');
      ids.add(id);
    }
  }
  return plan;
}

function resolveConsultant(users, name) {
  const key = name.toLowerCase();
  const matches = users.filter(user => {
    const firstName = user.name?.trim().toLowerCase().split(/\s+/)[0];
    const emailPrefix = user.email?.toLowerCase().split(/[^a-z0-9]/)[0];
    return user.active && user.email && (firstName === key || emailPrefix === key);
  });
  const [user] = matches;
  return matches.length === 1 && ['admin', 'broker_admin'].includes(user.role) ? user.id : null;
}

export async function applyRegionalReviewPlan(repository, raw, now = Date.now()) {
  const plan = parsePlan(raw);
  const isNew = state => plan.revision > (state.regionalReviewPlanRevision ?? 0);
  if (!isNew(await repository.read())) return null;

  return repository.update(state => {
    if (!isNew(state)) return null;
    const stock = new Map(state.developments.filter(item => !item.sample).map(item => [item.id, item]));
    const results = [];
    for (const {region, consultants, developmentIds} of plan.groups) {
      const reviewers = consultants.map(name => ({name, id: resolveConsultant(state.users ?? [], name)}));
      const unavailable = reviewers.filter(reviewer => !reviewer.id ||
        reviewers.some(other => other !== reviewer && other.id === reviewer.id)).map(reviewer => reviewer.name);
      const reviewerIds = unavailable.length ? [] : reviewers.map(reviewer => reviewer.id);
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
      results.push({region, count: developmentIds.length, consultants: unavailable.length ? [] : consultants, unavailable});
    }
    state.regionalReviewPlanRevision = plan.revision;
    return results;
  });
}

export function regionalReviewPlanCoverage(state, raw) {
  const plan = parsePlan(raw);
  const stock = new Map(state.developments.filter(item => !item.sample).map(item => [item.id, item]));
  const reviews = state.developmentReviews ?? [];
  return plan.groups.map(({region, consultants, developmentIds}) => {
    const grouped = developmentIds.filter(id => stock.get(id)?._reviewRegion === region);
    return {
      region, expected: developmentIds.length, grouped: grouped.length,
      consultants: consultants.map(name => {
        const id = resolveConsultant(state.users ?? [], name);
        const assigned = new Set(reviews.filter(review => review.assigneeId === id).map(review => review.developmentId));
        return {name, matched: Boolean(id), count: grouped.filter(developmentId => assigned.has(developmentId)).length};
      }),
    };
  });
}
