import { Action, ActionPanel, Icon, List, Toast, showToast, Color, Detail } from '@raycast/api';
import { useState } from 'react';
import { useAsanaVideoTasks } from './lib/asana-client';
import { VideoTask, TaskStage, TaskStatus } from './types/workflow';
import { pushTimelinesToWebsite, backfillMetadataToAsana } from './utils/enrich-runner';
import { findPlayerIdsByName } from './utils/player-resolver';
import { formatDistanceToNow } from 'date-fns';
import { callAsanaTool } from './bridge/mcpClient';

function getStatusIcon(status: TaskStatus): Icon {
  switch (status) {
    case 'Revisions':
      return Icon.ArrowClockwise;
    case 'HUDL':
      return Icon.CircleFilled;
    case 'Dropbox':
      return Icon.Folder;
    case 'External Links':
      return Icon.Link;
    case 'Not Approved':
      return Icon.XMarkCircle;
    default:
      return Icon.Circle;
  }
}

function getStatusColor(status: TaskStatus): Color {
  switch (status) {
    case 'Revisions':
      return Color.Purple;
    case 'HUDL':
      return Color.Red;
    case 'Dropbox':
      return Color.Blue;
    case 'External Links':
      return Color.Green;
    case 'Not Approved':
      return Color.Orange;
    default:
      return Color.SecondaryText;
  }
}

function getStageIcon(stage: TaskStage): Icon {
  switch (stage) {
    case 'On Hold':
      return Icon.Pause;
    case 'Awaiting Client':
      return Icon.Clock;
    case 'In Queue':
      return Icon.Play;
    case 'Done':
      return Icon.CheckCircle;
    default:
      return Icon.Document;
  }
}

