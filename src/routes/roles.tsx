import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Shield, Check, Users, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DeleteConfirm } from "@/components/shared/DeleteConfirm";
import { authFetch } from "@/lib/auth";
import type { Role, AppUser, PermissionGroup } from "@/types/role";

export const Route = createFileRoute("/roles")({
  head: () => ({
    meta: [
      { title: "Roles & Permissions | Helloji Booking Desk" },
      { name: "description", content: "Manage system roles and reusable permission bundles across all modules." },
      { property: "og:title", content: "Roles & Permissions | Helloji Booking Desk" },
      { property: "og:description", content: "Configure reusable permission bundles for staff and agents." },
    ],
  }),
  component: RolesPage,
});

const emptyRoleForm = {
  name: "",
  description: "",
  permissions: [] as string[],
};

function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState<Omit<Role, "id">>(emptyRoleForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, usersRes, permRes] = await Promise.all([
        authFetch("/api/roles"),
        authFetch("/api/admin/users"),
        authFetch("/api/permissions"),
      ]);

      if (!rolesRes.ok) {
        const err = await rolesRes.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load roles");
      }

      const rolesData = await rolesRes.json();
      const rawRoles = rolesData.roles || [];
      const mappedRoles: Role[] = rawRoles.map((r: any) => ({
        id: r.id || r._id,
        name: r.name,
        description: r.description,
        permissions: r.permissions || [],
        isSystem: !!r.isSystem,
      }));
      setRoles(mappedRoles);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(
          (usersData.users || []).map((u: any) => ({
            id: u.id || u._id,
            name: u.name,
            email: u.email,
            phone: u.phone || "",
            role: u.role,
            status: u.status,
            permissions: u.permissions || [],
          }))
        );
      }

      if (permRes.ok) {
        const permData = await permRes.json();
        const groups: PermissionGroup[] = permData.permissionGroups || permData.groups || [];
        setPermissionGroups(groups);
        setAllPermissions(permData.permissions || groups.flatMap((g) => g.permissions));
      }
    } catch (err: any) {
      setError(err.message || "Could not connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startAdd = () => {
    setEditing(null);
    setForm(emptyRoleForm);
    setOpen(true);
  };

  const startEdit = (role: Role) => {
    setEditing(role);
    setForm({
      name: role.name,
      description: role.description || "",
      permissions: [...role.permissions],
      isSystem: role.isSystem,
    });
    setOpen(true);
  };

  const toggle = (perm: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm],
    }));
  };

  const toggleGroup = (groupPermissions: string[]) => {
    const allSelected = groupPermissions.every((p) => form.permissions.includes(p));
    setForm((f) => ({
      ...f,
      permissions: allSelected
        ? f.permissions.filter((p) => !groupPermissions.includes(p))
        : Array.from(new Set([...f.permissions, ...groupPermissions])),
    }));
  };

  const selectAll = () => {
    setForm((f) => ({
      ...f,
      permissions: [...allPermissions],
    }));
  };

  const clearAll = () => {
    setForm((f) => ({
      ...f,
      permissions: [],
    }));
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Role name is required");
      return;
    }
    setSubmitting(true);
    try {
      const url = editing ? `/api/roles/${editing.id}` : "/api/roles";
      const method = editing ? "PUT" : "POST";
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description?.trim() || "",
          permissions: form.permissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save role");
      }

      toast.success(editing ? `Role "${form.name}" updated` : `Role "${form.name}" created`);
      setOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save role");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (role: Role) => {
    try {
      const res = await authFetch(`/api/roles/${role.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete role");
      }
      toast.success(`Role "${role.name}" deleted`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete role");
    }
  };

  return (
    <DashboardShell
      title="Roles & Permissions"
      subtitle="Reusable named bundles of permissions for queries, bookings, hotels, customers, and administration."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchData} title="Refresh roles">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={startAdd}>
            <Plus className="size-4 mr-1" /> Add Role
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="card-surface space-y-4 p-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Permissions Granted</th>
                <th className="px-4 py-3">Assigned Users</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No roles found. Click &quot;Add Role&quot; to create one.
                  </td>
                </tr>
              ) : (
                roles.map((role) => {
                  const assignedUsers = users.filter(
                    (u) =>
                      u.role?.toLowerCase() === role.name.toLowerCase() ||
                      (role.name.toLowerCase() === "administrator" && u.role?.toLowerCase() === "admin") ||
                      (role.name.toLowerCase() === "travel agent" && u.role?.toLowerCase() === "agent")
                  );

                  return (
                    <tr key={role.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Shield className="size-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-foreground">{role.name}</p>
                              {role.isSystem && (
                                <Badge variant="outline" className="text-[10px] font-normal tracking-wide text-muted-foreground">
                                  System
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{role.permissions.length} active permissions</p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[280px] px-4 py-3 text-xs text-muted-foreground">
                        {role.description || "No description provided."}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{
                                width: `${Math.round(
                                  (role.permissions.length / Math.max(allPermissions.length || 1, 1)) * 100
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">
                            {role.permissions.length} / {allPermissions.length || role.permissions.length}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="size-3.5" />
                          <span>
                            {assignedUsers.length} {assignedUsers.length === 1 ? "user" : "users"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Edit ${role.name} role`}
                            onClick={() => startEdit(role)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          {role.isSystem ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled
                              title="System roles cannot be deleted"
                              aria-label="System role cannot be deleted"
                            >
                              <Trash2 className="size-4 text-muted-foreground/40" />
                            </Button>
                          ) : (
                            <DeleteConfirm
                              title={`Delete "${role.name}" Role?`}
                              description="Are you sure you want to delete this role? Any users currently assigned this role will keep their individual granted permissions, but the role bundle will be permanently removed."
                              confirmLabel="Delete Role"
                              onConfirm={() => handleDelete(role)}
                              trigger={
                                <Button size="icon" variant="ghost" aria-label={`Delete ${role.name} role`}>
                                  <Trash2 className="size-4 text-destructive" />
                                </Button>
                              }
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Role: ${editing.name}` : "Create New Role"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                placeholder="e.g. Accounts Officer, Reservation Manager"
                value={form.name}
                disabled={editing?.isSystem}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              {editing?.isSystem && (
                <p className="text-xs text-muted-foreground">System role names cannot be modified.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">Description (Optional)</Label>
              <Input
                id="role-desc"
                placeholder="Brief summary of duties and access level"
                value={form.description || ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-2 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
              <div>
                <h3 className="text-sm font-semibold">Permissions</h3>
                <p className="text-xs text-muted-foreground">
                  {form.permissions.length} of {allPermissions.length} permissions granted
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                  <Check className="size-3.5 mr-1" /> Select All
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                  Clear All
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {permissionGroups.map((g) => {
                const groupSelectedCount = g.permissions.filter((p) => form.permissions.includes(p)).length;
                const isAllSelected = groupSelectedCount === g.permissions.length;

                return (
                  <div key={g.group} className="rounded-md border border-border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.group}{" "}
                        <span className="text-[11px] font-normal lowercase">
                          ({groupSelectedCount}/{g.permissions.length})
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.permissions)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        {isAllSelected ? "Unselect all" : "Select all"}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {g.permissions.map((p) => (
                        <label key={p} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                          <Checkbox
                            checked={form.permissions.includes(p)}
                            onCheckedChange={() => toggle(p)}
                          />
                          <span>{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={save} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" /> Saving...
                </>
              ) : editing ? (
                "Save changes"
              ) : (
                "Create role"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

