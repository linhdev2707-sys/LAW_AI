export interface IApiSuccess<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface IApiError {
  success: false;
  statusCode: number;
  message: string;
  errors?: Record<string, string[]>;
  timestamp: string;
}

export type IApiResponse<T> = IApiSuccess<T> | IApiError;

export interface IPaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
