export enum Tone {
  Professional = 'Professional',
  Witty = 'Witty',
  Inspirational = 'Inspirational',
  Educational = 'Educational',
}

export type IdeaStatus = 'Pending' | 'In Progress' | 'Blocked' | 'Completed' | 'Posted';

export const SOCIAL_PLATFORMS = ['Instagram', 'TikTok', 'X', 'Threads', 'LinkedIn'];

export interface ContentIdea {
  id: string;
  title: string;
  description: string; // Used for short summary
  hook?: string; // First sentence/attention grabber
  caption?: string; // Full post body
  cta?: string; // Call to Action
  hashtags?: string; // e.g. "#design #tips"
  platform: string[]; // Changed to support multi-select
  canva_prompt?: string;
  date: string | null; // ISO Date String YYYY-MM-DD
  time: string | null; // HH:mm 24-hour format
  status: IdeaStatus;
  persona_id?: string;
  persona_name?: string;
  team_id?: string;
  created_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'team_join' | 'idea_due';
  title: string;
  message: string;
  data?: any;
  read_at?: string;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  notify_on_team_join: boolean;
  notify_on_idea_due: boolean;
  idea_due_threshold_hours: number;
}

export interface FormData {
  topic: string;
  audience: string;
  tone: Tone;
  persona_id?: string;
}

export interface WebhookConfig {
  useWebhook: boolean;
  url: string;
}

export interface UserProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  credits: number;
  has_completed_onboarding?: boolean;
  tier?: 'free' | 'creator' | 'pro';
  branding?: BrandingSettings;
}

export interface BrandingSettings {
  colors: string[];
  fonts: {
    title?: string;
    subtitle?: string;
    heading?: string;
    subheading?: string;
    section_header?: string;
    body?: string;
    quote?: string;
    caption?: string;
  };
  style: string;
}

export interface PersonaData {
  id?: string;
  name?: string;
  description: string;
  user_id?: string;
  team_id?: string;
  gender: string;
  age_range: string;
  occupation: string;
  education: string;
  marital_status: string;
  has_children: boolean;
  income_level: string;
  social_networks: string;
  // Legacy fields (optional support)
  pain_points?: string;
  goals?: string;
  // New Array fields
  pains_list: string[];
  goals_list: string[];
  questions_list: string[];
}

export const STATUS_COLORS: Record<IdeaStatus, string> = {
  'Pending': 'bg-gray-100 text-gray-600 border-gray-200',
  'In Progress': 'bg-blue-50 text-blue-600 border-blue-100',
  'Blocked': 'bg-red-50 text-red-600 border-red-100',
  'Completed': 'bg-green-50 text-green-600 border-green-100',
  'Posted': 'bg-purple-50 text-purple-600 border-purple-100',
};

export type TeamRole = 'owner' | 'admin' | 'member';

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  invitation_code?: string;
  branding?: BrandingSettings;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
  user?: {
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
    email?: string;
  };
}
