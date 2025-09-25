import { Action, ActionPanel, Icon, List, Toast, showToast, Form, useNavigation, Detail } from '@raycast/api';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { getAssignmentModalData, assignThread, getInboxThreads } from './bridge/mcpClient';
import { NPIDInboxMessage } from './types/video-team';
import { TaskStage, TaskStatus } from './types/workflow';

const ID_TASKS_PROJECT_GID = '1208992901563477'; // ID Tasks project GID

// Helper function to extract JSON from MCP server responses
function extractJsonFromMCPResponse(responseText: string): any {
  // ... (keeping this as a workaround for now as per user feedback)
  try {
    const jsonStart = responseText.indexOf('[');
    if (jsonStart === -1) {
      const singleJsonStart = responseText.indexOf('{');
      if (singleJsonStart === -1) {
        throw new Error('No JSON data found in MCP response');
      }
      return JSON.parse(responseText.substring(singleJsonStart));
    }
    const jsonText = responseText.substring(jsonStart);
    return JSON.parse(jsonText);
  } catch (error) {
    console.error('JSON parsing error:', error);
    throw new Error(
      `Failed to parse JSON from MCP response: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

// Assignment Modal Component - Simplified
function AssignmentModal({
  message,
  onAssign,
  onCancel,
}: {
  message: NPIDInboxMessage;
  onAssign: (assignee: string, status: TaskStatus, stage: TaskStage) => Promise<void>;
  onCancel: () => void;
}) {
  const [assignee] = useState('Jerami Singleton'); // Only option
  const [status, setStatus] = useState<TaskStatus>('Revisions');
  const [stage, setStage] = useState<TaskStage>('In Queue');

  const handleAssignment = async () => {
    await onAssign(assignee, status, stage);
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Assign Task" icon={Icon.AddPerson} onSubmit={handleAssignment} />
          <Action title="Cancel" icon={Icon.XMarkCircle} onAction={onCancel} />
        </ActionPanel>
      }
    >
      <Form.Description title="Assigning Task for" text={message.name} />
      <Form.Separator />
      <Form.Dropdown id="assignee" title="Assigned Owner" value={assignee}>
        <Form.Dropdown.Item value="Jerami Singleton" title="Jerami Singleton" />
      </Form.Dropdown>
      <Form.Dropdown id="status" title="Video Status" value={status} onChange={(value) => setStatus(value as TaskStatus)}>
        <Form.Dropdown.Item value="Revisions" title="Revisions" />
        <Form.Dropdown.Item value="HUDL" title="HUDL" />
        <Form.Dropdown.Item value="Dropbox" title="Dropbox" />
        <Form.Dropdown.Item value="External Links" title="External Links" />
        <Form.Dropdown.Item value="Not Approved" title="Not Approved" />
      </Form.Dropdown>
      <Form.Dropdown id="stage" title="Video Stage" value={stage} onChange={(value) => setStage(value as TaskStage)}>
        <Form.Dropdown.Item value="On Hold" title="On Hold" />
        <Form.Dropdown.Item value="Awaiting Client" title="Awaiting Client" />
        <Form.Dropdown.Item value="In Queue" title="In Queue" />
        <Form.Dropdown.Item value="Done" title="Done" />
      </Form.Dropdown>
    </Form>
  );
}

// Email Content Detail Component - Simplified
function EmailContentDetail({ message, onBack }: { message: NPIDInboxMessage; onBack: () => void }) {
  const markdownContent = `# ${message.subject}\n\n**From:** ${message.name} (${message.email})\n\n---\n\n${message.content}`;
  return (
    <Detail
      markdown={markdownContent}
      actions={
        <ActionPanel>
          <Action title="Back to Inbox" onAction={onBack} icon={Icon.ArrowLeft} />
        </ActionPanel>
      }
    />
  );
}

export default function InboxCheck() {
  const [messages, setMessages] = useState<NPIDInboxMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { push, pop } = useNavigation();

  useEffect(() => {
    loadInboxMessages();
  }, []);

  const loadInboxMessages = async () => {
    try {
      setIsLoading(true);
      const response = await getInboxThreads(50);
      if (response.success && response.data) {
        const threads = extractJsonFromMCPResponse(response.data as string);
        const assignedThreads = (threads as NPIDInboxMessage[]).filter((msg) => msg.status === 'assigned');
        setMessages(assignedThreads);
      } else {
        throw new Error(response.error || 'Failed to fetch NPID inbox');
      }
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Failed to load inbox',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <List isLoading={isLoading} navigationTitle="NPID Inbox (Assigned)">
      {messages.map((message) => (
        <List.Item
          key={message.id}
          title={message.name}
          subtitle={message.subject}
          accessories={[{ text: formatDistanceToNow(new Date(message.timestamp), { addSuffix: true }) }]}
          actions={
            <ActionPanel>
              <ActionPanel.Section>
                <Action
                  title="View Email Content"
                  icon={Icon.Eye}
                  onAction={() => push(<EmailContentDetail message={message} onBack={pop} />)}
                />
              </ActionPanel.Section>
              <ActionPanel.Section>
                <Action.CopyToClipboard title="Copy Player Name" content={message.name} />
                <Action.CopyToClipboard title="Copy Email" content={message.email} />
                <Action.CopyToClipboard title="Copy Message ID" content={message.id} />
              </ActionPanel.Section>
              <ActionPanel.Section>
                <Action title="Reload Inbox" icon={Icon.ArrowClockwise} onAction={loadInboxMessages} />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
