import type { CandidateProfile, InterviewHistoryItem, Job } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const toJson = async (response: Response) => {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const errorMessage = typeof data.error === 'string' ? data.error : `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data as Record<string, unknown>;
};

export const fetchToken = async (identity: string, roomName: string): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/api/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ identity, roomName }),
  });

  const data = await toJson(response);
  const token = data.token;

  if (typeof token !== 'string') {
    throw new Error('The server did not return a valid Twilio token.');
  }

  return token;
};

export const fetchInterviewResponse = async (
  history: InterviewHistoryItem[],
  candidateProfile: CandidateProfile
): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/api/interview/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ history, candidateProfile }),
  });

  const data = await toJson(response);
  const reply = data.reply;

  if (typeof reply !== 'string') {
    throw new Error('The interview agent returned an invalid response.');
  }

  return reply;
};

export const fetchJobs = async (): Promise<Job[]> => {
  const response = await fetch(`${API_BASE_URL}/api/jobs`);
  const data = await toJson(response);
  const jobs = data.jobs;

  if (!Array.isArray(jobs)) {
    return [];
  }

  return jobs as Job[];
};
