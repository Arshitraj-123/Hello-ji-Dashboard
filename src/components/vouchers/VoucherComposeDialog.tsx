import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, MessageCircle, Paperclip, Loader2 } from "lucide-react";
import type { Booking } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendBrochureEmail, sendBrochureWhatsApp } from "@/lib/brochure-api";

export function VoucherComposeDialog({
  booking,
  mode,
  open,
  onOpenChange,
  withHeader = true,
}: {
  booking: Booking;
  mode: "email" | "whatsapp";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  withHeader?: boolean;
}) {
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRecipient(mode === "email" ? booking.email : booking.phone);
    setSubject(`${booking.bookingId} · Helloji ${booking.product} voucher`);
    setMessage(
      `Hello ${booking.name},\n\nYour ${booking.product} booking is confirmed. Please find your Helloji voucher attached.\n\nBooking ID: ${booking.bookingId}\n\nHave a wonderful journey!`,
    );
    setSending(false);
  }, [booking, mode, open]);

  const send = async () => {
    if (!recipient.trim()) {
      toast.error("Recipient is required");
      return;
    }
    setSending(true);
    try {
      const targetId = booking.id || (booking as any)._id || booking.bookingId;
      if (mode === "email") {
        const res = await sendBrochureEmail(targetId, recipient, subject, message, withHeader);
        toast.success(res.message || "Brochure emailed successfully");
      } else {
        const res = await sendBrochureWhatsApp(targetId, recipient, message, withHeader);
        toast.success(res.message || "Brochure sent via WhatsApp successfully");
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send — please try again");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "email" ? (
              <Mail className="size-5" />
            ) : (
              <MessageCircle className="size-5" />
            )}
            Send voucher by {mode === "email" ? "email" : "WhatsApp"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{mode === "email" ? "Email address" : "WhatsApp number"}</Label>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={sending}
            />
          </div>

          {mode === "email" && (
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm">
            <Paperclip className="size-4 text-primary" />
            <span className="font-medium">{booking.bookingId}.pdf</span>
            <span className="ml-auto text-xs text-muted-foreground">
              Voucher attached
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sending}>
            {sending && <Loader2 className="size-4 animate-spin" />}
            {sending
              ? "Sending…"
              : `Send ${mode === "email" ? "email" : "message"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}