import { api } from './api';
import { parseOverview, type AinCodeOverview } from './aincodeSessions';

export const aincodeApi = api.injectEndpoints({ endpoints: (b) => ({
  aincodeOverview: b.query<AinCodeOverview, string>({
    keepUnusedDataFor: 0,
    queryFn: async (_identity, _api, _extra, baseQuery) => {
      const result = await baseQuery('code/_aincode/sessions');
      if (result.error) return { error: result.error };
      const data = parseOverview(result.data);
      return data ? { data } : { error: { status: 'CUSTOM_ERROR', error: 'Invalid AinCode session list' } };
    },
  }),
}) });
export const { useAincodeOverviewQuery } = aincodeApi;
