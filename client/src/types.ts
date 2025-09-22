export type ChatAuthor = 'ai' | 'candidate' | 'system';

export interface ChatMessage {
  id: string;
  author: ChatAuthor;
  content: string;
  createdAt: string;
}

export interface CandidateProfile {
  name: string;
  role: string;
  jobId?: string;
  jobTitle?: string;
  yearsExperience?: string;
  skills?: string;
}

export interface InterviewHistoryItem {
  role: 'assistant' | 'user';
  content: string;
}

export interface Job {
  id: string;
  title: string;
  department?: string;
  level?: string;
  summary: string;
  coreCompetencies: string[];
  conversationPrompts: string[];
}
