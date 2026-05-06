export type ApiResponse<T> = {
  msg: string;
  code: number;
  data: T | null;
  success: boolean;
};
