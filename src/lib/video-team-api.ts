import { npidRequest } from '../api/npid';
import { TaskStage, TaskStatus } from '../types/workflow';

export interface WebsitePlayerData {
  player_id: string;
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
  playerId: string,
): Promise<WebsitePlayerData | null> {
  try {
    // TODO: Fix video progress endpoints - these are causing "Unauthorized" errors
    // The video progress page needs different authentication or endpoints
    console.log(`Would fetch video progress data for player: ${playerId}`);
    
    // For now, return null instead of making API calls
    return null;
  } catch (error) {
    console.error(`Failed to fetch player data for ${playerId}:`, error);
    return null;
  }
}

export async function pushStageStatusToWebsite(params: {
  player_id?: string;
  stage: TaskStage;
  status: TaskStatus;
  dueOn?: string;
}): Promise<void> {
  const identifier = params.player_id;
  if (!identifier) {
    throw new Error('player_id is required');
  }

  // Map our internal stage/status to NPID format
  const npidStage = mapStageToNPID(params.stage);
  const npidStatus = mapStatusToNPID(params.status);

  try {
    // TODO: Fix video progress endpoints - these are causing "Unauthorized" errors
    // The video progress page needs different authentication or endpoints
    console.log(`Would update video progress for ${identifier}:`, {
      stage: npidStage,
      status: npidStatus,
      due_date: params.dueOn || new Date().toISOString().split('T')[0],
    });
    
    // For now, just log instead of making the API call
    // await updateVideoProgress(identifier, { ... });
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
    case 'Approved':
      return 'Approved';
    case 'External Links':
      return 'Complete';
    case 'Not Approved':
      return 'Not Approved';
    default:
      return 'In Progress';
  }
}
