import { VideoTask } from '../types/workflow';
import { pushStageStatusToWebsite, fetchWebsiteRowByPlayerId } from '../lib/video-team-api';
import { updateAsanaFields } from './update-asana-fields';
import { findPlayerIdsByName } from './player-resolver';

// 1) Push timelines (DB truth) to website
export async function pushTimelinesToWebsite(task: VideoTask) {
  let playerId = task.playerId;
  if (!playerId) {
    const rawName = task.athleteName || task.taskName || '';
    const searchName = rawName.split('-')[0].trim();
    if (searchName.length > 0) {
      const results = await findPlayerIdsByName(searchName);
      playerId = results[0]?.playerId;
    }
  }
  if (!playerId) throw new Error('Missing player identity (PlayerID or Name lookup failed)');
  await pushStageStatusToWebsite({
    playerId,
    stage: task.stage,
    status: task.status,
    dueOn: task.dueOn ?? undefined,
  });
}

// 2) Backfill metadata from website into Asana (only if missing in Asana)
export async function backfillMetadataToAsana(task: VideoTask) {
  let playerId = task.playerId;
  if (!playerId) {
    const rawName = task.athleteName || task.taskName || '';
    const searchName = rawName.split('-')[0].trim();
    if (searchName.length > 0) {
      const results = await findPlayerIdsByName(searchName);
      playerId = results[0]?.playerId;
    }
  }
  if (!playerId) throw new Error('Missing player identity (PlayerID or Name lookup failed)');
  const w = await fetchWebsiteRowByPlayerId(playerId);
  if (!w) return;

  const patch: Partial<VideoTask> = {};
  // Capture PlayerID and Athlete Name when missing
  if (!task.playerId && playerId) patch.playerId = playerId;
  if (!task.athleteName && (w as any).athlete_name) patch.athleteName = (w as any).athlete_name;
  if (!task.city && w.city) patch.city = w.city;
  if (!task.state && w.state) patch.state = w.state;
  if (!task.highSchool && w.high_school) patch.highSchool = w.high_school;
  if (!task.positions && w.positions) patch.positions = w.positions;
  if (!task.sport && w.sport) patch.sport = w.sport;
  if (!task.gradYear && w.class_year) patch.gradYear = String(w.class_year);
  if (!task.paymentStatus && w.payment_status) patch.paymentStatus = w.payment_status;

  if (Object.keys(patch).length) {
    await updateAsanaFields(task.id, patch);
  }
}
