import axios, { AxiosRequestConfig } from 'axios';
import { getPreferenceValues } from '@raycast/api';
import { NPIDInboxMessage, NPIDVideoProgress } from '../types/video-team';
import { loadStoredNPIDTokens } from '../lib/token-store';

interface NPIDPreferences {
  npidXsrfToken?: string;
  npidSession?: string;
  npidBaseUrl?: string;
}


function getNPIDAxiosInstance() {
  const { npidXsrfToken, npidSession, npidBaseUrl } = getPreferenceValues<NPIDPreferences>();
  const storedTokens = loadStoredNPIDTokens();

  // Use fresh tokens from your cURL (fallback to preferences)
  const xsrfToken = storedTokens?.xsrf_token || npidXsrfToken;
  const sessionCookie = storedTokens?.session_cookie || npidSession;

  console.log('🔍 Token Debug:', {
    hasStoredTokens: !!storedTokens,
    hasXsrfToken: !!xsrfToken,
    hasSessionCookie: !!sessionCookie,
    xsrfTokenLength: xsrfToken?.length || 0,
    sessionCookieLength: sessionCookie?.length || 0
  });

  if (!xsrfToken || !sessionCookie) {
    throw new Error(
      'Missing NPID authentication. Ensure the token refresh service is running or configure npidXsrfToken/npidSession preferences.',
    );
  }

  // ✅ FIXED: Match working curl command - only send Cookie header
  return axios.create({
    baseURL: npidBaseUrl || 'https://dashboard.nationalpid.com',
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      Cookie: `XSRF-TOKEN=${xsrfToken}; myapp_session=${sessionCookie}`,
    },
    withCredentials: true,
  });
}

export async function npidRequest<T>(url: string, options?: AxiosRequestConfig) {
  const axiosInstance = getNPIDAxiosInstance();

  try {
    const response = await axiosInstance.request<T>({
      url,
      ...options,
    });
    return response.data;
  } catch (error) {
    if (error && typeof error === 'object' && 'isAxiosError' in error) {
      console.error('NPID API Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.message);
    }
    throw error;
  }
}

export async function fetchInboxMessages(): Promise<NPIDInboxMessage[]> {
  try {
    // Use the working HTML parsing system instead of broken API endpoints
    const { fetchInboxThreads } = await import('../lib/video-team-inbox');
    return await fetchInboxThreads();
  } catch (error) {
    console.error('Failed to fetch inbox messages:', error);
    throw error;
  }
}

export async function fetchVideoProgress(): Promise<NPIDVideoProgress[]> {
  try {
    // TODO: Fix video progress endpoints - these are causing "Unauthorized" errors
    console.log('Video progress fetch disabled - endpoints need to be fixed');
    return [];
  } catch (error) {
    console.error('Failed to fetch video progress:', error);
    throw error;
  }
}

export async function fetchMessageDetails(messageId: string): Promise<any> {
  try {
    // TODO: Fix message details endpoints - these are causing "Unauthorized" errors
    console.log(`Message details fetch disabled for ${messageId} - endpoints need to be fixed`);
    return null;
  } catch (error) {
    console.error('Failed to fetch message details:', error);
    throw error;
  }
}

export async function assignInboxMessage(messageId: string, editorId?: string): Promise<void> {
  try {
    // Use the working HTML parsing system for assignment
    const { assignVideoTeamMessage, fetchAssignmentModal } = await import('../lib/video-team-inbox');
    
    // Get the assignment modal to get the form token
    const modal = await fetchAssignmentModal(messageId);
    
    // TODO: Get actual values from the message instead of hardcoded defaults
    console.log('Assignment modal data:', modal);
    console.log('Would assign message with editorId:', editorId);
    
    // For now, just log instead of making the assignment
    // await assignVideoTeamMessage({ ... });
  } catch (error) {
    console.error('Failed to assign inbox message:', error);
    throw error;
  }
}

export async function updateVideoProgress(
  playerId: string,
  progress: Partial<NPIDVideoProgress>,
): Promise<void> {
  try {
    // TODO: Fix video progress update endpoints - these are causing "Unauthorized" errors
    console.log(`Video progress update disabled for ${playerId}:`, progress);
    // await npidRequest(`/videoteammsg/videoprogress/${playerId}`, { ... });
  } catch (error) {
    console.error('Failed to update video progress:', error);
    throw error;
  }
}

export async function fetchPlayerDetails(playerId: string): Promise<any> {
  try {
    // TODO: Fix player details endpoint - this might be causing "Unauthorized" errors
    console.log(`Player details fetch disabled for ${playerId} - endpoint needs to be fixed`);
    return null;
  } catch (error) {
    console.error('Failed to fetch player details:', error);
    throw error;
  }
}