function TaskDetail({ task, onBack }: { task: VideoTask; onBack: () => void }) {
  return (
    <Detail
      navigationTitle={task.taskName}
      markdown={`# ${task.taskName}\n\n**Stage:** ${task.stage}\n**Status:** ${task.status}\n\n${task.athleteName ? `**Athlete:** ${task.athleteName}` : ''}`}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.TagList title="Stage">
            <Detail.Metadata.TagList.Item text={task.stage} color={Color.Blue} />
          </Detail.Metadata.TagList>
          <Detail.Metadata.TagList title="Status">
            <Detail.Metadata.TagList.Item text={task.status} color={getStatusColor(task.status)} />
          </Detail.Metadata.TagList>

          {task.athleteName && (
            <Detail.Metadata.Label title="Athlete Name" text={task.athleteName} />
          )}
          {task.sport && <Detail.Metadata.Label title="Sport" text={task.sport} />}
          {task.gradYear && <Detail.Metadata.Label title="Grad Year" text={task.gradYear} />}
          {task.positions && <Detail.Metadata.Label title="Positions" text={task.positions} />}
          {task.city && task.state && (
            <Detail.Metadata.Label title="Location" text={`${task.city}, ${task.state}`} />
          )}
          {task.highSchool && <Detail.Metadata.Label title="High School" text={task.highSchool} />}
          {task.player_id && <Detail.Metadata.Label title="Player ID" text={task.player_id} />}
          {task.paymentStatus && (
            <Detail.Metadata.TagList title="Payment">
              <Detail.Metadata.TagList.Item
                text={task.paymentStatus}
                color={task.paymentStatus === 'Paid' ? Color.Green : Color.Red}
              />
            </Detail.Metadata.TagList>
          )}

          {task.dueOn && (
            <Detail.Metadata.Label
              title="Due Date"
              text={formatDistanceToNow(new Date(task.dueOn), { addSuffix: true })}
            />
          )}

          <Detail.Metadata.Link
            title="Asana Link"
            target={task.permalinkUrl}
            text="Open in Asana"
          />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action
            title="Back to List"
            icon={Icon.ArrowLeft}
            onAction={onBack}
            shortcut={{ modifiers: ['cmd'], key: 'b' }}
          />
          <ActionPanel.Section title="Sync Actions">
            <Action
              title="Push Stage/Status to Website"
              icon={Icon.Upload}
              onAction={async () => {
                try {
                  await pushTimelinesToWebsite(task);
                  await showToast({
                    style: Toast.Style.Success,
                    title: 'Success',
                    message: 'Stage and status pushed to website',
                  });
                } catch (error) {
                  await showToast({
                    style: Toast.Style.Failure,
                    title: 'Failed to push to website',
                    message: error instanceof Error ? error.message : 'Unknown error',
                  });
                }
              }}
            />
            <Action
              title="Backfill Metadata from Website"
              icon={Icon.Download}
              onAction={async () => {
                try {
                  await backfillMetadataToAsana(task);
                  await showToast({
                    style: Toast.Style.Success,
                    title: 'Success',
                    message: 'Metadata backfilled from website',
                  });
                } catch (error) {
                  await showToast({
                    style: Toast.Style.Failure,
                    title: 'Failed to backfill metadata',
                    message: error instanceof Error ? error.message : 'Unknown error',
                  });
                }
              }}
            />
            <Action
              title="Find Player ID (Selenium)"
              icon={Icon.MagnifyingGlass}
              onAction={async () => {
                if (!task.athleteName) {
                  await showToast({
                    style: Toast.Style.Failure,
                    title: 'No athlete name',
                    message: 'Athlete name is required for Selenium search',
                  });
                  return;
                }

                try {
                  const results = await findPlayerIdsByName(task.athleteName);
                  if (results.length > 0) {
                    await showToast({
                      style: Toast.Style.Success,
                      title: 'Player found',
                      message: `Found ${results.length} matching player(s)`,
                    });
                  } else {
                    await showToast({
                      style: Toast.Style.Failure,
                      title: 'No players found',
                      message: 'No matching players found via Selenium',
                    });
                  }
                } catch (error) {
                  await showToast({
                    style: Toast.Style.Failure,
                    title: 'Selenium search failed',
                    message: error instanceof Error ? error.message : 'Unknown error',
                  });
                }
              }}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="Open">
            <Action.OpenInBrowser
              title="Open in Asana"
              url={task.permalinkUrl}
              icon={Icon.Globe}
              shortcut={{ modifiers: ['cmd'], key: 'o' }}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="Copy">
            <Action.CopyToClipboard
              title="Copy Task Name"
              content={task.taskName}
              icon={Icon.Clipboard}
              shortcut={{ modifiers: ['cmd'], key: 'c' }}
            />
            <Action.CopyToClipboard
              title="Copy Task URL"
              content={task.permalinkUrl}
              icon={Icon.Link}
              shortcut={{ modifiers: ['cmd', 'shift'], key: 'c' }}
            />
            {task.player_id && (
              <Action.CopyToClipboard
                title="Copy Player ID"
                content={task.player_id}
                icon={Icon.Hashtag}
                shortcut={{ modifiers: ['cmd'], key: 'i' }}
              />
            )}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

export default function ActiveTasks() {
  const { tasks, isLoading } = useAsanaVideoTasks();
  const [searchText, setSearchText] = useState('');
  const [selectedTask, setSelectedTask] = useState<VideoTask | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredTasks = tasks.filter((task) => {
    const searchLower = searchText.toLowerCase();
    const matchesSearch =
      task.taskName.toLowerCase().includes(searchLower) ||
      (task.athleteName || task.taskName).toLowerCase().includes(searchLower) ||
      task.sport?.toLowerCase().includes(searchLower) ||
      task.gradYear?.toLowerCase().includes(searchLower) ||
      task.player_id?.toLowerCase().includes(searchLower) ||
      task.status.toLowerCase().includes(searchLower);

    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Group filtered tasks by stage
  const filteredGroupedByStage: Record<TaskStage, VideoTask[]> = {
    'In Queue': [],
    'Awaiting Client': [],
    'On Hold': [],
    Done: [],
    Unknown: [],
  };

  filteredTasks.forEach((task) => {
    if (filteredGroupedByStage[task.stage]) {
      filteredGroupedByStage[task.stage].push(task);
    } else {
      filteredGroupedByStage.Unknown.push(task);
    }
  });

  // Show detail view if a task is selected
  if (selectedTask) {
    return <TaskDetail task={selectedTask} onBack={() => setSelectedTask(null)} />;
  }

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search active video tasks..."
      navigationTitle="Active ID Tasks"
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by Status" value={statusFilter} onChange={setStatusFilter}>
          <List.Dropdown.Item title="All Statuses" value="all" icon={Icon.Dot} />
          <List.Dropdown.Section title="Video Status">
            <List.Dropdown.Item
              title="Revisions"
              value="Revisions"
              icon={{ source: Icon.ArrowClockwise, tintColor: Color.Purple }}
            />
            <List.Dropdown.Item
              title="HUDL"
              value="HUDL"
              icon={{ source: Icon.CircleFilled, tintColor: Color.Red }}
            />
            <List.Dropdown.Item
              title="Dropbox"
              value="Dropbox"
              icon={{ source: Icon.Folder, tintColor: Color.Blue }}
            />
            <List.Dropdown.Item
              title="External Links"
              value="External Links"
              icon={{ source: Icon.Link, tintColor: Color.Green }}
            />
            <List.Dropdown.Item
              title="Not Approved"
              value="Not Approved"
              icon={{ source: Icon.XMarkCircle, tintColor: Color.Orange }}
            />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {(['In Queue', 'Awaiting Client', 'On Hold', 'Done', 'Unknown'] as TaskStage[]).map(
        (stage) => {
          const stageTasks = filteredGroupedByStage[stage];
          if (stageTasks.length === 0) return null;

          return (
            <List.Section key={stage} title={stage} subtitle={`${stageTasks.length} tasks`}>
              {stageTasks.map((task) => (
                <List.Item
                  key={task.id}
                  title={task.taskName}
                  subtitle={[task.athleteName, task.sport, task.gradYear]
                    .filter(Boolean)
                    .join(' • ')}
                  icon={{ source: getStageIcon(task.stage), tintColor: Color.Blue }}
                  accessories={[
                    { text: 'ID Tasks', tooltip: 'Project: ID Tasks' },
                    {
                      icon: {
                        source: getStatusIcon(task.status),
                        tintColor: getStatusColor(task.status),
                      },
                      tooltip: `Status: ${task.status}`,
                    },
                    task.positions
                      ? {
                          text: task.positions,
                          icon: Icon.Person,
                          tooltip: `Positions: ${task.positions}`,
                        }
                      : null,
                    task.dueOn
                      ? {
                          text: formatDistanceToNow(new Date(task.dueOn), { addSuffix: true }),
                          icon: Icon.Calendar,
                          tooltip: `Due Date: ${new Date(task.dueOn).toLocaleDateString()}`,
                        }
                      : null,
                  ].filter(Boolean)}
                  actions={
                    <ActionPanel>
                      <Action
                        title="Show Details"
                        icon={Icon.Eye}
                        onAction={() => setSelectedTask(task)}
                      />
                      <ActionPanel.Section title="Quick Updates">
                        <Action
                          title={'Mark as Complete'}
                          icon={Icon.CheckCircle}
                          onAction={async () => {
                            try {
                              const response = await callAsanaTool('asana_update_task', {
                                task_id: task.id,
                                completed: true,
                              });
                              if (response.success) {
                                await showToast({
                                  style: Toast.Style.Success,
                                  title: 'Task Completed',
                                });
                              } else {
                                throw new Error(response.error || 'Failed to complete task');
                              }
                            } catch (e) {
                              await showToast({
                                style: Toast.Style.Failure,
                                title: 'Failed to complete',
                              });
                            }
                          }}
                        />
                        <Action
                          title="Assign to Me"
                          icon={Icon.AddPerson}
                          onAction={async () => {
                            try {
                              const response = await callAsanaTool('asana_update_task', {
                                task_id: task.id,
                                assignee: 'Jerami Singleton',
                              });
                              if (response.success) {
                                await showToast({
                                  style: Toast.Style.Success,
                                  title: 'Assigned to you',
                                });
                              } else {
                                throw new Error(response.error || 'Failed to assign task');
                              }
                            } catch {
                              await showToast({
                                style: Toast.Style.Failure,
                                title: 'Failed to assign',
                              });
                            }
                          }}
                        />
                        <Action.PickDate
                          title="Set Due Date"
                          icon={Icon.Calendar}
                          type={Action.PickDate.Type.Date}
                          onChange={async (date) => {
                            try {
                              const dateStr = date ? date.toISOString().split('T')[0] : null;
                              const response = await callAsanaTool('asana_update_task', {
                                task_id: task.id,
                                due_on: dateStr,
                              });
                              if (response.success) {
                                await showToast({
                                  style: Toast.Style.Success,
                                  title: 'Due date updated',
                                });
                              } else {
                                throw new Error(response.error || 'Failed to set due date');
                              }
                            } catch {
                              await showToast({
                                style: Toast.Style.Failure,
                                title: 'Failed to set due date',
                              });
                            }
                          }}
                        />
                      </ActionPanel.Section>
                      <ActionPanel.Section title="Sync Actions">
                        <Action
                          title="Push Stage/Status/Due Date to Website"
                          icon={Icon.Upload}
                          onAction={async () => {
                            try {
                              await pushTimelinesToWebsite(task);
                              await showToast({
                                style: Toast.Style.Success,
                                title: 'Pushed to Website',
                                message: 'Stage/Status/Due pushed',
                              });
                            } catch (error) {
                              await showToast({
                                style: Toast.Style.Failure,
                                title: 'Failed to push to website',
                                message: error instanceof Error ? error.message : 'Unknown error',
                              });
                            }
                          }}
                        />
                        <Action
                          title="Backfill Metadata from Website"
                          icon={Icon.Download}
                          onAction={async () => {
                            try {
                              const beforeFields = {
                                city: task.city,
                                state: task.state,
                                highSchool: task.highSchool,
                                positions: task.positions,
                                sport: task.sport,
                                gradYear: task.gradYear,
                                paymentStatus: task.paymentStatus,
                                player_id: task.player_id,
                                athleteName: task.athleteName,
                              };

                              await backfillMetadataToAsana(task);

                              const updatedFields = Object.keys(beforeFields).filter(
                                (key) => !beforeFields[key as keyof typeof beforeFields],
                              );

                              await showToast({
                                style: Toast.Style.Success,
                                title: 'Backfill Complete',
                                message:
                                  updatedFields.length > 0
                                    ? `Updated: ${updatedFields.join(', ')}`
                                    : 'No missing fields to update',
                              });
                            } catch (error) {
                              await showToast({
                                style: Toast.Style.Failure,
                                title: 'Failed to backfill metadata',
                                message: error instanceof Error ? error.message : 'Unknown error',
                              });
                            }
                          }}
                        />
                        <Action
                          title="Backfill Missing (All Done Tasks)"
                          icon={Icon.Download}
                          shortcut={{ modifiers: ['cmd', 'shift'], key: 'b' }}
                          onAction={async () => {
                            const doneTasks = tasks.filter((t) => t.stage === 'Done');
                            let ok = 0;
                            let fail = 0;
                            const updatedTasksLog: string[] = [];

                            for (const t of doneTasks) {
                              try {
                                const beforeCount = [
                                  t.city,
                                  t.state,
                                  t.highSchool,
                                  t.positions,
                                  t.sport,
                                  t.gradYear,
                                  t.paymentStatus,
                                  t.player_id,
                                  t.athleteName,
                                ].filter(Boolean).length;
                                await backfillMetadataToAsana(t);
                                const taskName = t.athleteName || t.taskName;
                                updatedTasksLog.push(`${taskName}: filled missing fields`);
                                ok++;
                              } catch {
                                fail++;
                              }
                            }

                            await showToast({
                              style: Toast.Style.Success,
                              title: `Batch Backfill Complete`,
                              message: `${ok} updated, ${fail} skipped. Check console for details.`,
                            });
                            console.log('Backfill Details:', updatedTasksLog);
                          }}
                        />
                        <Action
                          title="Find Player ID (Selenium)"
                          icon={Icon.MagnifyingGlass}
                          onAction={async () => {
                            if (!task.athleteName) {
                              await showToast({
                                style: Toast.Style.Failure,
                                title: 'No athlete name',
                                message: 'Athlete name is required for Selenium search',
                              });
                              return;
                            }

                            try {
                              const results = await findPlayerIdsByName(task.athleteName);
                              if (results.length > 0) {
                                await showToast({
                                  style: Toast.Style.Success,
                                  title: 'Player found',
                                  message: `Found ${results.length} matching player(s)`,
                                });
                              } else {
                                await showToast({
                                  style: Toast.Style.Failure,
                                  title: 'No players found',
                                  message: 'No matching players found via Selenium',
                                });
                              }
                            } catch (error) {
                              await showToast({
                                style: Toast.Style.Failure,
                                title: 'Selenium search failed',
                                message: error instanceof Error ? error.message : 'Unknown error',
                              });
                            }
                          }}
                        />
                      </ActionPanel.Section>
                      <ActionPanel.Section title="Open">
                        <Action.OpenInBrowser
                          title="Open in Asana"
                          url={task.permalinkUrl}
                          icon={Icon.Globe}
                          shortcut={{ modifiers: ['cmd'], key: 'o' }}
                        />
                      </ActionPanel.Section>
                      <ActionPanel.Section title="Copy">
                        <Action.CopyToClipboard
                          title="Copy Task Name"
                          content={task.taskName}
                          icon={Icon.Clipboard}
                          shortcut={{ modifiers: ['cmd'], key: 'c' }}
                        />
                        <Action.CopyToClipboard
                          title="Copy Task URL"
                          content={task.permalinkUrl}
                          icon={Icon.Link}
                          shortcut={{ modifiers: ['cmd', 'shift'], key: 'c' }}
                        />
                        {task.player_id && (
                          <Action.CopyToClipboard
                            title="Copy Player ID"
                            content={task.player_id}
                            icon={Icon.Hashtag}
                            shortcut={{ modifiers: ['cmd'], key: 'i' }}
                          />
                        )}
                      </ActionPanel.Section>
                      <ActionPanel.Section title="Filters">
                        <Action
                          title={`Filter by Status: ${task.status}`}
                          icon={Icon.Filter}
                          onAction={() => setStatusFilter(task.status)}
                          shortcut={{ modifiers: ['cmd'], key: 's' }}
                        />
                        <Action
                          title="Clear Filter"
                          icon={Icon.XMarkCircle}
                          onAction={() => setStatusFilter('all')}
                          shortcut={{ modifiers: ['cmd', 'shift'], key: 'x' }}
                        />
                      </ActionPanel.Section>
                    </ActionPanel>
                  }
                />
              ))}
            </List.Section>
          );
        },
      )}
      {!isLoading && filteredTasks.length === 0 && (
        <List.EmptyView
          title="No Tasks Found"
          description="No active video tasks match your search"
          icon={Icon.MagnifyingGlass}
        />
      )}
    </List>
  );
}
