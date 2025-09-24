import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { getPreferenceValues } from "@raycast/api";
import { VideoTask, TaskStage, TaskStatus } from "../types/workflow";
// No project GID required; we fetch tasks from the user's workspace instead

const ASANA = "https://app.asana.com/api/1.0";

interface AsanaPreferences { asanaAccessToken: string }

type RawTask = {
  gid: string;
  name: string;
  permalink_url?: string;
  due_on?: string | null;
  custom_fields?: Array<{
    gid: string;
    name?: string;
    text_value?: string;
    number_value?: number | null;
    enum_value?: { name?: string } | null;
    date_value?: string | null;
    display_value?: string | null;
  }>;
};

type Workspace = { gid: string; name: string; is_organization?: boolean };
type AsanaListResponse<T> = { data: T[]; next_page?: { offset?: string | null } };

function cf(task: RawTask, fieldName: string) {
  const f = task.custom_fields?.find((x) => x.name === fieldName);
  if (!f) return undefined;
  if (typeof f.text_value === "string") return f.text_value.trim() || undefined;
  if (f.number_value != null) return String(f.number_value);
  if (f.enum_value?.name) return f.enum_value.name as string;
  if (f.display_value) return f.display_value as string;
  if (f.date_value) return f.date_value as string;
  return undefined;
}

const toStage = (s?: string): TaskStage =>
  (["On Hold", "Awaiting Client", "In Queue", "Done"].includes(s ?? "") ? (s as TaskStage) : "Unknown");

const toStatus = (s?: string): TaskStatus =>
  (["Revisions", "HUDL", "Dropbox", "External Links", "Not Approved"].includes(s ?? "") ? (s as TaskStatus) : "Unknown");

export function useAsanaVideoTasks() {
  const [tasks, setTasks] = useState<VideoTask[]>([]);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { asanaAccessToken } = getPreferenceValues<AsanaPreferences>();
      const headers = { Authorization: `Bearer ${asanaAccessToken}` };
      const opt_fields =
        "gid,name,permalink_url,due_on,custom_fields.gid,custom_fields.name,custom_fields.text_value,custom_fields.number_value,custom_fields.enum_value.name,custom_fields.date_value";

      // Simple GET with retry for rate limit 429s
      const getWithRetry = async <T>(
        url: string,
        config: Record<string, unknown>,
        retries = 2
      ): Promise<import("axios").AxiosResponse<T>> => {
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            const resp = await axios.get<T>(url, config);
            return resp;
          } catch (error: unknown) {
            const status = (error as { response?: { status?: number } })?.response?.status;
            if (status === 429 && attempt < retries) {
              const backoffMs = 800 * (attempt + 1);
              await new Promise((r) => setTimeout(r, backoffMs));
              continue;
            }
            throw error;
          }
        }
        // Should never get here
        throw new Error("Retry attempts exhausted");
      };

      // 1) Find the correct workspace (prefer National Prospect ID)
      const workspacesResp = await getWithRetry<{ data: Workspace[] }>(`${ASANA}/workspaces`, {
        params: { opt_fields: "gid,name,is_organization" },
        headers,
      });
      const workspaces = workspacesResp.data?.data || [];
      const workspace = workspaces.find((w) => w.name === "National Prospect ID") || workspaces[0];
      if (!workspace?.gid) {
        throw new Error("No accessible Asana workspace found");
      }

      // 2) Get my tasks from that workspace with pagination (include completed as well)
      const rows: RawTask[] = [];
      let offset: string | undefined;
      do {
        const tasksResp = await getWithRetry<AsanaListResponse<RawTask>>(`${ASANA}/tasks`, {
          params: {
            assignee: "me",
            workspace: workspace.gid,
            opt_fields,
            limit: 100,
            offset,
          },
          headers,
        });
        const page = tasksResp.data?.data || [];
        rows.push(...page);
        offset = tasksResp.data?.next_page?.offset ?? undefined;
        // Avoid unbounded loops; cap at ~300 tasks unless more needed later
        if (rows.length >= 300) break;
      } while (offset);

      const mapped: VideoTask[] = rows.map((t) => {
        // Handle combined "City, State" field from CSV import
        const cityStateRaw = cf(t, "City") || cf(t, "City, State") || "";
        let city = cf(t, "City") || "";
        let state = cf(t, "State") || "";
        
        // If we have a combined field but no separate state, parse it
        if (cityStateRaw && cityStateRaw.includes(",") && !state) {
          const parts = cityStateRaw.split(",").map(p => p.trim());
          if (parts.length >= 2) {
            city = parts[0];
            state = parts[1];
          }
        }

        return {
          id: t.gid,
          taskName: t.name,
          permalinkUrl: t.permalink_url ?? "",
          dueOn: t.due_on || null,
          playerId: cf(t, "PlayerID"),
          stage: toStage(cf(t, "Stage")),
          status: toStatus(cf(t, "Status")),
          athleteName: cf(t, "Name"),
          sport: cf(t, "Sport"),
          gradYear: cf(t, "Grad Year"),
          city: city,
          state: state,
          highSchool: cf(t, "High School"),
          positions: cf(t, "Positions"),
          paymentStatus: (cf(t, "Payment Status") as "Paid" | "Unpaid" | "Unknown" | undefined) ?? "Unknown",
          profileUrl: cf(t, "PlayerID") ? `https://dashboard.nationalpid.com/athlete/profile/${cf(t, "PlayerID")}` : undefined
        };
      });

      setTasks(mapped);
      setLoading(false);
    })();
  }, []);

  // group by stage for UI
  const groupedByStage = useMemo(() => {
    const g: Record<TaskStage, VideoTask[]> = {
      "In Queue": [], "Awaiting Client": [], "On Hold": [], "Done": [], "Unknown": []
    };
    for (const t of tasks) (g[t.stage] ?? g.Unknown).push(t);
    const byDate = (a?: string | null, b?: string | null) => (!a && !b ? 0 : !a ? 1 : !b ? -1 : a.localeCompare(b));
    Object.values(g).forEach((arr) => arr.sort((a, b) => byDate(a.dueOn, b.dueOn)));
    return g;
  }, [tasks]);

  return { tasks, groupedByStage, isLoading };
}
