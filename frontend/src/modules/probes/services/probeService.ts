import { api } from '../../../shared/services/api';
import type { Probe, ProbeListResponse } from '../types/probe';

const mapPageSize = 100;

export const probeService = {
  async get<T>(url: string, signal: AbortSignal): Promise<T> {
    const { data } = await api.get<T>(url, { signal });
    return data;
  },

  async listAll(url: string, signal: AbortSignal): Promise<ProbeListResponse> {
    const probes: Probe[] = [];
    for (let offset = 0; ; offset += mapPageSize) {
      const { probes: page } = await probeService.get<ProbeListResponse>(
        `${url}?limit=${mapPageSize}&offset=${offset}`,
        signal
      );
      probes.push(...page);
      if (page.length < mapPageSize) return { probes };
    }
  },

  async launch(input: {
    x: number;
    y: number;
    direction: FormDataEntryValue | null;
  }): Promise<Probe> {
    const { data } = await api.post<Probe>('/probes', input);
    return data;
  },

  async move(probeId: string, commands: string): Promise<Probe> {
    const { data } = await api.post<Probe>(
      `/probes/${encodeURIComponent(probeId)}/commands`,
      { commands }
    );
    return data;
  },
};
