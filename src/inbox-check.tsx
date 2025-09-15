import { Action, ActionPanel, Icon, List, Toast, showToast, Color } from "@raycast/api";
import { useEffect, useState } from "react";
import { fetchInboxMessages, assignInboxMessage, InboxMessage } from "./api/npid";
import { request } from "./api/request";
import { formatDistanceToNow } from "date-fns";

const ID_TASKS_PROJECT_GID = "1208992901563477"; // ID Tasks project GID

function getPriorityIcon(message: InboxMessage): Icon {
  const hoursSinceCreated = (Date.now() - new Date(message.createdAt).getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceCreated > 48) return Icon.ExclamationMark;
  if (hoursSinceCreated > 24) return Icon.Clock;
  return Icon.Dot;
}

function getPriorityColor(message: InboxMessage): Color {
  const hoursSinceCreated = (Date.now() - new Date(message.createdAt).getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceCreated > 48) return Color.Red;
  if (hoursSinceCreated > 24) return Color.Orange;
  return Color.Green;
}

function getSportIcon(sport: string): Icon {
  const sportLower = sport.toLowerCase();
  if (sportLower.includes("football")) return Icon.AmericanFootball;
  if (sportLower.includes("basketball")) return Icon.SoccerBall;
  if (sportLower.includes("baseball")) return Icon.CircleFilled;
  if (sportLower.includes("soccer")) return Icon.SoccerBall;
  if (sportLower.includes("hockey")) return Icon.Trophy;
  if (sportLower.includes("lacrosse")) return Icon.Flag;
  return Icon.Person;
}

async function createAsanaTask(message: InboxMessage): Promise<string> {
  try {
    const response = await request<{ data: { gid: string; permalink_url: string } }>("/tasks", {
      method: "POST",
      data: {
        data: {
          name: `${message.playerName} - ${message.sport} ${message.class}`,
          projects: [ID_TASKS_PROJECT_GID],
          notes: `Player ID: ${message.playerId}\n\nMessage: ${message.message}\n\nVideo Links:\n${message.videoLinks?.join("\n") || "None"}`,
          custom_fields: {
            Sport: message.sport,
            Class: message.class,
            PlayerID: message.playerId,
            Status: "INBOX",
            Stage: "Editing",
          },
        },
      },
    });
    
    return response.data.data.gid;
  } catch (error) {
    console.error("Error creating Asana task:", error);
    throw error;
  }
}

export default function InboxCheck() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedSport, setSelectedSport] = useState<string>("all");

  useEffect(() => {
    loadInboxMessages();
  }, []);

  const loadInboxMessages = async () => {
    try {
      setIsLoading(true);
      const inboxMessages = await fetchInboxMessages();
      setMessages(inboxMessages);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load inbox",
        message: error instanceof Error ? error.message : "Check NPID API settings",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignTask = async (message: InboxMessage) => {
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Creating task...",
    });

    try {
      // Create Asana task
      const taskId = await createAsanaTask(message);
      
      // Mark as assigned in NPID
      await assignInboxMessage(message.id, "current_user");
      
      // Update local state
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      
      toast.style = Toast.Style.Success;
      toast.title = "Task created";
      toast.message = `Assigned ${message.playerName} to Asana`;
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to create task";
      toast.message = error instanceof Error ? error.message : "Unknown error";
    }
  };

  const filteredMessages = messages.filter((message) => {
    const searchLower = searchText.toLowerCase();
    const matchesSearch =
      message.playerName.toLowerCase().includes(searchLower) ||
      message.sport.toLowerCase().includes(searchLower) ||
      message.class.toLowerCase().includes(searchLower) ||
      message.playerId.toLowerCase().includes(searchLower);
    
    const matchesSport = selectedSport === "all" || message.sport === selectedSport;
    
    return matchesSearch && matchesSport;
  });

  const uniqueSports = Array.from(new Set(messages.map((m) => m.sport))).sort();

  const groupedMessages = filteredMessages.reduce((acc, message) => {
    const sport = message.sport;
    if (!acc[sport]) acc[sport] = [];
    acc[sport].push(message);
    return acc;
  }, {} as Record<string, InboxMessage[]>);

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search inbox messages..."
      navigationTitle="NPID Inbox - New Video Requests"
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter by Sport"
          value={selectedSport}
          onChange={setSelectedSport}
        >
          <List.Dropdown.Item title="All Sports" value="all" />
          {uniqueSports.map((sport) => (
            <List.Dropdown.Item key={sport} title={sport} value={sport} />
          ))}
        </List.Dropdown>
      }
    >
      {Object.entries(groupedMessages).map(([sport, sportMessages]) => (
        <List.Section key={sport} title={sport} subtitle={`${sportMessages.length} requests`}>
          {sportMessages.map((message) => (
            <List.Item
              key={message.id}
              title={message.playerName}
              subtitle={`${message.class} • ${message.playerId}`}
              icon={{ source: getSportIcon(message.sport), tintColor: getPriorityColor(message) }}
              accessories={[
                {
                  text: formatDistanceToNow(new Date(message.createdAt), { addSuffix: true }),
                  icon: getPriorityIcon(message),
                },
                message.videoLinks && message.videoLinks.length > 0
                  ? {
                      text: `${message.videoLinks.length}`,
                      icon: Icon.Video,
                      tooltip: "Video links attached",
                    }
                  : null,
              ].filter(Boolean) as any}
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
                    <Action
                      title="Assign to Me"
                      icon={Icon.AddPerson}
                      onAction={() => handleAssignTask(message)}
                      shortcut={{ modifiers: ["cmd"], key: "return" }}
                    />
                    <Action.OpenInBrowser
                      title="View Player Profile"
                      url={`https://nationalprospectid.com/player/${message.playerId}`}
                      icon={Icon.Person}
                      shortcut={{ modifiers: ["cmd"], key: "p" }}
                    />
                    {message.videoLinks?.map((link, index) => (
                      <Action.OpenInBrowser
                        key={index}
                        title={`Open Video ${index + 1}`}
                        url={link}
                        icon={Icon.Video}
                        shortcut={{ modifiers: ["cmd"], key: `${index + 1}` }}
                      />
                    ))}
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    <Action.CopyToClipboard
                      title="Copy Player Name"
                      content={message.playerName}
                      icon={Icon.Clipboard}
                    />
                    <Action.CopyToClipboard
                      title="Copy Player ID"
                      content={message.playerId}
                      icon={Icon.Clipboard}
                    />
                    <Action.CopyToClipboard
                      title="Copy Message"
                      content={message.message}
                      icon={Icon.Text}
                    />
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    <Action
                      title="Reload Inbox"
                      icon={Icon.ArrowClockwise}
                      onAction={loadInboxMessages}
                      shortcut={{ modifiers: ["cmd"], key: "r" }}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ))}
      {!isLoading && filteredMessages.length === 0 && (
        <List.EmptyView
          title="No Messages"
          description={searchText ? "No messages match your search" : "Inbox is empty"}
          icon={Icon.Tray}
        />
      )}
    </List>
  );
}