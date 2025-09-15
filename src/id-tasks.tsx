import { Action, ActionPanel, Icon, List, Toast, showToast, Color } from "@raycast/api";
import { useEffect, useState } from "react";
import { request } from "./api/request";
import { Task, CustomField } from "./api/tasks";
import { formatDistanceToNow } from "date-fns";

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

function getStatusIcon(status?: string): Icon {
  switch (status) {
    case "Revise": return Icon.ArrowClockwise;
    case "HUDL": return Icon.CircleFilled;
    case "Dropbox": return Icon.Folder;
    case "Not Approved": return Icon.XMarkCircle;
    case "Uploads": return Icon.ArrowUp;
    case "In Progress": return Icon.Play;
    case "Complete": return Icon.CheckCircle;
    default: return Icon.Circle;
  }
}

function getStatusColor(status?: string): Color {
  switch (status) {
    case "Revise": return Color.Purple;
    case "HUDL": return Color.Red;
    case "Dropbox": return Color.Blue;
    case "Not Approved": return Color.Orange;
    case "Uploads": return Color.Magenta;
    case "In Progress": return Color.Yellow;
    case "Complete": return Color.Green;
    default: return Color.SecondaryText;
  }
}

function getStageIcon(stage?: string): Icon {
  switch (stage) {
    case "Editing": return Icon.Pencil;
    case "Review": return Icon.Eye;
    case "Upload": return Icon.Upload;
    case "Published": return Icon.Globe;
    default: return Icon.Document;
  }
}

async function fetchVideoTasks(): Promise<VideoTask[]> {
  try {
    const response = await request<{ data: Task[] }>("/tasks", {
      params: {
        project: ID_TASKS_PROJECT_GID,
        opt_fields: "id,name,due_on,due_at,completed,projects.name,assignee.name,custom_fields,permalink_url",
        completed_since: "now",
      },
    });
    
    return response.data.data.map(extractCustomFields);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    throw error;
  }
}

async function updateTaskStatus(taskId: string, statusGid: string) {
  try {
    await request(`/tasks/${taskId}`, {
      method: "PUT",
      data: {
        data: {
          custom_fields: {
            [statusGid]: statusGid,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error updating task status:", error);
    throw error;
  }
}

export default function IDTasks() {
  const [tasks, setTasks] = useState<VideoTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const videoTasks = await fetchVideoTasks();
      setTasks(videoTasks.filter(task => !task.completed));
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load tasks",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const searchLower = searchText.toLowerCase();
    return (
      task.name.toLowerCase().includes(searchLower) ||
      task.sport?.toLowerCase().includes(searchLower) ||
      task.class?.toLowerCase().includes(searchLower) ||
      task.playerId?.toLowerCase().includes(searchLower) ||
      task.status?.toLowerCase().includes(searchLower)
    );
  });

  const groupedTasks = filteredTasks.reduce((acc, task) => {
    const status = task.status || "No Status";
    if (!acc[status]) acc[status] = [];
    acc[status].push(task);
    return acc;
  }, {} as Record<string, VideoTask[]>);

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search video tasks..."
      navigationTitle="ID Tasks - Video Editing"
    >
      {Object.entries(groupedTasks).map(([status, statusTasks]) => (
        <List.Section key={status} title={status} subtitle={`${statusTasks.length} tasks`}>
          {statusTasks.map((task) => (
            <List.Item
              key={task.id}
              title={task.name}
              subtitle={`${task.class || "No Class"} • ${task.sport || "No Sport"}`}
              icon={{ source: getStatusIcon(task.status), tintColor: getStatusColor(task.status) }}
              accessories={[
                task.positions ? { text: task.positions, icon: Icon.Person } : null,
                task.due_on
                  ? {
                      text: formatDistanceToNow(new Date(task.due_on), { addSuffix: true }),
                      icon: Icon.Calendar,
                    }
                  : null,
                task.stage
                  ? {
                      icon: getStageIcon(task.stage),
                      tooltip: `Stage: ${task.stage}`,
                    }
                  : null,
              ].filter(Boolean) as any}
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
                    <Action.OpenInBrowser
                      title="Open in Asana"
                      url={task.permalink_url}
                      icon={Icon.Globe}
                    />
                    {task.playerId && (
                      <Action.OpenInBrowser
                        title="Open Player Profile"
                        url={`https://nationalprospectid.com/player/${task.playerId}`}
                        icon={Icon.Person}
                        shortcut={{ modifiers: ["cmd"], key: "p" }}
                      />
                    )}
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    <Action.CopyToClipboard
                      title="Copy Task Name"
                      content={task.name}
                      icon={Icon.Clipboard}
                      shortcut={{ modifiers: ["cmd"], key: "c" }}
                    />
                    {task.playerId && (
                      <Action.CopyToClipboard
                        title="Copy Player ID"
                        content={task.playerId}
                        icon={Icon.Clipboard}
                        shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                      />
                    )}
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    <Action
                      title="Reload Tasks"
                      icon={Icon.ArrowClockwise}
                      onAction={loadTasks}
                      shortcut={{ modifiers: ["cmd"], key: "r" }}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ))}
      {!isLoading && filteredTasks.length === 0 && (
        <List.EmptyView
          title="No Tasks Found"
          description="No video editing tasks match your search"
          icon={Icon.MagnifyingGlass}
        />
      )}
    </List>
  );
}