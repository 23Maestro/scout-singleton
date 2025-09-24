import { Action, ActionPanel, Icon, List, Toast, showToast, Color, Form, useNavigation, Detail } from "@raycast/api";
import { useEffect, useState } from "react";
import { fetchInboxMessages, InboxMessage } from "./api/npid";
import { formatDistanceToNow } from "date-fns";
import { getAssignmentModalData, assignThread, getInboxThreads, getVideoTasks, callAsanaTool } from "./bridge/mcpClient";

const ID_TASKS_PROJECT_GID = "1208992901563477"; // ID Tasks project GID

// Asana email integration endpoints
const ASANA_TASK_EMAIL = "x+1211354715479093@mail.asana.com";
const ASANA_PROJECT_EMAIL = "project+1211354715479093@mail.asana.com";

// Helper function to extract player name from email
function extractPlayerNameFromEmail(email: string): string {
  if (!email) return "Unknown Player";
  
  // Extract name from email (e.g., "maxchill85@gmail.com" -> "Max Chill")
  const localPart = email.split('@')[0];
  
  // Remove numbers and common patterns
  const cleanName = localPart
    .replace(/\d+/g, '') // Remove numbers
    .replace(/[._-]/g, ' ') // Replace separators with spaces
    .trim();
  
  // Capitalize words
  return cleanName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    || "Unknown Player";
}

// Helper function to extract sport from content
function extractSportFromContent(content: string): string {
  if (!content) return "Unknown Sport";
  
  const sports = ["Football", "Basketball", "Baseball", "Soccer", "Hockey", "Lacrosse", "Tennis", "Track", "Swimming"];
  const contentLower = content.toLowerCase();
  
  for (const sport of sports) {
    if (contentLower.includes(sport.toLowerCase())) {
      return sport;
    }
  }
  
  return "Unknown Sport";
}

// Helper function to extract class from content
function extractClassFromContent(content: string): string {
  if (!content) return "Unknown Class";
  
  // Look for graduation year patterns (2024, 2025, 2026, etc.)
  const yearMatch = content.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    return yearMatch[1];
  }
  
  // Look for class indicators
  const classMatch = content.match(/\b(Freshman|Sophomore|Junior|Senior)\b/i);
  if (classMatch) {
    return classMatch[1];
  }
  
  return "Unknown Class";
}

