export interface BookingTicket {
  _id: string;
  btId: string;
  date: string;
  guestName: string;
  createdBy: string;
  saleBy: string;
  approvedBy: string;
  sp: string;
  product: string;
  detail: string;
  remark: string;
  status: "unapproved" | "approved";
  approvedAt?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}
