// Video team and NPID API type definitions

export interface NPIDPlayer {
  player_id: string;
  profile_url: string;
  athlete_name: string;
  first_name: string;
  last_name: string;
  sport: string;
  positions: string;
  class_year: number;
  grad_year: string;
  high_school: string;
  city: string;
  state: string;
  height?: string;
  weight?: string;
  gpa?: number;
  sat_score?: number;
  act_score?: number;
  payment_status: 'Paid' | 'Unpaid' | 'Unknown';
  created_at: string;
  updated_at: string;
}

export interface NPIDInboxMessage {
  thread_id: string;
  player_id: string;
  player_name: string;
  subject: string;
  message: string;
  sport: string;
  class_year: string;
  received_at: string;
  status: 'unassigned' | 'assigned' | 'completed';
  assigned_to?: string;
  video_links?: string[];
  attachments?: NPIDAttachment[];
}

export interface NPIDAttachment {
  id: string;
  filename: string;
  url: string;
  type: string;
  size: number;
}

export interface NPIDVideoProgress {
  id: string;
  player_id: string;
  player_name: string;
  sport: string;
  class_year: string;
  task_name: string;
  stage: string;
  status: string;
  due_date?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  video_links?: string[];
}

export interface VideoTeamAssignment {
  message_id: string;
  thread_id: string;
  editor_id: string;
  stage: string;
  status: string;
  due_date: string;
  notes?: string;
}

export interface VideoTeamStatusUpdate {
  player_id: string;
  stage: string;
  status: string;
  due_date?: string;
  completion_date?: string;
  video_links?: string[];
  notes?: string;
}

export interface DropboxFolder {
  name: string;
  path: string;
  player_id: string;
  athlete_name: string;
  sport: string;
  grad_year: string;
  created_at: string;
}

export interface VideoDeliverable {
  type: 'highlight_reel' | 'skills_video' | 'game_film' | 'recruiting_video';
  title: string;
  duration_seconds: number;
  file_size_mb: number;
  resolution: string;
  format: string;
  dropbox_url?: string;
  youtube_url?: string;
  vimeo_url?: string;
  created_at: string;
}