// Helper function to extract JSON from MCP server responses
function extractJsonFromMCPResponse(responseText: string): any {
  try {
    console.log("Full MCP response length:", responseText.length);
    console.log("MCP response preview:", responseText.substring(0, 300));
    
    // Look for JSON array first (most common case for inbox threads)
    let jsonStart = responseText.indexOf('[');
    console.log("Array start position:", jsonStart);
    if (jsonStart === -1) {
      jsonStart = responseText.indexOf('{');
      console.log("Object start position:", jsonStart);
    }
    
    if (jsonStart === -1) {
      console.error("No JSON found in MCP response:", responseText.substring(0, 200));
      throw new Error("No JSON data found in MCP response");
    }
    
    console.log("Using JSON start position:", jsonStart, "Character:", responseText[jsonStart]);
    
    // Find the matching closing bracket/brace
    const jsonText = responseText.substring(jsonStart);
    let bracketCount = 0;
    let braceCount = 0;
    let endIndex = -1;
    
    for (let i = 0; i < jsonText.length; i++) {
      const char = jsonText[i];
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      
      // If we started with array, look for array end
      if (responseText[jsonStart] === '[' && bracketCount === 0 && i > 0) {
        endIndex = i + 1;
        break;
      }
      // If we started with object, look for object end
      if (responseText[jsonStart] === '{' && braceCount === 0 && i > 0) {
        endIndex = i + 1;
        break;
      }
    }
    
    if (endIndex === -1) {
      console.error("Could not find matching closing bracket/brace. JSON text length:", jsonText.length);
      console.error("JSON text preview:", jsonText.substring(0, 500));
      throw new Error("Could not find matching closing bracket/brace");
    }
    
    const extractedJson = jsonText.substring(0, endIndex);
    console.log("Extracted JSON length:", extractedJson.length);
    console.log("Extracted JSON preview:", extractedJson.substring(0, 300));
    
    const parsed = JSON.parse(extractedJson);
    console.log("Parsed JSON type:", Array.isArray(parsed) ? 'array' : 'object');
    console.log("Parsed JSON length:", Array.isArray(parsed) ? parsed.length : 'N/A');
    
    return parsed;
  } catch (error) {
    console.error("JSON parsing error:", error);
    console.error("Response text:", responseText.substring(0, 500));
    throw new Error(`Failed to parse JSON from MCP response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to create Asana task from unassigned email thread
async function createAsanaTaskFromEmail(message: InboxMessage): Promise<void> {
  try {
    // Create email content for Asana task creation
    const emailSubject = `Video Team: ${message.email}`;
    const emailBody = `
From: ${message.email}
Message ID: ${message.messageId}
Contact ID: ${message.contactId}

${message.content}

---
This task was created from NPID Video Team inbox.
    `.trim();

    // Use Asana's email integration to create TASK (not message)
    // This creates an actionable task that needs to be completed
    await callAsanaTool("create_task", {
      name: emailSubject,
      notes: emailBody,
      projects: [ID_TASKS_PROJECT_GID],
      assignee: "Jerami Singleton", // Default assignee
      due_on: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days from now
    });

    console.log(`Created Asana TASK for unassigned email thread: ${message.messageId}`);
  } catch (error) {
    console.error("Error creating Asana task from email:", error);
    throw error;
  }
}

// Helper function to add message to Asana project (for status updates)
async function addMessageToAsanaProject(message: InboxMessage): Promise<void> {
  try {
    // Create message content for project conversation
    const messageContent = `
Status Update from ${message.email}:
Message ID: ${message.messageId}

${message.content}
    `.trim();

    // Use Asana's email integration to create MESSAGE (not task)
    // This adds to project conversation, not as actionable task
    await callAsanaTool("add_comment", {
      task_gid: ID_TASKS_PROJECT_GID, // Add to project as message
      text: messageContent
    });

    console.log(`Added MESSAGE to Asana project for email thread: ${message.messageId}`);
  } catch (error) {
    console.error("Error adding message to Asana project:", error);
    throw error;
  }
}

// Helper function to extract player ID from email content
function extractPlayerIdFromContent(content: string): string {
  // Look for NPID profile URLs in the content
  const urlMatch = content.match(/https:\/\/dashboard\.nationalpid\.com\/athlete\/profile\/(\d+)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  return "";
}

// Helper function to determine if message is from parent or athlete
function isMessageFromParent(content: string, email: string): boolean {
  // Check for common parent indicators
  const parentIndicators = [
    "parent", "father", "mother", "dad", "mom", "family",
    "my son", "my daughter", "my athlete", "my child"
  ];
  
  const contentLower = content.toLowerCase();
  const emailLower = email.toLowerCase();
  
  // Check if email contains parent indicators
  if (parentIndicators.some(indicator => emailLower.includes(indicator))) {
    return true;
  }
  
  // Check if content contains parent indicators
  if (parentIndicators.some(indicator => contentLower.includes(indicator))) {
    return true;
  }
  
  return false;
}

// Helper function to detect if message is part of an ongoing thread (assigned) vs single message (unassigned)
function isMessagePartOfOngoingThread(allMessages: any[], currentMessage: any): boolean {
  // Count how many messages have the same email address
  const sameEmailMessages = allMessages.filter(msg => 
    msg.email === currentMessage.email
  );
  
  // If there are multiple messages from the same email, it's an ongoing thread (assigned)
  // If there's only one message from this email, it's a new inquiry (unassigned)
  return sameEmailMessages.length > 1;
}

// Helper functions to extract data from Asana task names and notes
function extractPlayerNameFromTask(taskName: string): string {
  // Task names are typically: "Player Name - Sport Class" or "Player Name Sport Class"
  const match = taskName.match(/^([^-]+?)(?:\s*-\s*|\s+)(.+)$/);
  if (match) {
    return match[1].trim();
  }
  return taskName.split(' ')[0] || "Unknown Player";
}

function extractPlayerIdFromTask(notes: string): string {
  // Look for Player ID in notes
  const match = notes.match(/Player ID:\s*([^\s\n]+)/i);
  return match ? match[1] : "Unknown";
}

function extractSportFromTask(taskName: string): string {
  // Extract sport from task name
  const sports = ["Football", "Basketball", "Baseball", "Soccer", "Hockey", "Lacrosse", "Tennis", "Track", "Swimming"];
  for (const sport of sports) {
    if (taskName.toLowerCase().includes(sport.toLowerCase())) {
      return sport;
    }
  }
  return "Unknown Sport";
}

function extractClassFromTask(taskName: string): string {
  // Extract class year from task name (e.g., "2025", "2026", "2027", "2028")
  const match = taskName.match(/\b(20\d{2})\b/);
  return match ? match[1] : "Unknown Class";
}

function extractVideoLinksFromTask(notes: string): string[] {
  // Extract video links from notes
  const urlRegex = /https?:\/\/[^\s\n]+/g;
  const matches = notes.match(urlRegex);
  return matches ? matches.filter(url => 
    url.includes('youtube') || url.includes('vimeo') || url.includes('hudl') || url.includes('dropbox')
  ) : [];
}

// Assignment Modal Component - mirrors NPID website workflow
function AssignmentModal({ message, onAssign, onCancel }: { 
  message: InboxMessage; 
  onAssign: (assignee: string, status: string, stage: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [modalData, setModalData] = useState<any>(null);
  const [assignee, setAssignee] = useState("Jerami Singleton"); // Only option
  const [status, setStatus] = useState(""); // Force selection
  const [stage, setStage] = useState(""); // Force selection
  const [contactType, setContactType] = useState("Athlete"); // Athlete or Parent
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  useEffect(() => {
    loadAssignmentModalData();
  }, []);

  const loadAssignmentModalData = async () => {
    try {
      setIsLoading(true);
      // Use contactid if available, otherwise fall back to message.id
      const contactId = (message as any).contactid || message.id;
      const response = await getAssignmentModalData(contactId);
      
      if (response.success) {
        // Parse the MCP response
        const data = extractJsonFromMCPResponse(response.data);
        setModalData(data);
        
        // Auto-detect athlete if found in database
        if (data.athlete_data) {
          setSelectedPlayer(data.athlete_data);
          setContactType("Athlete");
        }
      }
    } catch (error) {
      console.error("Failed to load assignment modal data:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load assignment options",
        message: "Using default values"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignment = async () => {
    try {
      await onAssign(assignee, status, stage);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Assignment failed",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Assign Task"
            icon={Icon.AddPerson}
            onSubmit={handleAssignment}
          />
          <Action
            title="Cancel"
            icon={Icon.XMarkCircle}
            onAction={onCancel}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Assignment Details"
        text={`Player: ${message.playerName}\nSport: ${message.sport}\nClass: ${message.class}`}
      />
I      <Form.Separator />
      
      <Form.Dropdown
        id="contactType"
        title="Contact Type"
        value={contactType}
        onChange={setContactType}
      >
        <Form.Dropdown.Item value="Athlete" title="Athlete" icon={Icon.Person} />
        <Form.Dropdown.Item value="Parent" title="Parent" icon={Icon.TwoPeople} />
      </Form.Dropdown>

      {contactType === "Parent" && (
        <Form.TextField
          id="playerSearch"
          title="Search Player"
          placeholder="Enter player name to search..."
          value={searchQuery}
          onChange={setSearchQuery}
        />
      )}

      {selectedPlayer && (
        <Form.Description
          title="Selected Player"
          text={`${selectedPlayer.name} - ${selectedPlayer.sport} ${selectedPlayer.grad_year}\nTop 500: ${selectedPlayer.top_500 || "N/A"}`}
        />
      )}

      <Form.Separator />

      <Form.Dropdown
        id="assignee"
        title="Assigned Owner"
        value={assignee}
        onChange={setAssignee}
      >
        <Form.Dropdown.Item value="Jerami Singleton" title="Jerami Singleton" icon={Icon.Person} />
      </Form.Dropdown>

      <Form.Dropdown
        id="status"
        title="Video Status"
        value={status}
        onChange={setStatus}
        placeholder="Select Status..."
      >
        <Form.Dropdown.Item value="Revisions" title="Revisions" icon={Icon.Pencil} />
        <Form.Dropdown.Item value="HUDL" title="HUDL" icon={Icon.Video} />
        <Form.Dropdown.Item value="Dropbox" title="Dropbox" icon={Icon.Cloud} />
        <Form.Dropdown.Item value="External Links" title="External Links" icon={Icon.Link} />
        <Form.Dropdown.Item value="Not Approved" title="Not Approved" icon={Icon.XMarkCircle} />
      </Form.Dropdown>

      <Form.Dropdown
        id="stage"
        title="Video Stage" 
        value={stage}
        onChange={setStage}
        placeholder="Select Stage..."
      >
        <Form.Dropdown.Item value="On Hold" title="On Hold" icon={Icon.Pause} />
        <Form.Dropdown.Item value="Awaiting Client" title="Awaiting Client" icon={Icon.Clock} />
        <Form.Dropdown.Item value="In Queue" title="In Queue" icon={Icon.List} />
        <Form.Dropdown.Item value="Done" title="Done" icon={Icon.CheckCircle} />
      </Form.Dropdown>

      <Form.Separator />
      
      <Form.Description
        title="Email Integration"
        text="Task will be created in Asana with email forwarding to: x+1211354715479093@mail.asana.com"
      />
    </Form>
  );
}

function getPriorityIcon(message: InboxMessage): Icon {
  try {
    const createdDate = new Date(message.createdAt);
    if (isNaN(createdDate.getTime())) return Icon.Dot;
    
    const hoursSinceCreated = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceCreated > 48) return Icon.ExclamationMark;
    if (hoursSinceCreated > 24) return Icon.Clock;
    return Icon.Dot;
  } catch (error) {
    return Icon.Dot;
  }
}

function getPriorityColor(message: InboxMessage): Color {
  try {
    const createdDate = new Date(message.createdAt);
    if (isNaN(createdDate.getTime())) return Color.Green;
    
    const hoursSinceCreated = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceCreated > 48) return Color.Red;
    if (hoursSinceCreated > 24) return Color.Orange;
    return Color.Green;
  } catch (error) {
    return Color.Green;
  }
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

async function createAsanaTaskWithEmailIntegration(message: InboxMessage): Promise<string> {
  try {
    // Get workspace to ensure proper context
    const workspacesResponse = await callAsanaTool("asana_list_workspaces", {
      opt_fields: "gid,name,is_organization"
    });

    if (!workspacesResponse.success) {
      throw new Error(workspacesResponse.error || "Failed to fetch workspaces");
    }

    const workspaces = JSON.parse(workspacesResponse.data).data;
    const workspace = workspaces.find(ws => ws.name === "National Prospect ID") || workspaces[0];

    if (!workspace?.gid) {
      throw new Error("No valid workspace found");
    }

    // Add custom fields with values
    const customFields: Record<string, any> = {};
    if (message.sport) customFields["Sport"] = message.sport;
    if (message.class) customFields["Grad Year"] = message.class;
    if (message.playerId) customFields["PlayerID"] = message.playerId;

    // Set default status and stage for video workflow
    customFields["Status"] = "INBOX";
    customFields["Stage"] = "Editing";

    // Create the task with email integration - using correct parameter structure
    const taskData = {
      project_id: ID_TASKS_PROJECT_GID,
      name: `${message.playerName}${message.sport ? ` - ${message.sport}` : ""}${message.class ? ` ${message.class}` : ""}`,
      notes: `📧 Email Integration: x+1211354715479093@mail.asana.com
      
🏃 Player: ${message.playerName}
🆔 Player ID: ${message.playerId || "Unknown"}
🏆 Sport: ${message.sport || "Not specified"}
🎓 Class: ${message.class || "Not specified"}

📩 Original Message:
${message.message || "No message provided"}

🎥 Video Links:
${message.videoLinks?.map((link, index) => `${index + 1}. ${link}`).join("\n") || "None"}

📥 NPID Thread ID: ${message.id}
⏰ Created: ${new Date(message.createdAt).toLocaleString()}

---
📬 To update this task via email, reply to: x+1211354715479093@mail.asana.com
🔗 Player Profile: https://nationalprospectid.com/player/${message.playerId}`,
      assignee: "Jerami Singleton",
      custom_fields: customFields
    };

    console.log("Creating Asana task with email integration:", taskData);

    const response = await callAsanaTool("asana_create_task", taskData);

    if (!response.success) {
      throw new Error(response.error || "Failed to create task");
    }

    const responseData = JSON.parse(response.data);
    if (!responseData?.data?.gid) {
      throw new Error("Invalid response from Asana API - missing task GID");
    }

    console.log(`✅ Task created with email integration: ${responseData.data.gid}`);
    return responseData.data.gid;
  } catch (error) {
    console.error("Error creating Asana task with email integration:", error);
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      console.error("Asana API Error Details:", axiosError.response?.data);
      throw new Error(`Asana API Error: ${axiosError.response?.data?.errors?.[0]?.message || axiosError.message}`);
    }
    throw error;
  }
}

