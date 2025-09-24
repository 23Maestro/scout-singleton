import axios from 'axios';
import { getPreferenceValues } from '@raycast/api';
import { VideoTask } from '../types/workflow';

const ASANA = 'https://app.asana.com/api/1.0';

interface AsanaPreferences {
  asanaAccessToken: string;
}

// Update Asana custom fields by field NAME → gid lookup per task
export async function updateAsanaFields(
  taskGid: string,
  patch: Partial<VideoTask> & { playerId?: string; athleteName?: string },
) {
  const { asanaAccessToken } = getPreferenceValues<AsanaPreferences>();
  const headers = { Authorization: `Bearer ${asanaAccessToken}` };

  // Fetch field gid mapping for this task
  const opt_fields = 'custom_fields.gid,custom_fields.name';
  const detail = await axios.get(`${ASANA}/tasks/${taskGid}`, { params: { opt_fields }, headers });
  const fields: Array<{ gid: string; name: string }> = (detail.data?.data?.custom_fields || []).map(
    (f: any) => ({ gid: f.gid, name: f.name }),
  );
  const byName = new Map(fields.map((f) => [f.name, f.gid] as const));

  const toSet: Record<string, string> = {};
  const setIf = (name: string, value?: string) => {
    if (!value) return;
    const gid = byName.get(name);
    if (gid) toSet[gid] = value;
  };

  // Handle city/state - preserve Asana's format if it was originally combined
  if (patch.city && patch.state) {
    // If both are available separately, combine for Asana storage
    setIf('City', `${patch.city}, ${patch.state}`);
  } else if (patch.city) {
    setIf('City', patch.city);
  }
  // Don't set separate State field if we're using combined format
  setIf('High School', patch.highSchool);
  setIf('Positions', patch.positions);
  setIf('Sport', patch.sport);
  setIf('Grad Year', patch.gradYear);
  setIf('Payment Status', patch.paymentStatus);
  setIf('Name', patch.athleteName);
  setIf('PlayerID', patch.playerId);

  if (Object.keys(toSet).length === 0) return;

  await axios.put(`${ASANA}/tasks/${taskGid}`, { data: { custom_fields: toSet } }, { headers });
}
