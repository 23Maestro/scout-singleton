import axios, { AxiosRequestConfig } from 'axios';
import { getPreferenceValues } from '@raycast/api';

interface AsanaPreferences {
  asanaAccessToken: string;
}

async function getAxiosInstance() {
  const { asanaAccessToken } = getPreferenceValues<AsanaPreferences>();

  return axios.create({
    baseURL: 'https://app.asana.com/api/1.0',
    headers: {
      Authorization: `Bearer ${asanaAccessToken}`,
    },
  });
}

export async function request<T>(url: string, options?: AxiosRequestConfig) {
  const axios = await getAxiosInstance();

  return axios.request<T>({
    url,
    ...options,
  });
}
