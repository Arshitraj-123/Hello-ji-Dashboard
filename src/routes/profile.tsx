import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Camera, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { authFetch, getUser } from "@/lib/auth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Update your name, contact details and address, and change the password you use to sign in to the desk.",
      },
      { property: "og:title", content: "My Profile | Helloji Booking Desk" },
      { property: "og:description", content: "Update your details and change your password." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile fields
  const [profile, setProfile] = useState<{
    id?: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    address: string;
    photo?: string;
  }>({
    name: "",
    email: "",
    phone: "",
    role: "",
    address: "",
    photo: "",
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password fields
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/profile");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load profile");
      }
      const data = await res.json();
      const u = data.user;
      setProfile({
        id: u.id || u._id,
        name: u.name || "",
        email: u.email || "",
        phone: u.phone || "",
        role: u.role || "agent",
        address: u.address || "",
        photo: u.photo || "",
      });
      setPhotoPreview(u.photo || null);
    } catch (err: any) {
      setError(err.message || "Could not load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Profile photo must be under 5MB");
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!profile.email.trim() && !profile.phone.trim()) {
      toast.error("At least one of email or phone is required");
      return;
    }

    setSavingProfile(true);
    try {
      let res: Response;
      if (photoFile) {
        const formData = new FormData();
        formData.append("name", profile.name.trim());
        if (profile.email) formData.append("email", profile.email.trim());
        if (profile.phone) formData.append("phone", profile.phone.trim());
        if (profile.address) formData.append("address", profile.address.trim());
        formData.append("photo", photoFile);

        res = await authFetch("/api/profile", {
          method: "PUT",
          body: formData,
        });
      } else {
        res = await authFetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profile.name.trim(),
            email: profile.email.trim() || undefined,
            phone: profile.phone.trim() || undefined,
            address: profile.address.trim(),
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update profile");
      }

      // Update local storage user session
      const currentUser = getUser();
      if (currentUser && data.user) {
        localStorage.setItem(
          "helloji_user",
          JSON.stringify({
            ...currentUser,
            name: data.user.name,
            email: data.user.email,
            phone: data.user.phone,
            photo: data.user.photo,
          })
        );
      }

      toast.success("Profile saved successfully");
      setPhotoFile(null);
      fetchProfile();
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw.current) {
      toast.error("Current password is required");
      return;
    }
    if (!pw.next || pw.next.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("New passwords do not match");
      return;
    }

    setSavingPw(true);
    try {
      const res = await authFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: pw.current,
          newPassword: pw.next,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to change password");
      }

      toast.success("Password changed successfully");
      setPw({ current: "", next: "", confirm: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <DashboardShell
      title="My Profile"
      subtitle="Your account details, profile picture, and sign-in password."
      actions={
        <Button variant="outline" size="sm" onClick={fetchProfile} disabled={loading}>
          <RefreshCw className={`size-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      }
    >
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchProfile}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card-surface space-y-4 p-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="size-16 rounded-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="card-surface space-y-4 p-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleSaveProfile} className="card-surface space-y-4 p-6">
            <h2 className="text-base font-semibold">Profile details</h2>
            <div className="flex items-center gap-4">
              <div className="relative">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt={profile.name}
                    className="size-16 rounded-full object-cover border border-border"
                  />
                ) : (
                  <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                    {profile.name
                      ? profile.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()
                      : "U"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:bg-primary/90"
                  title="Change photo"
                >
                  <Camera className="size-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>
              <div>
                <p className="font-medium text-foreground">{profile.name || "User"}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{profile.role}</p>
                {photoFile && (
                  <p className="text-xs text-primary mt-0.5">New photo selected: {photoFile.name}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prof-name">Name</Label>
              <Input
                id="prof-name"
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prof-email">Email</Label>
              <Input
                id="prof-email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prof-phone">Phone</Label>
              <Input
                id="prof-phone"
                value={profile.phone}
                onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prof-address">Address</Label>
              <Textarea
                id="prof-address"
                rows={3}
                value={profile.address}
                onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                placeholder="Office or correspondence address"
              />
            </div>

            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" /> Saving...
                </>
              ) : (
                "Save profile"
              )}
            </Button>
          </form>

          <form onSubmit={handleUpdatePassword} className="card-surface space-y-4 p-6">
            <h2 className="text-base font-semibold">Change password</h2>
            <div className="space-y-2">
              <Label htmlFor="pw-current">Current password</Label>
              <Input
                id="pw-current"
                type="password"
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-next">New password</Label>
              <Input
                id="pw-next"
                type="password"
                placeholder="At least 8 characters"
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-confirm">Confirm new password</Label>
              <Input
                id="pw-confirm"
                type="password"
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                required
              />
            </div>
            <Button type="submit" disabled={savingPw}>
              {savingPw ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" /> Updating...
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        </div>
      )}
    </DashboardShell>
  );
}

