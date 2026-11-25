import type {StaffRole} from './staff-roles.ts';

export const activityPeriods = [7, 30, 90] as const;
export type ActivityPeriod = (typeof activityPeriods)[number];

export const emptyActivityCounts = () => ({
  activeDays: 0,
  staffActions: 0,
  signIns: 0,
  collectionsCreated: 0,
  shares: 0,
  visits: 0,
  developmentViews: 0,
  favourites: 0,
  whatsapp: 0,
});
export type ActivityCounts = ReturnType<typeof emptyActivityCounts>;
export type ActivityMetric = keyof ActivityCounts;
export type ActivityComparison = {current: ActivityCounts; previous: ActivityCounts};
export type ActivityBucket = {from: string; to: string; previousFrom: string; previousTo: string};
export type ActivityStaff = ActivityComparison & {
  id: string;
  name: string;
  role: StaffRole;
  active: boolean;
  lastActivityAt: string | null;
  savedPdfs: number;
  series: ActivityComparison[];
};
export type ActivityCollection = {id: string; title: string; ownerId: string; developmentIds: string[]};
export type ActivityDevelopment = {id: string; name: string; area: string};
export type ActivityLink = {
  id: string;
  ownerId: string;
  label: string;
  kind: 'personal' | 'collection' | 'campaign' | 'removed';
  collectionId?: string;
  visits: number;
};
export type ActivityOverview = {
  period: ActivityPeriod;
  range: ActivityBucket;
  startedAt: string | null;
  comparisonAvailable: boolean;
  buckets: ActivityBucket[];
  staff: ActivityStaff[];
  collections: ActivityCollection[];
  developments: ActivityDevelopment[];
  links: ActivityLink[];
  generalVisits: number;
};
