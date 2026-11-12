import axios from 'axios';

import type { ApiError } from '../../modules/probes/types/probe';

export function getApiError(error: unknown): {
  status?: number;
  message?: string;
} {
  if (!axios.isAxiosError<ApiError>(error) || !error.response) return {};
  return {
    status: error.response.status,
    message: error.response.data?.message,
  };
}
