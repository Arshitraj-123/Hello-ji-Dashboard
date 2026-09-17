import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plane, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { login } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in | Helloji Booking Desk" },
      {
        name: "description",
        content:
          "Sign in to the Helloji travel agency booking desk to manage enquiries, hotel, ticket, package, visa and insurance bookings.",
      },
      { property: "og:title", content: "Sign in | Helloji Booking Desk" },
      {
        property: "og:description",
        content: "Travel agency CRM for enquiries, bookings and customer records.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      toast.error("Please enter both identifier and password");
      return;
    }

    setIsLoading(true);
    try {
      const { user } = await login(identifier.trim(), password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden brand-gradient lg:block">
        <div className="flex h-full flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary-foreground/15">
              <Plane className="size-6" />
            </span>
            <span className="font-display text-xl font-bold">Helloji</span>
          </div>
          <div>
            <h2 className="max-w-md font-display text-4xl font-bold leading-tight">
              Every enquiry, booking and voucher in one desk.
            </h2>
            <p className="mt-4 max-w-md opacity-85">
              Track queries from first call to confirmed booking — hotels, tickets, packages,
              visas and insurance, all under one roof.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6 border-t border-primary-foreground/25 pt-6 text-sm">
            <div>
              <p className="font-display text-2xl font-bold">17</p>
              <p className="opacity-80">Live bookings</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold">3</p>
              <p className="opacity-80">Active agents</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold">24/7</p>
              <p className="opacity-80">Duty manager</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <div className="card-surface w-full max-w-md p-8">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-md brand-gradient">
              <Plane className="size-5 text-primary-foreground" />
            </span>
            <span className="font-display text-lg font-bold">Helloji</span>
          </div>
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to access your bookings and enquiries.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="login">Email or phone</Label>
              <Input
                id="login"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@helloji.in or +91..."
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <Checkbox defaultChecked /> Remember me
              </label>
              <span className="text-muted-foreground text-xs">HelloJi Security</span>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-6 rounded-md border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Lock className="size-3 shrink-0" />
              <span>
                <span className="font-medium text-foreground">Demo access</span> — email:{" "}
                <code className="font-mono">admin@helloji.in</code>, password:{" "}
                <code className="font-mono">changeme123</code>
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
