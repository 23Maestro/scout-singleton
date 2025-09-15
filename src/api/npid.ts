import axios, { AxiosRequestConfig } from "axios";
import { getPreferenceValues } from "@raycast/api";

interface NPIDPreferences {
  npidApiKey?: string;
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
}

export interface VideoProgress {
  playerId: string;
  status: "editing" | "review" | "approved" | "published";
  progress: number;
  currentStage: string;
  lastUpdated: string;
}

function getNPIDAxiosInstance() {
  const { npidApiKey, npidBaseUrl } = getPreferenceValues<NPIDPreferences>();
  
  return axios.create({
    baseURL: npidBaseUrl || "https://api.nationalprospectid.com",
    headers: {
      Authorization: `Bearer ${npidApiKey || ""}`,
      "Content-Type": "application/json",
    },
  });
}

export async function npidRequest<T>(url: string, options?: AxiosRequestConfig) {
  const axios = getNPIDAxiosInstance();
  
  try {
    const response = await axios.request<T>({
      url,
      ...options,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("NPID API Error:", error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.message);
    }
    throw error;
  }
}

export async function fetchInboxMessages(): Promise<InboxMessage[]> {
  return npidRequest<InboxMessage[]>("/videoteammsg/inbox", {
    method: "GET",
    params: {
      status: "unassigned",
      limit: 50,
    },
  });
}

export async function assignInboxMessage(messageId: string, assignee: string): Promise<void> {
  await npidRequest(`/videoteammsg/inbox/assign`, {
    method: "POST",
    data: {
      messageId,
      assignee,
    },
  });
}

export async function updateVideoProgress(playerId: string, progress: Partial<VideoProgress>): Promise<void> {
  await npidRequest(`/videoteammsg/videoprogress/${playerId}`, {
    method: "PATCH",
    data: progress,
  });
}

export async function fetchPlayerDetails(playerId: string): Promise<any> {
  return npidRequest(`/player/${playerId}`, {
    method: "GET",
  });
}