import { Action, ActionPanel, List, Toast, showToast, Icon, Color } from "@raycast/api";
import { useEffect, useState } from "react";
import { searchPlayer, callAsanaTool } from "./bridge/mcpClient";

const ID_TASKS_PROJECT_GID = "1211354715479093"; // ID Tasks project GID (corrected)
const CUTOFF_DATE = "2025-09-20"; // Don't backfill tasks newer than this

interface BackfillTask {
  id: string;
  name: string;
  created_at: string;
  custom_fields: Record<string, unknown>;
  missingFields: string[];
  playerName: string;
}

interface BackfillResult {
  taskId: string;
  playerName: string;
  fieldsUpdated: string[];
  status: "success" | "failed" | "no_match";
  error?: string;
}

export default function BackfillAsanaData() {
  const [tasks, setTasks] = useState<BackfillTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<BackfillResult[]>([]);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    loadOldTasks();
  }, []);

  const loadOldTasks = async () => {
    try {
      setIsLoading(true);

      // Use MCP server for Asana integration
      const workspacesResult = await callAsanaTool("asana_list_workspaces", {
        opt_fields: "gid,name"
      });

      if (!workspacesResult.success) {
        throw new Error(`Failed to fetch workspaces: ${workspacesResult.error}`);
      }

      // Debug: Log the actual data structure
      console.log('Workspaces result data type:', typeof workspacesResult.data);
      console.log('Workspaces result data:', workspacesResult.data);

      // Parse the workspace data from MCP response
      // The MCP client returns { success: true, data: { success: true, data: "string with emoji and JSON" } }
      const dataString = workspacesResult.data.data;
      // Find the JSON part by looking for the first '{' after the emoji line
      const jsonStart = dataString.indexOf('{');
      const jsonString = dataString.substring(jsonStart);
      const workspaceData = JSON.parse(jsonString);
      const workspaces = workspaceData.data;
        const workspace = workspaces.find((ws: { name: string; gid: string }) => ws.name === "National Prospect ID") || workspaces[0];

      if (!workspace?.gid) {
        throw new Error("No valid workspace found");
      }

      // Get all tasks from the ID Tasks project using MCP server
      const tasksResult = await callAsanaTool("asana_search_tasks", {
        project_id: ID_TASKS_PROJECT_GID,
        opt_fields: "gid,name,created_at,due_on,custom_fields"
      });

      if (!tasksResult.success) {
        throw new Error(`Failed to fetch tasks: ${tasksResult.error}`);
      }

      // Parse the tasks data from MCP response - same structure as workspaces
      const tasksDataString = tasksResult.data.data;
      console.log('Tasks data string length:', tasksDataString.length);
      console.log('Tasks data string preview:', tasksDataString.substring(0, 200));
      
      const tasksJsonStart = tasksDataString.indexOf('{');
      console.log('JSON start position:', tasksJsonStart);
      
      if (tasksJsonStart === -1) {
        throw new Error('No JSON found in tasks response');
      }
      
      const tasksJsonString = tasksDataString.substring(tasksJsonStart);
      console.log('JSON string preview:', tasksJsonString.substring(0, 200));
      
      let allTasks;
      try {
        const tasksData = JSON.parse(tasksJsonString);
        allTasks = tasksData.data;
        console.log('Successfully parsed tasks, count:', allTasks.length);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Failed JSON string:', tasksJsonString.substring(0, 500));
        throw new Error(`Failed to parse tasks JSON: ${parseError.message}`);
      }
      
        // Filter to old tasks (before cutoff date) based on created_at date
        // Use created_at instead of due_on since many tasks don't have due dates
        const oldTasks = allTasks.filter((task: { created_at?: string }) => {
          if (!task.created_at) {
            // If no created date, include the task for backfill
            return true;
          }
          const createdDate = new Date(task.created_at);
          const cutoffDate = new Date(CUTOFF_DATE);
          return createdDate < cutoffDate;
        });

        // Analyze each task for missing fields
        const analyzedTasks = oldTasks.map((task: { gid: string; name: string; created_at: string; custom_fields: unknown[] }) => {
          const playerName = extractPlayerName(task.name);
          const missingFields = findMissingFields(task.custom_fields);
          
          return {
            id: task.gid,
            name: task.name,
            created_at: task.created_at,
            custom_fields: task.custom_fields,
            missingFields,
            playerName
          };
        }).filter((task: { missingFields: string[]; playerName: string }) => 
          task.missingFields.length > 0 && 
          task.playerName
        );

      setTasks(analyzedTasks);
      
      await showToast({
        style: Toast.Style.Success,
        title: "Analysis Complete",
        message: `Found ${analyzedTasks.length} tasks needing backfill`
      });
      
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load tasks",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const extractPlayerName = (taskTitle: string): string => {
    // Extract first and last name from task title
    // Handles formats like "John Smith - Football" or "John Smith"
    const cleanTitle = taskTitle.split(" - ")[0].trim();
    
    // Simple validation: should have at least first and last name
    const nameParts = cleanTitle.split(" ");
    if (nameParts.length >= 2) {
      return `${nameParts[0]} ${nameParts[1]}`;
    }
    
    return cleanTitle;
  };

  const findMissingFields = (customFields: unknown[]): string[] => {
    const missingFields: string[] = [];
    
    // Map field names to their GIDs
    const fieldMap = {
      "PlayerID": "1211354954207084",
      "Sport": "1211354953568209",
      "Positions": "1211354954207099",
      "City, State": "1211354954207089",
      "Grad Year": "1211354953568219",
      "High School": "1211354954207094",
      "Payment Status": "1211354954207104"
    };

    Object.keys(fieldMap).forEach(fieldName => {
      const fieldGid = (fieldMap as Record<string, string>)[fieldName];
      const field = customFields?.find((cf: unknown) => {
        const customField = cf as { gid: string; text_value?: string; enum_value?: { name: string } };
        return customField.gid === fieldGid;
      }) as { gid: string; text_value?: string; enum_value?: { name: string } } | undefined;
      
      // Check if field is missing or has no value
      let hasValue = false;
      if (field) {
        // For text fields, check text_value
        if (field.text_value && field.text_value.trim() !== "") {
          hasValue = true;
        }
        // For enum fields, check enum_value
        if (field.enum_value && field.enum_value.name) {
          hasValue = true;
        }
      }
      
      if (!hasValue) {
        missingFields.push(fieldName);
      }
    });
    
    return missingFields;
  };

  const backfillSingleTask = async (task: BackfillTask): Promise<BackfillResult> => {
    try {
      // Search NPID for player data
      const searchResponse = await searchPlayer(task.playerName);
      
      if (!searchResponse.success) {
        return {
          taskId: task.id,
          playerName: task.playerName,
          fieldsUpdated: [],
          status: "failed",
          error: searchResponse.error
        };
      }

      const npidData = JSON.parse(searchResponse.data);
      
      // Check if we found a match
      if (!npidData || npidData.length === 0) {
        return {
          taskId: task.id,
          playerName: task.playerName,
          fieldsUpdated: [],
          status: "no_match"
        };
      }

      // Use first match (could be enhanced with better matching logic)
      const playerData = npidData[0];
      
      // Build custom fields update based on missing fields
      const customFieldUpdates: Record<string, string> = {};
      const fieldsToUpdate: string[] = [];

      // Enum option mappings based on actual Asana data
      const sportEnumMap: Record<string, string> = {
        "Football": "1211354953568212",    // 🏈 Football
        "Basketball": "1211354953568211",  // 🏀 Basketball  
        "Baseball": "1211354953568210",    // ⚾ Baseball
        "Softball": "1211354953568213"     // 🥎 Softball
      };

      const gradYearEnumMap: Record<string, string> = {
        "2024": "1211354953568221",
        "2025": "1211354953568222", 
        "2026": "1211354953568223",
        "2027": "1211354953568224",
        "2028": "1211354953568225",
        "2029": "1211354953568226"
      };

      // Payment Status enum mapping
      const paymentStatusEnumMap: Record<string, string> = {
        "Paid": "1211354954207105",
        "Failed": "1211354954207106"
      };

      task.missingFields.forEach(fieldName => {
        let value = "";
        let gid = "";
        let isEnumField = false;
        
        switch (fieldName) {
          case "PlayerID":
            value = playerData.player_profile_url;
            gid = "1211354954207084";
            break;
          case "Sport": {
            // Map sport name to enum option GID
            const sportKey = playerData.sport?.replace(/[\u{1F3C8}\u{1F3C0}\u{26BE}\u{1F94E}]/gu, "").trim();
            if (sportKey && sportEnumMap[sportKey]) {
              value = sportEnumMap[sportKey];
              gid = "1211354953568209";
              isEnumField = true;
            }
            break;
          }
          case "Positions":
            value = playerData.positions;
            gid = "1211354954207099";
            break;
          case "City, State":
            value = `${playerData.city}, ${playerData.state}`;
            gid = "1211354954207089";
            break;
          case "Grad Year": {
            // Map grad year to enum option GID
            const gradYear = playerData.grad_year?.toString();
            if (gradYear && gradYearEnumMap[gradYear]) {
              value = gradYearEnumMap[gradYear];
              gid = "1211354953568219";
              isEnumField = true;
            }
            break;
          }
          case "High School":
            value = playerData.high_school;
            gid = "1211354954207094";
            break;
          case "Payment Status": {
            // Map payment status to enum option GID
            const paymentStatus = playerData.payment_status;
            if (paymentStatus && paymentStatusEnumMap[paymentStatus]) {
              value = paymentStatusEnumMap[paymentStatus];
              gid = "1211354954207104";
              isEnumField = true;
            }
            break;
          }
        }

        if (value && value.toString().trim() !== "" && gid) {
          if (isEnumField) {
            // For enum fields, use the enum option GID directly
            customFieldUpdates[gid] = value;
          } else {
            // For text fields, use the value directly
            customFieldUpdates[gid] = value;
          }
          fieldsToUpdate.push(fieldName);
        }
      });

    // Update Asana task if we have data to update
    if (Object.keys(customFieldUpdates).length > 0) {
      const updateResult = await callAsanaTool("asana_update_task", {
        task_id: task.id,
        custom_fields: JSON.stringify(customFieldUpdates)
      });

      if (!updateResult.success) {
        console.error(`Failed to update task ${task.id}:`, updateResult.error);
        return {
          taskId: task.id,
          playerName: task.playerName,
          fieldsUpdated: [],
          status: "failed",
          error: `Update failed: ${updateResult.error}`
        };
      }
    }

      return {
        taskId: task.id,
        playerName: task.playerName,
        fieldsUpdated: fieldsToUpdate,
        status: "success"
      };

    } catch (error) {
      return {
        taskId: task.id,
        playerName: task.playerName,
        fieldsUpdated: [],
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  };

  const backfillAllDoneTasks = async () => {
    setResults([]);
    // Note: BackfillTask doesn't have stage property, so we'll backfill all tasks
    // If you need to filter by stage, you'd need to add it to the interface and fetch it
    for (const task of tasks) {
      await backfillSingleTask(task);
    }
  };

  const backfillAllTasks = async () => {
    setResults([]);
    
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Backfilling data...",
      message: "Processing tasks"
    });

    try {
      const allResults: BackfillResult[] = [];
      
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        toast.message = `Processing ${i + 1}/${tasks.length}: ${task.playerName}`;
        
        const result = await backfillSingleTask(task);
        allResults.push(result);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setResults(allResults);
      
      const successful = allResults.filter(r => r.status === "success").length;
      const failed = allResults.filter(r => r.status === "failed").length;
      const noMatch = allResults.filter(r => r.status === "no_match").length;
      
      toast.style = Toast.Style.Success;
      toast.title = "Backfill Complete";
      toast.message = `✅ ${successful} success, ❌ ${failed} failed, 🔍 ${noMatch} no match`;
      
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Backfill failed";
      toast.message = error instanceof Error ? error.message : "Unknown error";
    }
  };

  const filteredTasks = tasks.filter(task =>
    task.playerName.toLowerCase().includes(searchText.toLowerCase()) ||
    task.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const getResultIcon = (taskId: string): { icon: Icon; color: Color } => {
    const result = results.find(r => r.taskId === taskId);
    if (!result) return { icon: Icon.Minus, color: Color.SecondaryText };
    
    switch (result.status) {
      case "success":
        return { icon: Icon.Check, color: Color.Green };
      case "failed":
        return { icon: Icon.XMarkCircle, color: Color.Red };
      case "no_match":
        return { icon: Icon.QuestionMark, color: Color.Orange };
      default:
        return { icon: Icon.Minus, color: Color.SecondaryText };
    }
  };

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search tasks to backfill..."
      navigationTitle={`Backfill Asana Data (${tasks.length} tasks)`}
      actions={
        <ActionPanel>
          <Action
            title="Backfill All Missing Data"
            icon={Icon.Download}
            onAction={backfillAllTasks}
            shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
          />
            <Action
              title="Backfill All Done Tasks"
              icon={Icon.Download}
              onAction={backfillAllDoneTasks}
              shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
            />
            <Action
              title="Reload Tasks"
              icon={Icon.ArrowClockwise}
              onAction={loadOldTasks}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
            />
        </ActionPanel>
      }
    >
      {filteredTasks.map((task) => {
        const resultStatus = getResultIcon(task.id);
        
        return (
          <List.Item
            key={task.id}
            title={task.playerName}
            subtitle={task.name}
            icon={{ source: resultStatus.icon, tintColor: resultStatus.color }}
            accessories={[
              { text: `${task.missingFields.length} fields`, icon: Icon.Exclamationmark },
              { text: new Date(task.created_at).toLocaleDateString() }
            ]}
            actions={
              <ActionPanel>
                <Action
                  title="Backfill This Task"
                  icon={Icon.Download}
                  onAction={async () => {
                    const toast = await showToast({
                      style: Toast.Style.Animated,
                      title: "Backfilling...",
                      message: task.playerName
                    });
                    
                    const result = await backfillSingleTask(task);
                    setResults(prev => [...prev.filter(r => r.taskId !== task.id), result]);
                    
                    if (result.status === "success") {
                      toast.style = Toast.Style.Success;
                      toast.title = "Success";
                      toast.message = `Updated ${result.fieldsUpdated.length} fields`;
                    } else {
                      toast.style = Toast.Style.Failure;
                      toast.title = "Failed";
                      toast.message = result.error || "No match found";
                    }
                  }}
                />
                <Action
                  title="View Missing Fields"
                  icon={Icon.List}
                  onAction={() => showToast({
                    style: Toast.Style.Success,
                    title: "Missing Fields",
                    message: task.missingFields.join(", ")
                  })}
                />
              </ActionPanel>
            }
          />
        );
      })}
      
      {!isLoading && filteredTasks.length === 0 && (
        <List.EmptyView
          title="No Tasks Need Backfill"
          description="All old tasks appear to have complete data"
          icon={Icon.CheckCircle}
        />
      )}
    </List>
  );
}
