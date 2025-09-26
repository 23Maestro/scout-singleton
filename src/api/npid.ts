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

  if (!xsrfToken || !sessionCookie) {
    throw new Error(
      'Missing NPID authentication. Ensure the token refresh service is running or configure npidXsrfToken/npidSession preferences.',
    );
  }

  console.log('🔍 Token Debug:', {
    hasStoredTokens: !!storedTokens,
    hasXsrfToken: !!xsrfToken,
    hasSessionCookie: !!sessionCookie,
    xsrfTokenLength: xsrfToken?.length || 0,
    sessionCookieLength: sessionCookie?.length || 0
  });

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
  // VIDEO PROGRESS SYSTEM - SEPARATE from inbox system
  // This system handles the video progress dashboard with task statuses and stage tracking
  console.log('VIDEO PROGRESS SYSTEM: Fetch disabled - separate system from inbox');
  console.log('This would fetch task progress data from the video progress page');
  return [];
  // TODO: Implement video progress API when video progress page endpoints are identified
}

export async function fetchMessageDetails(messageId: string): Promise<any> {
  // INBOX SYSTEM - Uses HTML parsing for message details
  // This is handled by the video-team-inbox.ts fetchMessageDetail function
  console.log('INBOX SYSTEM: Message details handled by HTML parsing system');
  console.log(`Use fetchMessageDetail() from video-team-inbox.ts for message: ${messageId}`);
  return null;
  // TODO: Route to video-team-inbox.ts fetchMessageDetail if needed
}

export async function assignInboxMessage(messageId: string, editorId?: string): Promise<void> {
  try {
    // INBOX SYSTEM ONLY - Uses HTML parsing for assignment workflow
    const { assignVideoTeamMessage, fetchAssignmentModal } = await import('../lib/video-team-inbox');
    
    const modal = await fetchAssignmentModal(messageId);
    console.log('Assignment modal loaded for message:', messageId);
    console.log('Available assignment options:', {
      owners: modal.owners?.length || 0,
      stages: modal.stages?.length || 0,
      videoStatuses: modal.videoStatuses?.length || 0
    });
    
    // TODO: Implement actual assignment logic when needed
    // This would require proper contact resolution and assignment parameters
    console.log('Assignment workflow ready - implementation pending');
  } catch (error) {
    console.error('Failed to assign inbox message:', error);
    throw error;
  }
}

export async function updateVideoProgress(
  playerId: string,
  progress: Partial<NPIDVideoProgress>,
): Promise<void> {
  // VIDEO PROGRESS SYSTEM - SEPARATE from inbox system
  // This system handles task status updates and stage changes on the video progress page
  console.log('VIDEO PROGRESS SYSTEM: Update disabled - separate system from inbox');
  console.log(`Would update player ${playerId}:`, progress);
  // TODO: Implement video progress API when video progress page endpoints are identified
}

export async function fetchPlayerDetails(playerId: string): Promise<any> {
  // VIDEO PROGRESS SYSTEM - SEPARATE from inbox system
  // This system handles player profile data from the video progress page
  console.log('VIDEO PROGRESS SYSTEM: Fetch disabled - separate system from inbox');
  console.log(`Would fetch player details for: ${playerId}`);
  return null;
  // TODO: Implement player details API when video progress page endpoints are identified
}
