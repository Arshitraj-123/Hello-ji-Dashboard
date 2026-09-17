export type CustomerDoc = {
  id: string;
  _id?: string;
  customerId?: string;
  fileName: string;
  filePath?: string;
  fileType: string;
  fileSize?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Customer = {
  id: string;
  _id?: string;
  name: string;
  city: string;
  phone: string;
  documentType: string;
  reference: string;
  remarks: string;
  documents: CustomerDoc[];
  deleted?: boolean;
  deletedAt?: string | Date | null;
  createdAt?: string;
  updatedAt?: string;
};
