import axios, { AxiosRequestConfig } from "axios";
import { getPreferenceValues } from "@raycast/api";

interface NPIDPreferences {
  npidXsrfToken?: string;
  npidSession?: string;
  npidBaseUrl?: string;
}

export interface InboxMessage {
  id: string;
  playerId: string;
  playerName: string;
  sport: string;
  class: string;
  message: string;
  videoLinks?: string[];
  createdAt: string;
  status: "unassigned" | "assigned" | "completed";
  assignedTo?: string;
  // Additional fields for email thread processing
  email?: string;
  content?: string;
  messageId?: string;
  contactId?: string;
  isAssigned?: boolean;
  receivedAt?: string;
  profileImage?: string;
  // Smart filtering fields
  hasContactId?: boolean;
  isFromParent?: boolean;
  playerIdFromUrl?: string;
}

export interface VideoProgress {
  id: string;
  playerId: string;
  playerName: string;
  sport: string;
  class: string;
  task: string;
  status: "editing" | "review" | "approved" | "published";
  createdAt: string;
  updatedAt: string;
}

// Helper function to map NPID status to our internal status
function mapNPIDStatus(npidStatus: string): "editing" | "review" | "approved" | "published" {
  switch (npidStatus?.toLowerCase()) {
    case "in progress":
    case "editing":
      return "editing";
    case "review":
    case "revise":
      return "review";
    case "approved":
    case "complete":
      return "approved";
    case "published":
    case "done":
      return "published";
    default:
      return "editing";
  }
}

