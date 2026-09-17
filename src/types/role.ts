export type PermissionGroup = {
  group: string;
  permissions: string[];
};

export type Role = {
  id: string;
  name: string;
  description?: string | undefined;
  permissions: string[];
  isSystem?: boolean | undefined;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: "active" | "inactive";
  permissions: string[];
};

export type ActivityLog = {
  id: string;
  user: string;
  activityType: "created" | "updated" | "deleted";
  tableName: "booking" | "hotel" | "customer";
  tableId: string;
  changedData: string;
  ip: string;
  at: string;
};
