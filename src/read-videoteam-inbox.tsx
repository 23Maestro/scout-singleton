import { Action, ActionPanel, Icon, List, Toast, showToast, useNavigation, Detail } from '@raycast/api';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fetchInboxThreads, enrichMessagesWithDetails } from './lib/video-team-inbox';
import { NPIDInboxMessage } from './types/video-team';


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
      
      // Fetch all threads using the same HTML parsing system
      const basicThreads = await fetchInboxThreads();
      const withDetails = await enrichMessagesWithDetails(basicThreads);
      
      // Filter for ASSIGNED messages (opposite of assign command)
      const assignedMessages = withDetails.filter((message) => message.status === 'assigned');
      
      setMessages(assignedMessages);
      
      await showToast({
        style: Toast.Style.Success,
        title: `Found ${assignedMessages.length} assigned messages`,
        message: 'Ready to view and reply',
      });
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
    <List isLoading={isLoading} navigationTitle="Read Videoteam Inbox">
      {messages.map((message) => (
        <List.Item
          key={message.id}
          title={message.name}
          subtitle={message.subject}
          accessories={[
            { text: formatDistanceToNow(new Date(message.timestamp), { addSuffix: true }) },
            { icon: Icon.CheckCircle, tooltip: 'Assigned' }
          ]}
          actions={
            <ActionPanel>
              <ActionPanel.Section>
                <Action
                  title="View Email Content"
                  icon={Icon.Eye}
                  onAction={() => push(<EmailContentDetail message={message} onBack={pop} />)}
                />
                <Action
                  title="Reply to Email"
                  icon={Icon.Reply}
                  onAction={() => {
                    // TODO: Implement reply functionality
                    showToast({ style: Toast.Style.Success, title: 'Reply feature coming soon' });
                  }}
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
