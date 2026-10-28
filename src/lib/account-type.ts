export const ACCOUNT_TYPES = ["student", "teacher"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export function accountHome(role: AccountType): "/" | "/teacher" {
  return role === "teacher" ? "/teacher" : "/";
}

export function matchesAccountType(stored: AccountType, selected: AccountType): boolean {
  return stored === selected;
}