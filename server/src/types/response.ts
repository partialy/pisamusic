export type ApiResponse<T> = {
  msg: string;
  code: number;
  data: T | null;
  success: boolean;
};

export function ok<T>(data: T, msg = "ok"): ApiResponse<T> {
  return {
    msg,
    code: 0,
    data,
    success: true,
  };
}

export function fail(msg: string, code = -1): ApiResponse<null> {
  return {
    msg,
    code,
    data: null,
    success: false,
  };
}
