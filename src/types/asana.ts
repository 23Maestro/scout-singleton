// Asana API type definitions

export interface AsanaTask {
  gid: string;
  name: string;
  notes?: string;
  completed: boolean;
  due_on?: string;
  due_at?: string;
  permalink_url: string;
  assignee?: AsanaUser;
  projects: AsanaProject[];
  custom_fields: AsanaCustomField[];
  created_at: string;
  modified_at: string;
}

export interface AsanaUser {
  gid: string;
  name: string;
  email?: string;
}

export interface AsanaProject {
  gid: string;
  name: string;
  color?: string;
  notes?: string;
}

export interface AsanaCustomField {
  gid: string;
  name: string;
  type: 'text' | 'number' | 'enum' | 'date' | 'people';
  text_value?: string;
  number_value?: number;
  enum_value?: AsanaEnumValue;
  date_value?: string;
  display_value?: string;
}

export interface AsanaEnumValue {
  gid: string;
  name: string;
  color?: string;
}

export interface AsanaWorkspace {
  gid: string;
  name: string;
  is_organization: boolean;
}

export interface CreateTaskRequest {
  name: string;
  notes?: string;
  assignee?: string;
  due_on?: string;
  projects?: string[];
  custom_fields?: Record<string, any>;
  workspace?: string;
}

export interface UpdateTaskRequest {
  name?: string;
  notes?: string;
  assignee?: string;
  due_on?: string;
  completed?: boolean;
  custom_fields?: Record<string, any>;
}

export interface AsanaApiResponse<T> {
  data: T;
}

export interface AsanaApiListResponse<T> {
  data: T[];
  next_page?: {
    offset: string;
    path: string;
    uri: string;
  };
}
