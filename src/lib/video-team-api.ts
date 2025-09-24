import { npidRequest } from '../api/npid';
import { TaskStage, TaskStatus } from '../types/workflow';

export interface WebsitePlayerData {
  player_id: string;
  profile_url?: string;
  city?: string;
  state?: string;
  high_school?: string;
  positions?: string;
  sport?: string;
  class_year?: number;
  payment_status?: 'Paid' | 'Unpaid' | 'Unknown';
  stage?: string;
  status?: string;
  due_date?: string;
}

export async function fetchWebsiteRowByPlayerId(
  playerIdOrUrl: string,
): Promise<WebsitePlayerData | null> {
  try {
    // Try multiple endpoints to find player data from video progress page
    const endpoints = [
      `/videoteammsg/videomailprogress/search?name=${encodeURIComponent(playerIdOrUrl)}`,
      `/api/videoteam/progress?player_id=${encodeURIComponent(playerIdOrUrl)}`,
      `/player/${playerIdOrUrl}`,
      `/api/player/${playerIdOrUrl}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await npidRequest(endpoint, { method: 'GET' });

        if (response && (response.player_id || response.id)) {
          return {
            player_id: response.player_id || response.id || playerIdOrUrl,
            profile_url: response.profile_url || response.url,
            city: response.city,
            state: response.state,
            high_school: response.high_school || response.school,
            positions: response.positions || response.position,
            sport: response.sport,
            class_year: response.class_year || response.grad_year || response.graduation_year,
            payment_status: response.payment_status,
            stage: response.stage,
            status: response.status,
            due_date: response.due_date,
          };
        }
      } catch (error) {
        console.log(`Failed endpoint ${endpoint}:`, error);
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error(`Failed to fetch player data for ${playerIdOrUrl}:`, error);
    return null;
  }
}

export async function pushStageStatusToWebsite(params: {
  playerId?: string;
  profileUrl?: string;
  stage: TaskStage;
  status: TaskStatus;
  dueOn?: string;
}): Promise<void> {
  const identifier = params.playerId || params.profileUrl;
  if (!identifier) {
    throw new Error('Either playerId or profileUrl is required');
  }

  // Map our internal stage/status to NPID format
  const npidStage = mapStageToNPID(params.stage);
  const npidStatus = mapStatusToNPID(params.status);

  try {
    await npidRequest(`/videoteammsg/videoprogress/${identifier}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=utf-8',
      },
      data: {
        stage: npidStage,
        status: npidStatus,
        due_date: params.dueOn || new Date().toISOString().split('T')[0],
      },
    });
  } catch (error) {
    console.error(`Failed to push stage/status to website for ${identifier}:`, error);
    throw error;
  }
}

function mapStageToNPID(stage: TaskStage): string {
  switch (stage) {
    case 'On Hold':
      return 'On Hold';
    case 'Awaiting Client':
      return 'Awaiting Client';
    case 'In Queue':
      return 'In Progress';
    case 'Done':
      return 'Complete';
    default:
      return 'In Progress';
  }
}

function mapStatusToNPID(status: TaskStatus): string {
  switch (status) {
    case 'Revisions':
      return 'Revisions';
    case 'HUDL':
      return 'Review';
    case 'Dropbox':
      return 'Approved';
    case 'External Links':
      return 'Complete';
    case 'Not Approved':
      return 'Not Approved';
    default:
      return 'In Progress';
  }
}
