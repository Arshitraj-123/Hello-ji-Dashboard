export type { Hotel } from "@/types/hotel";
export type { Customer, CustomerDoc } from "@/types/customer";
export type { Role, AppUser, ActivityLog, PermissionGroup } from "@/types/role";

import type { Hotel } from "@/types/hotel";
import type { Customer } from "@/types/customer";
import type { Role, AppUser, ActivityLog } from "@/types/role";

let hotels: Hotel[] = [];
let customers: Customer[] = [];
let roles: Role[] = [];
let users: AppUser[] = [];
let logs: ActivityLog[] = [];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const adminStore = {
  subscribe,
  hotels: () => hotels,
  customers: () => customers,
  users: () => users,
  roles: () => roles,
  logs: () => logs,
  addHotel(h: Hotel) {
    hotels = [h, ...hotels];
    emit();
  },
  updateHotel(id: string, patch: Partial<Hotel>) {
    hotels = hotels.map((h) => (h.id === id ? { ...h, ...patch } : h));
    emit();
  },
  purgeHotel(id: string) {
    hotels = hotels.filter((h) => h.id !== id);
    emit();
  },
  addCustomer(c: Customer) {
    customers = [c, ...customers];
    emit();
  },
  updateCustomer(id: string, patch: Partial<Customer>) {
    customers = customers.map((c) => (c.id === id ? { ...c, ...patch } : c));
    emit();
  },
  purgeCustomer(id: string) {
    customers = customers.filter((c) => c.id !== id);
    emit();
  },
  addUser(u: AppUser) {
    users = [u, ...users];
    emit();
  },
  updateUser(id: string, patch: Partial<AppUser>) {
    users = users.map((u) => (u.id === id ? { ...u, ...patch } : u));
    emit();
  },
  removeUser(id: string) {
    users = users.filter((u) => u.id !== id);
    emit();
  },
  addRole(r: Role) {
    roles = [r, ...roles];
    emit();
  },
  updateRole(id: string, patch: Partial<Role>) {
    roles = roles.map((r) => (r.id === id ? { ...r, ...patch } : r));
    emit();
  },
  removeRole(id: string) {
    roles = roles.filter((r) => r.id !== id);
    emit();
  },
};

export function useHotels() {
  return hotels;
}
export function useCustomers() {
  return customers;
}
export function useUsers() {
  return users;
}
export function useRoles() {
  return roles;
}
export function useLogs() {
  return logs;
}

