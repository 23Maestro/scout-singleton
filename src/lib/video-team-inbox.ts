import { load, type Cheerio, type CheerioAPI, type Element } from 'cheerio';
import { parse } from 'date-fns';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { npidRequest } from '../api/npid';
import { TaskStage, TaskStatus } from '../types/workflow';
import {
  NPIDInboxMessage,
  VideoTeamAssignmentModal,
  VideoTeamContact,
  VideoTeamMessageDetail,
  VideoTeamSearchCategory,
} from '../types/video-team';

const LIST_ENDPOINT = '/rulestemplates/template/videoteammessagelist';
const MESSAGE_DETAIL_ENDPOINT = '/rulestemplates/template/videoteammessage_subject';
const ASSIGNMENT_MODAL_ENDPOINT = '/rulestemplates/template/assignemailtovideoteam';
const CONTACT_SEARCH_ENDPOINT = '/template/calendaraccess/contactslist';
const ASSIGNMENT_INFO_ENDPOINT = '/rulestemplates/messageassigninfo';
const ASSIGNMENT_SUBMIT_ENDPOINT = '/videoteammsg/assignvideoteam';

interface FetchInboxOptions {
  filterSelf?: 'Me/Un' | 'All' | 'Unread';
  searchText?: string;
  pageStart?: number;
  limit?: number;
}

function cleanText(input: string) {
  return input.replace(/\s+/g, ' ').trim();
}

function toMarkdown(html: string, options?: any) {
  return NodeHtmlMarkdown.translate(html, options ?? { keepDataImages: false }).trim();
}

