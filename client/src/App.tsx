import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Room, connect, createLocalVideoTrack, RemoteParticipant, LocalVideoTrack } from 'twilio-video';
import InterviewChat from './components/InterviewChat';
import VideoParticipant from './components/VideoParticipant';
import { fetchInterviewResponse, fetchJobs, fetchToken } from './api/interview';
import type { CandidateProfile, ChatMessage, InterviewHistoryItem, Job } from './types';
import './App.css';

const DEFAULT_ROOM = 'talience-interview';

const App = () => {
  const [identity, setIdentity] = useState('');
  const [role, setRole] = useState('');
  const [roomName, setRoomName] = useState(DEFAULT_ROOM);
  const [experience, setExperience] = useState('');
  const [skills, setSkills] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [room, setRoom] = useState<Room | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<InterviewHistoryItem[]>([]);
  const historyRef = useRef<InterviewHistoryItem[]>(history);
  const [connecting, setConnecting] = useState(false);
  const [awaitingResponse, setAwaitingResponse] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? null, [jobs, selectedJobId]);

  const candidateProfile: CandidateProfile = useMemo(
    () => ({
      name: identity.trim(),
      role: role.trim(),
      jobId: selectedJob?.id,
      jobTitle: selectedJob?.title,
      yearsExperience: experience.trim(),
      skills: skills.trim(),
    }),
    [identity, role, selectedJob, experience, skills]
  );

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const response = await fetchJobs();
        setJobs(response);
        if (response.length > 0) {
          setSelectedJobId(response[0].id);
        }
      } catch (loadError) {
        console.error('Failed to fetch jobs', loadError);
      }
    };

    loadJobs();
  }, []);

  useEffect(() => {
    if (!room) {
      setRemoteParticipants([]);
      return;
    }

    const handleParticipantConnected = (participant: RemoteParticipant) => {
      setRemoteParticipants((prev) => [...prev, participant]);
    };

    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      setRemoteParticipants((prev) => prev.filter((existing) => existing.sid !== participant.sid));
    };

    setRemoteParticipants(Array.from(room.participants.values()));
    room.on('participantConnected', handleParticipantConnected);
    room.on('participantDisconnected', handleParticipantDisconnected);

    return () => {
      const roomWithOff = room as unknown as {
        off?: (event: string, listener: (...args: unknown[]) => void) => void;
        removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
      };
      roomWithOff.off?.('participantConnected', handleParticipantConnected);
      roomWithOff.off?.('participantDisconnected', handleParticipantDisconnected);
      roomWithOff.removeListener?.('participantConnected', handleParticipantConnected);
      roomWithOff.removeListener?.('participantDisconnected', handleParticipantDisconnected);
    };
  }, [room]);

  const resetInterviewState = () => {
    setMessages([]);
    setHistory([]);
    setAwaitingResponse(false);
  };

  const disconnectRoom = useCallback((currentRoom: Room | null) => {
    if (!currentRoom) {
      return;
    }

    currentRoom.localParticipant.tracks.forEach((publication) => {
      const { track } = publication;
      if (!track) {
        return;
      }

      if (typeof (track as { stop?: unknown }).stop === 'function' && track.kind !== 'data') {
        (track as unknown as { stop: () => void }).stop();
      }

      if (typeof (track as { detach?: unknown }).detach === 'function') {
        (track as unknown as { detach: () => Element[] })
          .detach()
          .forEach((element) => element.remove());
      }
    });

    currentRoom.disconnect();
  }, []);

  const handleLeaveInterview = useCallback(() => {
    disconnectRoom(room);
    setRoom(null);
    resetInterviewState();
  }, [disconnectRoom, room]);

  useEffect(
    () => () => {
      disconnectRoom(room);
    },
    [disconnectRoom, room]
  );

  const startInterview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (connecting) {
      return;
    }

    if (!identity.trim()) {
      setError('Please provide your name before joining.');
      return;
    }

    setError(null);
    resetInterviewState();
    setConnecting(true);

    let localVideoTrack: LocalVideoTrack | null = null;
    let connectedRoom: Room | null = null;

    try {
      const token = await fetchToken(identity.trim(), roomName.trim() || DEFAULT_ROOM);
      localVideoTrack = await createLocalVideoTrack();
      connectedRoom = await connect(token, {
        name: roomName.trim() || DEFAULT_ROOM,
        tracks: [localVideoTrack],
        dominantSpeaker: true,
      });

      setRoom(connectedRoom);

      setAwaitingResponse(true);
      const reply = await fetchInterviewResponse([], candidateProfile);
      const now = new Date().toISOString();
      const aiMessage: ChatMessage = {
        id: `ai-${now}`,
        author: 'ai',
        content: reply,
        createdAt: now,
      };
      setMessages([aiMessage]);
      setHistory([{ role: 'assistant', content: reply }]);
    } catch (startError) {
      console.error('Failed to start interview', startError);
      setError(startError instanceof Error ? startError.message : 'Unable to join the interview.');
      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.detach().forEach((element) => element.remove());
      }
      disconnectRoom(connectedRoom);
      setRoom(null);
    } finally {
      setAwaitingResponse(false);
      setConnecting(false);
    }
  };

  const handleSendCandidateMessage = async (content: string) => {
    const timestamp = new Date().toISOString();
    const candidateMessage: ChatMessage = {
      id: `candidate-${timestamp}`,
      author: 'candidate',
      content,
      createdAt: timestamp,
    };

    setMessages((prev) => [...prev, candidateMessage]);
    const updatedHistory: InterviewHistoryItem[] = [...historyRef.current, { role: 'user' as const, content }];
    setHistory(updatedHistory);
    setAwaitingResponse(true);

    try {
      const reply = await fetchInterviewResponse(updatedHistory, candidateProfile);
      const responseTimestamp = new Date().toISOString();
      const aiMessage: ChatMessage = {
        id: `ai-${responseTimestamp}`,
        author: 'ai',
        content: reply,
        createdAt: responseTimestamp,
      };
      setMessages((prev) => [...prev, aiMessage]);
      setHistory((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (messageError) {
      console.error('Failed to generate interview response', messageError);
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          author: 'system',
          content: 'We were unable to generate a response. Please try again in a moment.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setAwaitingResponse(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Talience AI Interviewer</h1>
          <p>Join a structured, AI-driven video interview powered by Twilio and OpenAI.</p>
        </div>
        {room && (
          <button type="button" className="leave-button" onClick={handleLeaveInterview}>
            Leave interview
          </button>
        )}
      </header>

      {!room && (
        <section className="setup-panel">
          <form className="setup-form" onSubmit={startInterview}>
            <h2>Candidate details</h2>
            <div className="form-grid">
              <label>
                Full name
                <input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="Jordan Smith" />
              </label>
              <label>
                Target role
                <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Frontend Engineer" />
              </label>
              <label>
                Interview room name
                <input value={roomName} onChange={(event) => setRoomName(event.target.value)} />
              </label>
              <label>
                Years of experience
                <input value={experience} onChange={(event) => setExperience(event.target.value)} placeholder="5" />
              </label>
              <label className="form-wide">
                Key skills
                <input
                  value={skills}
                  onChange={(event) => setSkills(event.target.value)}
                  placeholder="React, TypeScript, WebRTC"
                />
              </label>
              <label className="form-wide">
                Select job
                <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)}>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error && <div className="error-banner">{error}</div>}
            <button type="submit" disabled={connecting}>
              {connecting ? 'Connecting…' : 'Start interview'}
            </button>
          </form>

          {selectedJob && (
            <aside className="job-card">
              <h3>{selectedJob.title}</h3>
              <p className="job-meta">
                {selectedJob.department && <span>{selectedJob.department}</span>}
                {selectedJob.level && <span>{selectedJob.level}</span>}
              </p>
              <p>{selectedJob.summary}</p>
              <h4>Focus areas</h4>
              <ul>
                {selectedJob.coreCompetencies.map((competency) => (
                  <li key={competency}>{competency}</li>
                ))}
              </ul>
              <h4>Example prompts</h4>
              <ul>
                {selectedJob.conversationPrompts.map((prompt) => (
                  <li key={prompt}>{prompt}</li>
                ))}
              </ul>
            </aside>
          )}
        </section>
      )}

      {room && (
        <section className="interview-layout">
          <div className="video-panel">
            <div className="video-grid">
              <VideoParticipant participant={room.localParticipant} isLocal />
              {remoteParticipants.map((participant) => (
                <VideoParticipant key={participant.sid} participant={participant} />
              ))}
            </div>
            <div className="video-status">
              {awaitingResponse ? <span>Talience is preparing the next question…</span> : <span>Interview in progress</span>}
            </div>
          </div>
          <div className="chat-panel">
            <InterviewChat
              messages={messages}
              onSend={handleSendCandidateMessage}
              disabled={!room}
              busy={awaitingResponse}
            />
          </div>
        </section>
      )}
    </div>
  );
};

export default App;