// Keep the original function as fallback
async function createAsanaTask(message: InboxMessage): Promise<string> {
  return createAsanaTaskWithEmailIntegration(message);
}

// Email Content Detail Component
function EmailContentDetail({ message, onBack, onAssign }: { 
  message: InboxMessage; 
  onBack: () => void;
  onAssign: (message: InboxMessage) => void;
}) {
  const markdownContent = `
# ${message.playerName}

## Sender Information
**Email:** ${message.email}  
**Received:** ${message.receivedAt || "Unknown date"}  
**Thread ID:** ${message.id}  
**Message ID:** ${message.messageId}  
**Contact ID:** ${message.contactId || "None"}  

## Assignment Status
**Status:** ${message.isAssigned ? '🔄 Assigned' : '🆕 Unassigned'}  
**Assigned To:** ${message.assignedTo || "Not assigned"}  

## Player Details
**Player ID:** ${message.playerId || "None"}  
**Sport:** ${message.sport}  
**Class:** ${message.class}  

---

## Email Content

${message.content || "No content available"}

---

## Technical Details
- **Thread ID:** ${message.id}
- **Message ID:** ${message.messageId}
- **Contact ID:** ${message.contactId || "None"}
- **Created At:** ${message.createdAt}
- **Received At:** ${message.receivedAt || "Unknown"}
`;

  return (
    <Detail
      markdown={markdownContent}
      actions={
        <ActionPanel>
          <Action title="Back to Inbox" onAction={onBack} icon={Icon.ArrowLeft} />
          <Action
            title="Assign Message"
            onAction={() => onAssign(message)}
            icon={Icon.Person}
            shortcut={{ modifiers: ["cmd"], key: "return" }}
          />
        </ActionPanel>
      }
    />
  );
}