function getNPIDAxiosInstance() {
  const { npidXsrfToken, npidSession, npidBaseUrl } = getPreferenceValues<NPIDPreferences>();
  
  // Use fresh tokens from your cURL (fallback to preferences)
  const xsrfToken = npidXsrfToken || "eyJpdiI6Inpnb3RqNVF4bUE1bG12Q25Xb0NTTWc9PSIsInZhbHVlIjoicEtHKzZcL252RER0aW1WZGFjVktJeEhnZG9MZDB1ZTNVcVZmQ1R1ZGkxdEd3aFFrWUpmM2JMMnNLMW9ZeVhaU1NMQmxHWlRZOG9OSmxQZk9QXC9xQ0swUT09IiwibWFjIjoiYjlmM2U5Y2E1OTZmYzI1MjhkZGE3N2FiMmI4MmVhY2I5ZThlMjNmNmJjYjAzN2E0OGE3OWI0MTBhNzUyMjI3YiJ9";
  const sessionCookie = npidSession || "eyJpdiI6InBWN2kwaWlENzhRVENodlpPZGpcLytBPT0iLCJ2YWx1ZSI6IkxoaktBSnNzd08yaG95bWU0d1hRSk5oQ0RsdEFpZ1hzYWh0Q2EzcHdzQ3c3WUFUbUd5ekhNNk5DaWwrWWJxSnl0SmhIVGxRV2I2bHBISUl0MjhmR0FnPT0iLCJtYWMiOiI5YjZlZjU2NzQ3NTNjYzg5MTZmYTg0YTRjNzJiMDk5YTllZmRlNDA0ZjMwM2E1M2U0NGQzNzkyM2FkNGI0Y2M0In0%3D";
  
  return axios.create({
    baseURL: npidBaseUrl || "https://dashboard.nationalpid.com",
    headers: {
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-XSRF-TOKEN": xsrfToken,
      "X-Requested-With": "XMLHttpRequest",
      "Cookie": `XSRF-TOKEN=${xsrfToken}; myapp_session=${sessionCookie}`,
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
      console.error("NPID API Error:", error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.message);
    }
    throw error;
  }
}

export async function fetchInboxMessages(): Promise<InboxMessage[]> {
  try {
    // Try multiple potential endpoints for inbox messages
    let response;
    const endpoints = [
      "/api/videoteam/inbox",
      "/videoteam/messages/inbox",
      "/messages/inbox",
      "/inbox/messages",
      "/api/messages/inbox"
    ];

    for (const endpoint of endpoints) {
      try {
        response = await npidRequest<any>(endpoint, { method: "GET" });
        console.log(`Success with endpoint: ${endpoint}`, response);
        break;
      } catch (err) {
        console.log(`Failed endpoint: ${endpoint}`, err);
        continue;
      }
    }

    if (!response) {
      throw new Error("All inbox endpoints failed - check NPID API documentation");
    }

    // Handle the expected JSON format
    if (Array.isArray(response)) {
      return response.map(item => ({
        id: item.thread_id || item.id,
        playerId: item.player_id || item.playerId || "",
        playerName: item.subject || item.player_name || item.name || "",
        sport: item.sport || "",
        class: item.class || item.grad_year || "",
        message: item.subject || item.message || "",
        createdAt: item.received_at || item.created_at || "",
        status: "unassigned" as const,
      }));
    }

    // Handle nested response structure
    if (response?.data && Array.isArray(response.data)) {
      return response.data.map(item => ({
        id: item.thread_id || item.id,
        playerId: item.player_id || item.playerId || "",
        playerName: item.subject || item.player_name || item.name || "",
        sport: item.sport || "",
        class: item.class || item.grad_year || "",
        message: item.subject || item.message || "",
        createdAt: item.received_at || item.created_at || "",
        status: "unassigned" as const,
      }));
    }

    return [];

  } catch (error) {
    console.error("Failed to fetch inbox messages:", error);
    throw new Error(`NPID Inbox API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function fetchVideoProgress(): Promise<VideoProgress[]> {
  try {
    // Try multiple potential endpoints for video progress
    let response;
    const endpoints = [
      "/api/videoteam/progress",
      "/videoteam/progress",
      "/progress",
      "/tasks/progress",
      "/api/tasks/progress"
    ];

    for (const endpoint of endpoints) {
      try {
        response = await npidRequest<any>(endpoint, {
          method: "GET",
          params: {
            status: "active",
            limit: 100
          }
        });
        console.log(`Success with video progress endpoint: ${endpoint}`, response);
        break;
      } catch (err) {
        console.log(`Failed video progress endpoint: ${endpoint}`, err);
        continue;
      }
    }

    if (!response) {
      throw new Error("All video progress endpoints failed - check NPID API documentation");
    }

    // Handle the expected JSON format from HAR docs
    if (Array.isArray(response)) {
      return response.map(item => ({
        id: item.id || item.thread_id || "",
        playerId: item.player_id || item.playerId || "",
        playerName: item.player_name || item.subject || item.name || "",
        sport: item.sport || "",
        class: item.class || item.grad_year || "",
        task: item.task_name || item.subject || item.task || "",
        status: mapNPIDStatus(item.status || ""),
        createdAt: item.created_at || item.received_at || "",
        updatedAt: item.updated_at || item.modified_at || "",
      }));
    }

    // Handle nested response structure
    if (response?.data && Array.isArray(response.data)) {
      return response.data.map(item => ({
        id: item.id || item.thread_id || "",
        playerId: item.player_id || item.playerId || "",
        playerName: item.player_name || item.subject || item.name || "",
        sport: item.sport || "",
        class: item.class || item.grad_year || "",
        task: item.task_name || item.subject || item.task || "",
        status: mapNPIDStatus(item.status || ""),
        createdAt: item.created_at || item.received_at || "",
        updatedAt: item.updated_at || item.modified_at || "",
      }));
    }

    return [];
  } catch (error) {
    console.error("Failed to fetch video progress:", error);
    throw new Error(`NPID Video Progress API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function fetchMessageDetails(messageId: string): Promise<any> {
  // Try multiple potential endpoints for message details
  const endpoints = [
    `/api/messages/${messageId}`,
    `/messages/${messageId}`,
    `/inbox/messages/${messageId}`,
    `/videoteam/messages/${messageId}`,
    `/api/videoteam/messages/${messageId}`
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await npidRequest(endpoint, {
        method: "GET",
        params: {
          message_id: messageId,
          type: "inbox",
          user_timezone: "America/New_York",
          filter_self: "Me/Un",
        },
      });
      console.log(`Success with message details endpoint: ${endpoint}`, response);
      return response;
    } catch (err) {
      console.log(`Failed message details endpoint: ${endpoint}`, err);
      continue;
    }
  }

  throw new Error(`All message detail endpoints failed for messageId: ${messageId}`);
}

export async function assignInboxMessage(messageId: string, editorId?: string): Promise<void> {
  const { npidXsrfToken } = getPreferenceValues<NPIDPreferences>();
  const xsrfToken = npidXsrfToken || "eyJpdiI6Inpnb3RqNVF4bUE1bG12Q25Xb0NTTWc9PSIsInZhbHVlIjoicEtHKzZcL252RER0aW1WZGFjVktJeEhnZG9MZDB1ZTNVcVZmQ1R1ZGkxdEd3aFFrWUpmM2JMMnNLMW9ZeVhaU1NMQmxHWlRZOG9OSmxQZk9QXC9xQ0swUT09IiwibWFjIjoiYjlmM2U5Y2E1OTZmYzI1MjhkZGE3N2FiMmI4MmVhY2I5ZThlMjNmNmJjYjAzN2E0OGE3OWI0MTBhNzUyMjI3YiJ9";

  // Try multiple potential endpoints for assignment
  const endpoints = [
    "/api/messages/assign",
    "/messages/assign",
    "/inbox/assign",
    "/videoteam/assign",
    "/api/videoteam/assign"
  ];

  const payload = {
    message_id: messageId,
    thread_id: messageId,
    editor_id: editorId || "current_user",
    stage: 'New',
    status: 'In Progress',
    due_date: new Date().toISOString().split('T')[0],
    _token: xsrfToken,
  };

  for (const endpoint of endpoints) {
    try {
      await npidRequest(endpoint, {
        method: "POST",
        data: payload,
      });
      console.log(`Success with assignment endpoint: ${endpoint}`);
      return;
    } catch (err) {
      console.log(`Failed assignment endpoint: ${endpoint}`, err);
      continue;
    }
  }

  throw new Error(`All assignment endpoints failed for messageId: ${messageId}`);
}

export async function updateVideoProgress(playerId: string, progress: Partial<VideoProgress>): Promise<void> {
  const { npidXsrfToken } = getPreferenceValues<NPIDPreferences>();
  const xsrfToken = npidXsrfToken || "eyJpdiI6Inpnb3RqNVF4bUE1bG12Q25Xb0NTTWc9PSIsInZhbHVlIjoicEtHKzZcL252RER0aW1WZGFjVktJeEhnZG9MZDB1ZTNVcVZmQ1R1ZGkxdEd3aFFrWUpmM2JMMnNLMW9ZeVhaU1NMQmxHWlRZOG9OSmxQZk9QXC9xQ0swUT09IiwibWFjIjoiYjlmM2U5Y2E1OTZmYzI1MjhkZGE3N2FiMmI4MmVhY2I5ZThlMjNmNmJjYjAzN2E0OGE3OWI0MTBhNzUyMjI3YiJ9";
  
  // Use exact endpoint from HAR documentation
  await npidRequest(`/videoteammsg/videoprogress/${playerId}`, {
    method: "PATCH",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json;charset=utf-8",
    },
    data: {
      stage: progress.task || "Editing",
      status: progress.status === "editing" ? "In Progress" : "Complete",
      due_date: new Date().toISOString().split('T')[0],
    },
  });
}

export async function fetchPlayerDetails(playerId: string): Promise<any> {
  return npidRequest(`/player/${playerId}`, {
    method: "GET",
  });
}
