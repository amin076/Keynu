export type ApiPrimitive = string | number | boolean | null;

export type ApiValue =
  | ApiPrimitive
  | ApiValue[]
  | { [key: string]: ApiValue };

export interface ApiEnvelope<TData> {
  data: TData;
  generatedAt?: string;
}

export interface ApiErrorPayload {
  error?: string;
  message?: string;
  code?: string;
  details?: ApiValue;
}

export interface RuntimeHealthContract {
  status: string;
  [key: string]: unknown;
}

export interface PaginationContract {
  total: number;
  limit: number;
  offset: number;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export interface PaginatedContract<TItem> extends PaginationContract {
  items: TItem[];
}
