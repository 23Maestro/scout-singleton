import { npidRequest } from '../api/npid';
import { TaskStage, TaskStatus } from '../types/workflow';
import { load } from 'cheerio';

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
    console.log(`Fetching video progress data for player: ${playerId}`);
    
    // Use HTML parsing approach similar to inbox system
    // Navigate to video progress page and search for the player
    const response = await npidRequest('/videoteammsg/videomailprogress', {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch video progress page: ${response.status}`);
    }
    
    const html = await response.text();
    const $ = load(html);
    
    // Parse the video progress page HTML to extract player data
    // This will need to be updated with actual selectors from the page
    const playerData: WebsitePlayerData = {
      player_id: playerId,
    };
    
    // Try to find player data in the page
    // These selectors need to be updated based on actual page structure
    try {
      const nameElement = $('.athlete-name, .player-name, h1, h2').first();
      if (nameElement.length) {
        playerData.athlete_name = nameElement.text().trim();
      }
      
      const stageElement = $('.current-stage, .stage-value, select[name*="stage"] option:selected').first();
      if (stageElement.length) {
        playerData.stage = stageElement.text().trim();
      }
      
      const statusElement = $('.current-status, .status-value, select[name*="status"] option:selected').first();
      if (statusElement.length) {
        playerData.status = statusElement.text().trim();
      }
      
      // Add more field extractions as needed
      const schoolElement = $('.high-school, .school-name').first();
      if (schoolElement.length) {
        playerData.high_school = schoolElement.text().trim();
      }
      
      const sportElement = $('.sport, .sport-type').first();
      if (sportElement.length) {
        playerData.sport = sportElement.text().trim();
      }
      
    } catch (parseError) {
      console.warn(`Could not parse some fields for player ${playerId}:`, parseError);
    }
    
    console.log(`Extracted data for player ${playerId}:`, playerData);
    return playerData;
    
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
