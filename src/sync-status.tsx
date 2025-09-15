import { showToast, Toast, environment } from "@raycast/api";
import { request } from "./api/request";
import { updateVideoProgress } from "./api/npid";
import { Task, CustomField } from "./api/tasks";

const ID_TASKS_PROJECT_GID = "1208992901563477"; // ID Tasks project GID

interface VideoTask extends Task {
  sport?: string;
  class?: string;
  playerId?: string;
  stage?: string;
  status?: string;
  positions?: string;
}

function extractCustomFields(task: Task): VideoTask {
  const videoTask = task as VideoTask;
  
  task.custom_fields?.forEach((field: CustomField) => {
    switch (field.name) {
      case "Sport":
        videoTask.sport = field.display_value || "";
        break;
      case "Class":
        videoTask.class = field.display_value || "";
        break;
      case "PlayerID":
        videoTask.playerId = field.display_value || "";
        break;
      case "Stage":
        videoTask.stage = field.enum_value?.name || "";
        break;
      case "Status":
        videoTask.status = field.enum_value?.name || "";
        break;
      case "Positions":
        videoTask.positions = field.display_value || "";
        break;
    }
  });
  
  return videoTask;
}

function mapAsanaStatusToNPID(asanaStatus?: string): string {
  switch (asanaStatus) {
    case "INBOX":
    case "Revise":
      return "editing";
    case "HUDL":
    case "Review":
      return "review";
    case "Dropbox":
    case "Approved":
      return "approved";
    case "Uploads":
    case "Complete":
      return "published";
    default:
      return "editing";
  }
}

function calculateProgress(status?: string, stage?: string): number {
  if (status === "Complete" || status === "Uploads") return 100;
  if (status === "Dropbox" || status === "Approved") return 80;
  if (status === "HUDL" || stage === "Review") return 60;
  if (status === "Revise" || stage === "Editing") return 40;
  return 20;
}

async function fetchAsanaTasks(): Promise<VideoTask[]> {
  try {
    const response = await request<{ data: Task[] }>("/tasks", {
      params: {
        project: ID_TASKS_PROJECT_GID,
        opt_fields: "id,name,due_on,due_at,completed,modified_at,custom_fields",
        completed_since: "now",
        modified_since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
      },
    });
    
    return response.data.data
      .map(extractCustomFields)
      .filter(task => task.playerId && !task.completed); // Only tasks with Player ID and not completed
  } catch (error) {
    console.error("Error fetching Asana tasks:", error);
    throw error;
  }
}

async function syncTaskToNPID(task: VideoTask): Promise<boolean> {
  if (!task.playerId) {
    console.log(`Skipping task "${task.name}" - no Player ID`);
    return false;
  }

  try {
    const npidStatus = mapAsanaStatusToNPID(task.status);
    const progress = calculateProgress(task.status, task.stage);
    const currentStage = task.stage || task.status || "Unknown";

    await updateVideoProgress(task.playerId, {
      status: npidStatus as any,
      progress,
      currentStage,
      lastUpdated: new Date().toISOString(),
    });

    console.log(`Synced task "${task.name}" for player ${task.playerId} - ${npidStatus} (${progress}%)`);
    return true;
  } catch (error) {
    console.error(`Failed to sync task "${task.name}" for player ${task.playerId}:`, error);
    return false;
  }
}

async function performSync(): Promise<{ success: number; failed: number; total: number }> {
  console.log("Starting Asana to NPID sync...");
  
  const tasks = await fetchAsanaTasks();
  console.log(`Found ${tasks.length} tasks to sync`);
  
  let successCount = 0;
  let failedCount = 0;
  
  for (const task of tasks) {
    try {
      const result = await syncTaskToNPID(task);
      if (result) {
        successCount++;
      } else {
        failedCount++;
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error syncing task ${task.id}:`, error);
      failedCount++;
    }
  }
  
  return {
    success: successCount,
    failed: failedCount,
    total: tasks.length,
  };
}

export default async function SyncStatus() {
  const toast = await showToast({
    style: Toast.Style.Animated,
    title: "Syncing status...",
    message: "Fetching updated tasks from Asana",
  });

  try {
    const result = await performSync();
    
    if (result.failed === 0) {
      toast.style = Toast.Style.Success;
      toast.title = "Sync Complete";
      toast.message = `Successfully synced ${result.success} tasks to NPID`;
    } else if (result.success > 0) {
      toast.style = Toast.Style.Success;
      toast.title = "Sync Partial";
      toast.message = `Synced ${result.success}/${result.total} tasks (${result.failed} failed)`;
    } else {
      toast.style = Toast.Style.Failure;
      toast.title = "Sync Failed";
      toast.message = `Failed to sync ${result.failed} tasks`;
    }
    
    console.log("Sync Summary:");
    console.log(`  Total tasks: ${result.total}`);
    console.log(`  Successful: ${result.success}`);
    console.log(`  Failed: ${result.failed}`);
    
  } catch (error) {
    console.error("Sync process failed:", error);
    toast.style = Toast.Style.Failure;
    toast.title = "Sync Error";
    toast.message = error instanceof Error ? error.message : "Unknown error occurred";
  }
}