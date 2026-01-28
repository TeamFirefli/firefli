import { SWRConfiguration } from 'swr';
import axios from 'axios';

export const fetcher = (url: string) => axios.get(url).then(res => res.data);

export const swrConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  shouldRetryOnError: true,
  onError: (error, key) => {
    console.error(`SWR Error [${key}]:`, error);
  }
};
