import React from "react";
import { Form, ActionPanel, Action, showToast, Toast, LaunchProps, Icon } from "@raycast/api";
import { useForm, FormValidation } from "@raycast/utils";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { fetchPlayerDetails } from "./api/npid";

const execAsync = promisify(exec);

interface PlayerLookupFormValues {
  playerName: string;
  playerId?: string;
  searchType: "name" | "id" | "selenium";
  automationAction?: string;
}

interface PlayerInfo {
  id: string;
  name: string;
  sport: string;
  class: string;
  position: string;
  school: string;
  state: string;
  videos?: Array<{
    title: string;
    url: string;
    type: string;
  }>;
}

async function searchByPlayerId(playerId: string): Promise<PlayerInfo> {
  const playerData = await fetchPlayerDetails(playerId);
  
  return {
    id: playerData.id,
    name: playerData.name,
    sport: playerData.sport,
    class: playerData.graduationYear,
    position: playerData.position,
    school: playerData.highSchool,
    state: playerData.state,
    videos: playerData.videos,
  };
}

async function runSeleniumLookup(playerName: string, action: string): Promise<string> {
  const pythonInterpreter = "python3";
  const workspaceDir = "/Users/singleton23/Raycast/scout-singleton";
  const scriptPath = path.join(workspaceDir, "scripts", "player_lookup.py");
  
  const escapeShellArg = (str: string) => `"${str.replace(/"/g, '\\"')}"`;
  
  const command = `${escapeShellArg(pythonInterpreter)} ${escapeShellArg(scriptPath)} --player_name ${escapeShellArg(playerName)} --action ${escapeShellArg(action)}`;
  
  console.log("Executing Selenium command:", command);
  const { stdout, stderr } = await execAsync(command);
  
  if (stderr && stderr.includes("ERROR")) {
    console.error("Selenium script error:", stderr);
    throw new Error(stderr);
  }
  
  return stdout;
}

export default function PlayerLookup(props: LaunchProps<{ draftValues: PlayerLookupFormValues }>) {
  const { handleSubmit, itemProps, reset, focus } = useForm<PlayerLookupFormValues>({
    async onSubmit(formValues) {
      const toast = await showToast({
        style: Toast.Style.Animated,
        title: "Looking up player...",
      });

      try {
        if (formValues.searchType === "id" && formValues.playerId) {
          // Direct API lookup by ID
          toast.message = "Fetching player details from NPID...";
          const playerInfo = await searchByPlayerId(formValues.playerId);
          
          toast.style = Toast.Style.Success;
          toast.title = "Player Found";
          toast.message = `${playerInfo.name} - ${playerInfo.sport} ${playerInfo.class}`;
          
          // Copy player info to clipboard
          const playerDetails = `
Player: ${playerInfo.name}
ID: ${playerInfo.id}
Sport: ${playerInfo.sport}
Class: ${playerInfo.class}
Position: ${playerInfo.position}
School: ${playerInfo.school}
State: ${playerInfo.state}
Videos: ${playerInfo.videos?.length || 0}
          `.trim();
          
          await navigator.clipboard.writeText(playerDetails);
          
        } else if (formValues.searchType === "selenium") {
          // Selenium automation
          toast.message = "Running browser automation...";
          const result = await runSeleniumLookup(
            formValues.playerName,
            formValues.automationAction || "lookup"
          );
          
          if (result.includes("SUCCESS")) {
            toast.style = Toast.Style.Success;
            toast.title = "Automation Complete";
            toast.message = "Player lookup successful";
          } else {
            toast.style = Toast.Style.Failure;
            toast.title = "Automation Failed";
            toast.message = "Check console for details";
          }
          
        } else {
          // Name-based search (could be extended to search NPID API by name)
          toast.message = "Searching by name...";
          
          // For now, use Selenium for name searches
          const result = await runSeleniumLookup(formValues.playerName, "search");
          
          toast.style = Toast.Style.Success;
          toast.title = "Search Complete";
          toast.message = `Found results for ${formValues.playerName}`;
        }
        
        reset();
        
      } catch (error: unknown) {
        console.error("Lookup error:", error);
        toast.style = Toast.Style.Failure;
        toast.title = "Lookup Failed";
        
        if (error instanceof Error) {
          toast.message = error.message || "An unexpected error occurred";
        } else {
          toast.message = "An unexpected error occurred";
        }
      }
    },
    validation: {
      playerName: (value) => {
        if (!value && itemProps.searchType.value !== "id") {
          return "Player name is required";
        }
      },
      playerId: (value) => {
        if (itemProps.searchType.value === "id" && !value) {
          return "Player ID is required for ID lookup";
        }
      },
    },
    initialValues: {
      searchType: "name",
      automationAction: "lookup",
    },
  });

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Lookup Player"
            icon={Icon.MagnifyingGlass}
            onSubmit={handleSubmit}
          />
          <Action
            title="Reset Form"
            icon={Icon.ArrowClockwise}
            onAction={() => {
              reset();
              focus("playerName");
            }}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        title="Search Type"
        {...itemProps.searchType}
      >
        <Form.Dropdown.Item value="name" title="Search by Name" icon={Icon.Person} />
        <Form.Dropdown.Item value="id" title="Search by Player ID" icon={Icon.Hashtag} />
        <Form.Dropdown.Item value="selenium" title="Selenium Automation" icon={Icon.Globe} />
      </Form.Dropdown>
      
      {itemProps.searchType.value !== "id" && (
        <Form.TextField
          title="Player Name"
          placeholder="Enter player's full name"
          {...itemProps.playerName}
        />
      )}
      
      {itemProps.searchType.value === "id" && (
        <Form.TextField
          title="Player ID"
          placeholder="Enter NPID (e.g., 12345)"
          {...itemProps.playerId}
        />
      )}
      
      {itemProps.searchType.value === "selenium" && (
        <>
          <Form.Separator />
          <Form.Dropdown
            title="Automation Action"
            {...itemProps.automationAction}
          >
            <Form.Dropdown.Item value="lookup" title="Lookup Profile" />
            <Form.Dropdown.Item value="search" title="Search Players" />
            <Form.Dropdown.Item value="export" title="Export Data" />
            <Form.Dropdown.Item value="update" title="Update Profile" />
          </Form.Dropdown>
        </>
      )}
      
      <Form.Description
        title="Info"
        text={
          itemProps.searchType.value === "selenium"
            ? "This will open a browser window and perform automated actions"
            : itemProps.searchType.value === "id"
            ? "Direct API lookup using the player's NPID"
            : "Search for players by name in the NPID database"
        }
      />
    </Form>
  );
}