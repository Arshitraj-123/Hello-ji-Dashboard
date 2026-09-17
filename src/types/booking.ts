export type Product =
  | "hotel"
  | "ticket"
  | "package"
  | "visa"
  | "insurance"
  | "Other"
  | "other";

export type Status =
  | "New Query"
  | "Pipeline"
  | "Confirmed"
  | "confirmed"
  | "booked"
  | "Abort";

export type BookingNote = {
  id: string;
  bookingId?: string;
  user:
    | string
    | {
        id?: string;
        _id?: string;
        name: string;
        email?: string;
        role?: string;
        photoUrl?: string | null;
      };
  note: string;
  at?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PopulatedUser = {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role?: string;
  photoUrl?: string | null;
};

export type Booking = {
  id: string;
  _id?: string;
  bookingId: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  enquiryType?: "B2B" | "Corporate" | "B2C";
  enqueryType?: "B2B" | "Corporate" | "B2C";
  destination: "Domestic" | "International";
  product: Product;
  priority: "Urgent" | "Normal";
  status: Status;
  date: string;
  details: string;

  // Auto-set hidden fields (original spec)
  bookingPolicy: string;
  dmName: string;
  dmContact: string;
  specialRequest: string;

  // Hotel & Package Common Attributes (approved)
  hotelConfirmationNo?: string;
  startDate?: string;
  endDate?: string;
  noOfRooms?: string;
  noRoom?: string; // UI alias
  noOfAdults?: string;
  adults?: string; // UI alias
  noOfChildren?: string;
  children?: string; // UI alias
  noOfExtraBed?: string;
  extraBed?: string; // UI alias
  mealPlan?: string;
  roomType?: string;
  propertyName?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  propertyAddress?: string;

  // Package Additions (approved)
  packageName?: string;
  duration?: string;
  inclusion?: string;

  // Ticket & Flight Additions (approved: distinct airlinePnr AND gdsPnr)
  airlineName?: string;
  flightNumber?: string;
  sectorName?: string;
  airlinePnr?: string;
  gdsPnr?: string;
  timeOnward?: string;
  timeReturn?: string;
  noOfInfant?: string;
  infants?: string; // UI alias

  // Visa & Insurance Additions (approved)
  visaType?: string;
  visaReference?: string;
  insuranceType?: string;
  insurancePolicyNo?: string;
  insuranceCoverage?: string;

  // Accounts & Billing (approved: exact original PDF fields)
  billingStatus?: "Paid" | "Unpaid" | "";
  billingNumber?: string;
  billingDate?: string;
  billingRemark?: string;

  // Ownership & Access Control
  createdBy: string | PopulatedUser;
  assignedAgent: string | PopulatedUser;
  notes?: BookingNote[];
  deleted?: boolean;
  deletedAt?: string | Date | null;
  createdAt?: string;
  updatedAt?: string;
};
