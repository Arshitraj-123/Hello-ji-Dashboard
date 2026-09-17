import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeleteConfirm } from "@/components/shared/DeleteConfirm";
import { authFetch } from "@/lib/auth";
import type { AppUser, Role, PermissionGroup } from "@/types/role";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "User Management | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Manage admin and agent accounts, activate or suspend users and grant granular module permissions.",
      },
      { property: "og:title", content: "User Management | Helloji Booking Desk" },
      {
        property: "og:description",
        content: "Manage agent accounts and module permissions.",
      },
    ],
  }),
  component: Users,
});

const emptyUser = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "agent",
  status: "active" as const,
  permissions: [] as string[],
};

function Users() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState(emptyUser);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes, permsRes] = await Promise.all([
        authFetch("/api/admin/users"),
        authFetch("/api/roles"),
        authFetch("/api/permissions"),
      ]);

      if (!usersRes.ok || !rolesRes.ok || !permsRes.ok) {
        throw new Error("Failed to load user administration data");
      }

      const usersData = await usersRes.json();
      const rolesData = await rolesRes.json();
      const permsData = await permsRes.json();

      setUsers(usersData.users || []);
      setRoles(rolesData.roles || []);
      setPermissionGroups(permsData.groups || permsData.permissionGroups || []);
    } catch (err: any) {
      setError(err.message || "An error occurred while loading users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const startAdd = () => {
    setEditing(null);
    setForm(emptyUser);
    setOpen(true);
  };

  const startEdit = (u: AppUser) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone,
      password: "", // password not shown or required on edit
      role: u.role || "agent",
      status: u.status,
      permissions: [...(u.permissions || [])],
    });
    setOpen(true);
  };

  const toggle = (perm: string) =>
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm],
    }));

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    if (!editing && !form.password.trim()) {
      toast.error("Password is required for new users");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const targetId = editing.id || (editing as any)._id;
        const res = await authFetch(`/api/admin/users/${targetId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            role: form.role,
            status: form.status,
            permissions: form.permissions,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || "Failed to update user");
        }
        toast.success("User updated successfully");
      } else {
        const res = await authFetch("/api/admin/users", {
          method: "POST",
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            password: form.password,
            role: form.role,
            status: form.status,
            permissions: form.permissions,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || "Failed to create user");
        }
        toast.success("User created successfully");
      }

      setOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (user: AppUser, newActive: boolean) => {
    const targetId = user.id || (user as any)._id;
    const newStatus = newActive ? "active" : "inactive";
    try {
      const res = await authFetch(`/api/admin/users/${targetId}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        throw new Error("Failed to change user status");
      }
      toast.success(`${user.name} is now ${newStatus}`);
      setUsers((prev) =>
        prev.map((u) => {
          const id = u.id || (u as any)._id;
          return id === targetId ? { ...u, status: newStatus } : u;
        })
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleDeleteUser = async (user: AppUser) => {
    const targetId = user.id || (user as any)._id;
    try {
      const res = await authFetch(`/api/admin/users/${targetId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete user");
      }
      toast.success("User removed; records safely reassigned to admin");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove user");
    }
  };

  return (
    <DashboardShell
      title="User Management"
      subtitle="Admins and agents, with the modules each one can reach."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={startAdd}>
            <Plus className="size-4 mr-1" /> Add User
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="card-surface p-6 space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => {
                const targetId = u.id || (u as any)._id;
                return (
                  <tr key={targetId} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.email} · {u.phone || "No phone"}
                      </p>
                    </td>
                    <td className="px-4 py-3 capitalize">{u.role}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {(u.permissions || []).length} granted
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={u.status === "active"}
                        onCheckedChange={(v) => handleToggleStatus(u, v)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Edit user"
                          onClick={() => startEdit(u)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <DeleteConfirm
                          title={`Remove user "${u.name}"?`}
                          description="This user will be permanently removed. Any booking or query records assigned to them will be safely reassigned to the admin."
                          confirmLabel="Remove User"
                          onConfirm={() => handleDeleteUser(u)}
                          trigger={
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Delete ${u.name}`}
                            >
                              <Trash2 className="size-4 text-primary" />
                            </Button>
                          }
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Full Name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="agent@helloji.in"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="+91 …"
              />
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="Set initial password"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Access Level / Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => {
                  setForm((f) => ({
                    ...f,
                    role: v,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="agent">Travel Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Apply Preset From Role</Label>
              <Select
                value=""
                onValueChange={(roleName) => {
                  const targetRole = roles.find((r) => r.name === roleName);
                  if (targetRole) {
                    setForm((f) => ({
                      ...f,
                      permissions: Array.from(
                        new Set([...f.permissions, ...targetRole.permissions])
                      ),
                    }));
                    toast.info(`Applied permissions from "${targetRole.name}"`);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose role preset…" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id || (r as any)._id} value={r.name}>
                      {r.name} ({r.permissions.length} perms)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-semibold">Permissions Registry</h3>
              <span className="text-xs text-muted-foreground">
                {form.permissions.length} selected
              </span>
            </div>
            {/* Permission Checkbox Grid strictly rendered from GET /api/permissions */}
            <div className="grid gap-4 sm:grid-cols-2">
              {permissionGroups.map((g) => (
                <div
                  key={g.group}
                  className="rounded-md border border-border p-3 bg-muted/20"
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.group}
                  </p>
                  <div className="space-y-2">
                    {g.permissions.map((p) => (
                      <label
                        key={p}
                        className="flex items-center gap-2 text-sm cursor-pointer select-none"
                      >
                        <Checkbox
                          checked={form.permissions.includes(p)}
                          onCheckedChange={() => toggle(p)}
                        />
                        <span>{p}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
              Save user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
