import axios from 'axios';

import type { ApiError } from '../../modules/probes/types/probe';

export function getApiError(error: unknown): ApiError & { status?: number } {
  if (!axios.isAxiosError<ApiError>(error) || !error.response) return {};
  return {
    status: error.response.status,
    code: error.response.data?.code,
    message: error.response.data?.message,
  };
}
