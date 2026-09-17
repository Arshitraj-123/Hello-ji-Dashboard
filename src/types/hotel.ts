export type Hotel = {
  id: string;
  _id?: string;
  hotelName: string;
  city: string;
  star: string;
  salesPerson: string;
  email: string;
  phone: string;
  address: string;
  reservationNumber: string;
  totalRooms: string;
  roomsCategory: string;
  remarks: string;
  deleted?: boolean;
  deletedAt?: string | Date | null;
  createdAt?: string;
  updatedAt?: string;
};
