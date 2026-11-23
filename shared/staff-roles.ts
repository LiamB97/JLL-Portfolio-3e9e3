export const staffRoleLabels = {
  broker: 'Broker',
  broker_admin: 'Broker admin',
  development_consultant: 'Development consultant',
  admin: 'Admin',
} as const;

export type StaffRole = keyof typeof staffRoleLabels;

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && Object.hasOwn(staffRoleLabels, value);
}

export const canReviewDevelopments = (role: StaffRole | undefined) =>
  role === 'broker_admin' || role === 'development_consultant';

export const canManagePortfolioStock = (role: StaffRole) =>
  role === 'admin' || role === 'broker_admin';

export const canUseBuyerTools = (role: StaffRole) =>
  role === 'broker' || canManagePortfolioStock(role);