function parseTimeStamp(raw: string | undefined | null): {
  iso: string | null;
  display: string | null;
} {
  if (!raw) {
    return { iso: null, display: null };
  }

  const normalized = raw.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return { iso: null, display: null };
  }

  const parts = normalized
    .split('|')
    .map((value) => value.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return { iso: null, display: normalized };
  }

  let dateTimeString: string;
  if (parts.length === 1) {
    dateTimeString = parts[0];
  } else {
    dateTimeString = `${parts[0]} ${parts[1]}`;
  }

  let parsed: Date | null = null;
  const formats = ['MMM d, yyyy h:mm a', 'MMM d, yyyy h:mm:ss a', 'MMM d, yyyy'];

  for (const format of formats) {
    try {
      const result = parse(dateTimeString, format, new Date());
      if (!Number.isNaN(result?.getTime?.())) {
        parsed = result;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!parsed) {
    return { iso: null, display: normalized };
  }

  return {
    iso: parsed.toISOString(),
    display: normalized,
  };
}

function detectAssignmentStatus(container: Cheerio<Element>) {
  // Look for the actual button class from the HAR file
  const hasAssignButton = container.find('.assign_video_team_btn, .assign_video_team, #assignvideoteam').length > 0;
  const status = hasAssignButton ? 'unassigned' : 'assigned';
  console.log('🔍 Assignment status:', status, 'hasAssignButton:', hasAssignButton);
  return status;
}

function extractInboxItems(html: string): NPIDInboxMessage[] {
  const $ = load(html);
  const items: NPIDInboxMessage[] = [];

  console.log('🔍 extractInboxItems: Looking for .ImageProfile elements');
  console.log('🔍 Found .ImageProfile count:', $('.ImageProfile').length);
  
  // Debug: Show what other elements we can find
  console.log('🔍 Found elements with assign buttons:', $('.assign_video_team_btn').length);
  console.log('🔍 Found elements with itemid attribute:', $('[itemid]').length);

  $('.ImageProfile').each((index, element) => {
    const container = $(element);
    const messageId = container.attr('itemid') ?? '';
    
    console.log(`🔍 Processing ImageProfile ${index + 1}, itemid: ${messageId}`);
    
    if (!messageId) {
      console.log('🔍 Skipping item without messageId');
      return;
    }

    const itemCode =
      container.attr('itemcode') ?? container.find('.rightTwo').attr('itemcode') ?? '';
    const email = cleanText(container.find('.leftone .hidden').first().text() || '');
    const senderName = cleanText(
      container.find('.msg-sendr-name').first().text() || 'Unknown Sender',
    );
    const subject = cleanText(container.find('.tit_line1').first().text() || '');
    const preview = cleanText(container.find('.tit_univ').first().text() || '');
    const dateLabel = cleanText(container.find('.date_css').text() || '');
    const isUnread = container.find('#unread-circle, .rightTwo.unread').length > 0;
    const status = detectAssignmentStatus(container);

    console.log(`🔍 Item ${index + 1} details:`, {
      messageId,
      subject: subject.substring(0, 50),
      status,
      canAssign: status === 'unassigned'
    });

    items.push({
      id: messageId,
      itemCode,
      thread_id: `thread-${messageId}`,
      player_id: '',
      contactid: '',
      name: senderName,
      email,
      subject,
      content: '',
      status,
      timestamp: dateLabel,
      is_reply_with_signature: false,
      preview,
      isUnread,
      timeStampDisplay: null,
      timeStampIso: null,
      stage: undefined,
      videoStatus: undefined,
      canAssign: status === 'unassigned',
    });
  });

  console.log('🔍 extractInboxItems: Final items count:', items.length);
  return items;
}

export async function fetchInboxThreads(
  options: FetchInboxOptions = {},
): Promise<NPIDInboxMessage[]> {
  const { filterSelf = 'Me/Un', searchText = '', pageStart = 1 } = options;

  console.log('🔍 fetchInboxThreads called with options:', options);
  
  const response = await npidRequest<string>(LIST_ENDPOINT, {
    method: 'GET',
    params: {
      athleteid: '',
      user_timezone: 'America/New_York',
      type: 'inbox',
      is_mobile: '',
      filter_self: filterSelf,
      refresh: 'false',
      page_start_number: pageStart,
      search_text: searchText,
    },
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  console.log('🔍 API response length:', response?.length || 0);
  console.log('🔍 Response contains ImageProfile:', response?.includes('ImageProfile') || false);
  console.log('🔍 Response contains assign_video_team_btn:', response?.includes('assign_video_team_btn') || false);
  
  // Debug: Show first 500 characters of response
  if (response) {
    console.log('🔍 First 500 chars of response:', response.substring(0, 500));
  }
  
  const items = extractInboxItems(response ?? '');
  console.log('🔍 Extracted items count:', items.length);
  
  // Debug: Show details of first item if any
  if (items.length > 0) {
    console.log('🔍 First item details:', {
      id: items[0].id,
      subject: items[0].subject,
      status: items[0].status,
      canAssign: items[0].canAssign
    });
  }
  
  return items;
}

function mapAttachments(rawAttachments: any[]): VideoTeamMessageDetail['attachments'] {
  if (!Array.isArray(rawAttachments)) {
    return [];
  }

  return rawAttachments
    .filter((attachment) => attachment && typeof attachment === 'object')
    .map((attachment) => ({
      fileName: attachment.actualname ?? attachment.attachment ?? 'Attachment',
      url:
        attachment.allow_view === 'yes'
          ? `https://dashboard.nationalpid.com/vidoeteam_imap_attachments/${attachment.attachment}`
          : null,
      expiresAt: attachment.expirydate ?? null,
      downloadable: attachment.allow_download === 'yes',
    }));
}

export async function fetchMessageDetail(
  messageId: string,
  itemCode: string,
  type: 'inbox' | 'drafts' | 'sent' | 'deleted' = 'inbox',
): Promise<VideoTeamMessageDetail> {
  const response = await npidRequest<Record<string, any>>(MESSAGE_DETAIL_ENDPOINT, {
    method: 'GET',
    params: {
      message_id: messageId,
      itemcode: itemCode,
      type,
      user_timezone: 'America/New_York',
      filter_self: 'Me/Un',
    },
  });

  const time = parseTimeStamp(response?.time_stamp);

  const detail: VideoTeamMessageDetail = {
    messageId,
    itemCode,
    subject: response?.subject ?? '',
    messageHtml: response?.message ?? '',
    messageMarkdown: response?.message ? toMarkdown(response.message) : '',
    fromName: response?.from_name ?? response?.display_name ?? '',
    fromEmail: response?.from_email ?? '',
    toName: response?.to_name ?? '',
    toEmail: response?.to_email ?? '',
    contactId: response?.contact_id ? String(response.contact_id) : '',
    videoProgressStatus: response?.video_progress_status ?? '',
    stage: response?.stage ?? '',
    isAssigned: response?.is_message_assigned === 'Yes',
    timeStampDisplay: time.display,
    timeStampIso: time.iso,
    rawTimeStamp: response?.time_stamp ?? '',
    messagePlain: response?.message_plain ?? '',
    unreadCount: response?.unreadcnt ?? 0,
    attachments: mapAttachments(response?.attachments ?? []),
    athleteLinks: {
      profile: response?.athlete_profile_link ?? '',
      search: response?.athlete_search_link ?? '',
      notes: response?.athlete_notes_link ?? '',
    },
    statusMeta: {
      active: response?.active_status ?? '',
      lock: response?.lock_status ?? '',
      clientUpdate: response?.client_update_status ?? '',
      lastPayment: response?.last_payment_status ?? '',
    },
  };

  return detail;
}

function parseOwnerOptions($: CheerioAPI) {
  const options: VideoTeamAssignmentModal['owners'] = [];

  $('#assignvideoteamtoemailform select#videoscoutassignedto option').each((_, option) => {
    const element = $(option);
    const value = element.attr('value') ?? '';
    if (!value) {
      return;
    }

    options.push({
      value,
      label: cleanText(element.text()),
      color: element.attr('clr') ?? null,
      selected: !!element.attr('selected'),
    });
  });

  return options;
}

function parseStageOptions($: CheerioAPI, selector: string): VideoTeamAssignmentModal['stages'] {
  const options: VideoTeamAssignmentModal['stages'] = [];
  $(selector)
    .find('option')
    .each((_, option) => {
      const element = $(option);
      const value = element.attr('value') ?? '';
      if (!value) {
        return;
      }
      options.push({
        value,
        label: cleanText(element.text()),
      });
    });
  return options;
}

function parseVideoStatuses(
  $: CheerioAPI,
  selector: string,
): VideoTeamAssignmentModal['videoStatuses'] {
  const options: VideoTeamAssignmentModal['videoStatuses'] = [];
  $(selector)
    .find('option')
    .each((_, option) => {
      const element = $(option);
      const value = element.attr('value') ?? '';
      if (!value) {
        return;
      }
      options.push({
        value,
        label: cleanText(element.text()),
      });
    });
  return options;
}

export async function fetchAssignmentModal(messageId: string): Promise<VideoTeamAssignmentModal> {
  const response = await npidRequest<string>(ASSIGNMENT_MODAL_ENDPOINT, {
    method: 'GET',
    params: {
      message_id: messageId,
    },
  });

  const $ = load(response ?? '');
  const owners = parseOwnerOptions($);
  const stages = parseStageOptions(
    $,
    '#assignvideoteamtoemailform select[name="video_progress_stage"]',
  );
  const statuses = parseVideoStatuses(
    $,
    '#assignvideoteamtoemailform select[name="video_progress_status"]',
  );
  const defaultOwner =
    owners.find((owner) => owner.selected) ??
    owners.find((owner) => owner.label.includes('Jerami')) ??
    owners[0];

  const defaultSearchFor =
    ($('#assignvideoteamtoemailform select#contactfor option:selected').attr('value') ?? 'athlete') as VideoTeamSearchCategory;
  const contactValue = $('#assignvideoteamtoemailform #contactname').attr('value') ?? '';
  const messageHiddenId = $('#assignvideoteamtoemailform #messageid').attr('value') ?? '';
  const formToken = $('#assignvideoteamtoemailform input[name="_token"]').attr('value') ?? '';

  return {
    formToken,
    messageId: messageHiddenId || messageId,
    owners,
    defaultOwner,
    stages,
    videoStatuses: statuses,
    defaultSearchFor,
    contactSearchValue: contactValue,
  };
}

function parseContactResults(html: string): VideoTeamContact[] {
  const $ = load(html);
  const contacts: VideoTeamContact[] = [];

  $('#contacts_list tbody tr').each((_, row) => {
    const rowElement = $(row);
    const radio = rowElement.find('input.contactselected');
    const contactId = radio.attr('contactid');
    if (!contactId) {
      return;
    }

    const athleteMainId = radio.attr('athlete_main_id') ?? null;
    const name = radio.attr('contactname') ?? cleanText(rowElement.find('td').first().text());
    const columns = rowElement.find('td');

    const top500 = cleanText(columns.eq(1).text() || '');
    const gradYear = cleanText(columns.eq(2).text() || '');
    const state = cleanText(columns.eq(3).text() || '');
    const sport = cleanText(columns.eq(4).text() || '');
    const videoEditor = cleanText(columns.eq(5).text() || '');

    contacts.push({
      contactId,
      athleteMainId,
      name,
      top500: top500 || null,
      gradYear: gradYear || null,
      state: state || null,
      sport: sport || null,
      videoEditor: videoEditor || null,
    });
  });

  return contacts;
}

export async function fetchContacts(
  search: string,
  searchFor: VideoTeamSearchCategory,
): Promise<VideoTeamContact[]> {
  const response = await npidRequest<string>(CONTACT_SEARCH_ENDPOINT, {
    method: 'GET',
    params: {
      search,
      searchfor: searchFor,
    },
  });

  return parseContactResults(response ?? '');
}

export async function resolveContactsForAssignment(
  search: string,
  initialSearchFor: VideoTeamSearchCategory = 'athlete',
): Promise<{
  contacts: VideoTeamContact[];
  searchForUsed: VideoTeamAssignmentModal['defaultSearchFor'];
}> {
  let searchFor = initialSearchFor;
  let contacts = await fetchContacts(search, searchFor);

  if (contacts.length === 0 && initialSearchFor === 'athlete') {
    const fallbackTypes: VideoTeamSearchCategory[] = ['parent', 'hs coach'];
    for (const fallback of fallbackTypes) {
      contacts = await fetchContacts(search, fallback);
      if (contacts.length > 0) {
        searchFor = fallback;
        break;
      }
    }
  }

  return { contacts, searchForUsed: searchFor };
}

export async function fetchAssignmentDefaults(contactId: string): Promise<{
  stage: string | null;
  status: string | null;
}> {
  if (!contactId) {
    return { stage: null, status: null };
  }

  const response = await npidRequest<Record<string, string | null>>(ASSIGNMENT_INFO_ENDPOINT, {
    method: 'GET',
    params: {
      contactid: contactId,
    },
  });

  return {
    stage: response?.stage ?? null,
    status: response?.video_progress_status ?? null,
  };
}

export interface AssignVideoTeamPayload {
  messageId: string;
  contactId: string;
  athleteMainId?: string | null;
  ownerId: string;
  stage: TaskStage;
  status: TaskStatus;
  searchFor: VideoTeamSearchCategory;
  formToken: string;

  contact?: string; // email address for contact field
}

export async function assignVideoTeamMessage(payload: AssignVideoTeamPayload): Promise<void> {
  const form = new URLSearchParams();
  form.append('_token', payload.formToken);
  form.append('contact_task', payload.contactId);
  form.append('athlete_main_id', payload.athleteMainId || '');
  form.append('messageid', payload.messageId);
  form.append('videoscoutassignedto', payload.ownerId);
  form.append('contactfor', payload.searchFor);
  form.append('contact', payload.contact || '');
  form.append('video_progress_stage', payload.stage);
  form.append('video_progress_status', payload.status);

  await npidRequest(ASSIGNMENT_SUBMIT_ENDPOINT, {
    method: 'POST',
    data: form.toString(),
  });
}

export async function enrichMessagesWithDetails(
  messages: NPIDInboxMessage[],
): Promise<NPIDInboxMessage[]> {
  const resultMap = new Map<string, NPIDInboxMessage>();
  const errors: Error[] = [];

  const queue = [...messages];
  const concurrency = 6;

  async function worker() {
    while (queue.length > 0) {
      const message = queue.shift();
      if (!message) {
        return;
      }

      try {
        const detail = await fetchMessageDetail(message.id, message.itemCode);
        resultMap.set(message.id, {
          ...message,
          content: detail.messageMarkdown || detail.messagePlain,
          contactid: detail.contactId ?? '',
          player_id: detail.contactId ? `contact-${detail.contactId}` : '',
          timestamp: detail.timeStampDisplay ?? message.timestamp,
          timeStampDisplay: detail.timeStampDisplay ?? message.timestamp,
          timeStampIso: detail.timeStampIso,
          stage: detail.stage,
          videoStatus: detail.videoProgressStatus,
          canAssign: message.canAssign, // Preserve original HTML parsing result
          status: message.status, // Preserve original HTML parsing result
          attachments: detail.attachments,
          athleteLinks: detail.athleteLinks,
        });
      } catch (error) {
        if (error instanceof Error) {
          errors.push(error);
        }
        resultMap.set(message.id, message);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }).map(() => worker())).catch((error) => {
    if (error instanceof Error) {
      errors.push(error);
    }
  });

  if (errors.length > 0) {
    console.warn('Failed to fetch some message details', errors[0]);
  }

  return messages.map((message) => resultMap.get(message.id) ?? message);
}