export default function InboxCheck() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<string>("unassigned");
  const [showEmailContent, setShowEmailContent] = useState<InboxMessage | null>(null);
  const { push } = useNavigation();

  useEffect(() => {
    loadInboxMessages();
  }, [assignmentFilter]);

  const loadInboxMessages = async () => {
    try {
      setIsLoading(true);
      
      // Always load NPID inbox threads using MCP server (both unassigned and assigned)
      const response = await getInboxThreads(50);
      if (response.success && response.data) {
        console.log("RAW MCP RESPONSE:", response.data);
        
        // Handle direct array response from Selenium integration
        let threads = [];
        if (Array.isArray(response.data)) {
          threads = response.data;
        } else if (typeof response.data === 'string') {
          // Fallback for string responses (legacy MCP format)
          const result = extractJsonFromMCPResponse(response.data);
          if (Array.isArray(result)) {
            threads = result;
          } else if (result.data && Array.isArray(result.data)) {
            threads = result.data;
          } else if (result.inbox_threads && Array.isArray(result.inbox_threads)) {
            threads = result.inbox_threads;
          }
        }
        
        // Use all threads - we'll filter based on NPID API's actual assignment status
        const allThreads = threads;
          
          // Transform Selenium data to InboxMessage format
          console.log("TRANSFORMING MESSAGES - Total threads:", allThreads.length);
          const transformedMessages: InboxMessage[] = allThreads.map((thread: any, index: number) => {
            // Show RAW data for first message
            if (index === 0) {
              console.log("🔍 RAW SELENIUM DATA:", JSON.stringify(thread, null, 2));
            }
            
            // Use Selenium thread data directly
            const playerName = thread.player_name || "Unknown Player";
            const playerId = thread.player_id || "unknown";
            const email = thread.email || "";
            const content = thread.content || "";
            const subject = thread.subject || "";
            const messageId = thread.message_id || "";
            const contactId = thread.contactid || "";
            
            // Use Selenium's assignment detection
            const isAssigned = thread.is_assigned === true;
            const actualStatus = isAssigned ? "assigned" : "unassigned";
            const assignedTo = thread.assigned_to || undefined;
            
            console.log(`🔍 ${playerName}: ${isAssigned ? 'ASSIGNED (per NPID API)' : 'UNASSIGNED (per NPID API)'}`);
            
            return {
              id: messageId,
              playerName: playerName,
              sport: extractSportFromContent(content) || "Unknown Sport",
              class: extractClassFromContent(content) || "Unknown Class", 
              playerId: playerId,
              email: email,
              content: content,
              messageId: messageId,
              contactId: contactId,
              status: actualStatus,
              assignedTo: assignedTo,
              isAssigned: isAssigned,
              createdAt: thread.created_at || new Date().toISOString(),
              receivedAt: thread.received_at || "",
              profileImage: "",
              hasContactId: !!contactId,
              isFromParent: isMessageFromParent(content, email),
              playerIdFromUrl: playerId
            };
          });
          
          console.log("TRANSFORMATION COMPLETE - Final message count:", transformedMessages.length);
          
          // 🎯 NEW: Filter messages based on detected assignment status
          let filteredMessages = transformedMessages;
          if (assignmentFilter === "unassigned") {
            filteredMessages = transformedMessages.filter(msg => !msg.isAssigned);
            console.log(`🔍 FILTERED TO UNASSIGNED: ${filteredMessages.length} messages`);
          } else if (assignmentFilter === "assigned") {
            filteredMessages = transformedMessages.filter(msg => msg.isAssigned);
            console.log(`🔍 FILTERED TO ASSIGNED: ${filteredMessages.length} messages`);
          }
          
          setMessages(filteredMessages);
        } else {
          throw new Error(response.error || "Failed to fetch NPID inbox");
        }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Check MCP connection";
      
      // Provide specific guidance for authentication errors
      if (errorMessage.includes("401") || errorMessage.includes("authentication")) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Authentication Error",
          message: "NPID tokens expired. Check get-fresh-tokens.md for instructions.",
        });
      } else if (errorMessage.includes("500")) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Server Error",
          message: "MCP server error. Check Docker containers are running.",
        });
      } else {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to load inbox",
          message: errorMessage,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignTask = async (message: InboxMessage) => {
    // Open assignment modal for unassigned items
    push(
      <AssignmentModal
        message={message}
        onAssign={async (assignee: string, status: string, stage: string) => {
          const toast = await showToast({
            style: Toast.Style.Animated,
            title: "Processing assignment...",
          });

          try {
            // 1. POST assignment to NPID inbox using message_id
            const assignResult = await assignThread(message.id, assignee, status, stage);
            if (!assignResult.success) {
              throw new Error(assignResult.error || "Failed to assign in NPID");
            }

            // 2. Create Asana task with email integration
            const taskId = await createAsanaTask(message);
            
            // 3. Update local state
            setMessages((prev) => prev.filter((m) => m.id !== message.id));
            
            toast.style = Toast.Style.Success;
            toast.title = "Assignment Complete";
            toast.message = `${message.playerName} assigned to ${assignee}`;
            
            // Navigate back
            push(<></>);
          } catch (error) {
            toast.style = Toast.Style.Failure;
            toast.title = "Assignment failed";
            toast.message = error instanceof Error ? error.message : "Unknown error";
          }
        }}
        onCancel={() => push(<></>)}
      />
    );
  };

  const filteredMessages = messages.filter((message) => {
    if (!searchText) return true;
    
    const searchLower = searchText.toLowerCase();
    const matchesSearch =
      (message.playerName?.toLowerCase().includes(searchLower)) ||
      (message.sport?.toLowerCase().includes(searchLower)) ||
      (message.class?.toLowerCase().includes(searchLower)) ||
      (message.playerId?.toLowerCase().includes(searchLower)) ||
      (message.email?.toLowerCase().includes(searchLower)) ||
      (message.content?.toLowerCase().includes(searchLower)) ||
      (message.messageId?.toLowerCase().includes(searchLower));
    
    return matchesSearch;
  });

  // Remove sport grouping - show flat list
  const flatMessages = filteredMessages;

  // Show email content detail if a message is selected
  if (showEmailContent) {
    return (
      <EmailContentDetail
        message={showEmailContent}
        onBack={() => setShowEmailContent(null)}
        onAssign={(message) => {
          setShowEmailContent(null);
          handleAssignTask(message);
        }}
      />
    );
  }

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search inbox messages..."
      navigationTitle="NPID Video Team Inbox"
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter by Assignment Status"
          value={assignmentFilter}
          onChange={setAssignmentFilter}
        >
          <List.Dropdown.Item title="🆕 Unassigned (New Inquiries)" value="unassigned" icon={Icon.Envelope} />
          <List.Dropdown.Item title="🔄 Assigned (Ongoing Threads)" value="assigned" icon={Icon.Check} />
        </List.Dropdown>
      }
    >
      {flatMessages.map((message) => (
            <List.Item
              key={message.id}
              title={message.playerName}
              subtitle={`${message.receivedAt || "Unknown date"} • ${message.isAssigned ? '🔄 Assigned' : '🆕 Unassigned'}`}
              detail={
                <List.Item.Detail
                  markdown={`**${message.playerName}** (${message.email})
                  
**Message Content:**
${message.content?.substring(0, 500) || "No content available"}${message.content && message.content.length > 500 ? "..." : ""}

**Details:**
- Sport: ${message.sport}
- Class: ${message.class}
- Player ID: ${message.playerId}
- Message ID: ${message.messageId}
- Contact ID: ${message.contactId || "None"}
- **Status**: ${message.isAssigned ? '🔄 Assigned (Ongoing Thread)' : '🆕 Unassigned (New Inquiry)'}`}
                />
              }
              icon={{ source: getSportIcon(message.sport), tintColor: getPriorityColor(message) }}
              accessories={[
                {
                  text: (() => {
                    try {
                      const date = new Date(message.createdAt);
                      return isNaN(date.getTime()) ? "Unknown time" : formatDistanceToNow(date, { addSuffix: true });
                    } catch (error) {
                      return "Unknown time";
                    }
                  })(),
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
                      title="View Email Content"
                      icon={Icon.Eye}
                      onAction={() => setShowEmailContent(message)}
                      shortcut={{ modifiers: ["cmd"], key: "e" }}
                    />
                    {message.isAssigned ? (
                      <Action.OpenInBrowser
                        title="Open Asana Task"
                        url={`https://app.asana.com/0/1208992901563477/${message.id}`}
                        icon={Icon.Link}
                        shortcut={{ modifiers: ["cmd"], key: "return" }}
                      />
                    ) : (
                      <Action
                        title="Assign Task"
                        icon={Icon.AddPerson}
                        onAction={() => handleAssignTask(message)}
                        shortcut={{ modifiers: ["cmd"], key: "return" }}
                      />
                    )}
                    <Action.OpenInBrowser
                      title="View Player Profile"
                      url={`https://nationalprospectid.com/player/${message.playerId}`}
                      icon={Icon.Person}
                      shortcut={{ modifiers: ["cmd"], key: "v" }}
                    />
                    {message.videoLinks?.map((link, index) => (
                      <Action.OpenInBrowser
                        key={index}
                        title={`Open Video ${index + 1}`}
                        url={link}
                        icon={Icon.Video}
                        shortcut={{ modifiers: ["cmd"], key: "1" }}
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
                    {assignmentFilter === "assigned" && (
                      <Action.CopyToClipboard
                        title="Copy Asana Task ID"
                        content={message.id}
                        icon={Icon.Clipboard}
                      />
                    )}
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