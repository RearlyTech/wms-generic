import {
  createDirectus,
  rest,
  authentication,
  AuthenticationData
} from '@directus/sdk';

import { getItem, setItem, removeItem } from '../Storage/Storage';

// export const API_URL = 'http://192.168.1.108:8055';

export const API_URL = 'https://dev-directus.rearlytech.com';

export const directus = createDirectus(API_URL)
  .with(rest())
  .with(
    authentication('json', {
      autoRefresh: true,
      msRefreshBeforeExpires: 60_000,

      storage: {
        get: (): AuthenticationData | null => {
          const access_token = getItem('authToken');
          const refresh_token = getItem('refreshToken');
          const expires = getItem('expires');
          const expires_at = getItem('expires_at');

          if (!access_token || !refresh_token) {
            return null;
          }

          return {
            access_token,
            refresh_token,
            expires: expires ? Number(expires) : undefined,
            expires_at: expires_at ? Number(expires_at) : undefined,
          } as AuthenticationData;
        },

        set: (value: AuthenticationData | null) => {
          if (value) {
            if (value.access_token) {
              setItem('authToken', value.access_token);
            }

            if (value.refresh_token) {
              setItem('refreshToken', value.refresh_token);
            }

            if (value.expires !== undefined) {
              setItem('expires', String(value.expires));
            }

            if (value.expires_at !== undefined) {
              setItem('expires_at', String(value.expires_at));
            }
          } else {
            removeItem('authToken');
            removeItem('refreshToken');
            removeItem('expires');
            removeItem('expires_at');
          }
        }
      }
    })
  );
