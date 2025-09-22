import { useEffect, useRef, useState } from 'react';
import type {
  LocalParticipant,
  RemoteParticipant,
  LocalTrackPublication,
  RemoteTrackPublication,
  LocalVideoTrack,
  RemoteVideoTrack,
} from 'twilio-video';

interface VideoParticipantProps {
  participant: LocalParticipant | RemoteParticipant;
  isLocal?: boolean;
}

type VideoTrack = LocalVideoTrack | RemoteVideoTrack;

const collectVideoTracks = (participant: LocalParticipant | RemoteParticipant): VideoTrack[] => {
  const publications: Array<LocalTrackPublication | RemoteTrackPublication> = [];
  participant.videoTracks.forEach((publication) => {
    publications.push(publication as LocalTrackPublication | RemoteTrackPublication);
  });

  return publications
    .map((publication) => {
      const track = publication.track;
      if (track && track.kind === 'video') {
        return track as VideoTrack;
      }
      return null;
    })
    .filter((track): track is VideoTrack => track !== null);
};

const getTrackKey = (track: VideoTrack): string => {
  const remoteTrack = track as RemoteVideoTrack;
  return remoteTrack.sid ?? track.mediaStreamTrack.id;
};

const VideoTrackView = ({ track }: { track: VideoTrack }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const videoElement = track.attach() as HTMLVideoElement;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.classList.add('video-element');

    const container = containerRef.current;
    if (container && !container.contains(videoElement)) {
      container.appendChild(videoElement);
    }

    return () => {
      track.detach().forEach((element) => element.remove());
    };
  }, [track]);

  return <div className="video-track" ref={containerRef} />;
};

const VideoParticipant = ({ participant, isLocal = false }: VideoParticipantProps) => {
  const [videoTracks, setVideoTracks] = useState<VideoTrack[]>(() => collectVideoTracks(participant));

  useEffect(() => {
    setVideoTracks(collectVideoTracks(participant));

    if (isLocal) {
      const localParticipant = participant as LocalParticipant;
      const handleTrackPublished = (publication: LocalTrackPublication) => {
        if (publication.track && publication.track.kind === 'video') {
          setVideoTracks((prev) => [...prev, publication.track as LocalVideoTrack]);
        }
      };
      const handleTrackUnpublished = (publication: LocalTrackPublication) => {
        if (publication.track && publication.track.kind === 'video') {
          const key = getTrackKey(publication.track as VideoTrack);
          setVideoTracks((prev) => prev.filter((track) => getTrackKey(track) !== key));
        }
      };

      localParticipant.on('trackPublished', handleTrackPublished);
      localParticipant.on('trackUnpublished', handleTrackUnpublished);

      return () => {
        const participantWithOff = localParticipant as unknown as {
          off?: (event: string, listener: (...args: unknown[]) => void) => void;
          removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
        };
        participantWithOff.off?.('trackPublished', handleTrackPublished);
        participantWithOff.off?.('trackUnpublished', handleTrackUnpublished);
        participantWithOff.removeListener?.('trackPublished', handleTrackPublished);
        participantWithOff.removeListener?.('trackUnpublished', handleTrackUnpublished);
      };
    }

    const remoteParticipant = participant as RemoteParticipant;

    const handleTrackSubscribed = (track: RemoteVideoTrack) => {
      if (track.kind === 'video') {
        setVideoTracks((prev) => [...prev, track]);
      }
    };

    const handleTrackUnsubscribed = (track: RemoteVideoTrack) => {
      if (track.kind === 'video') {
        const key = getTrackKey(track);
        setVideoTracks((prev) => prev.filter((existingTrack) => getTrackKey(existingTrack) !== key));
      }
    };

    remoteParticipant.on('trackSubscribed', handleTrackSubscribed);
    remoteParticipant.on('trackUnsubscribed', handleTrackUnsubscribed);

    return () => {
      const participantWithOff = remoteParticipant as unknown as {
        off?: (event: string, listener: (...args: unknown[]) => void) => void;
        removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
      };
      participantWithOff.off?.('trackSubscribed', handleTrackSubscribed);
      participantWithOff.off?.('trackUnsubscribed', handleTrackUnsubscribed);
      participantWithOff.removeListener?.('trackSubscribed', handleTrackSubscribed);
      participantWithOff.removeListener?.('trackUnsubscribed', handleTrackUnsubscribed);
    };
  }, [participant, isLocal]);

  return (
    <div className={`video-participant${isLocal ? ' video-participant--local' : ''}`}>
      <div className="video-participant__tracks">
        {videoTracks.length === 0 ? (
          <div className="video-placeholder">Video is connecting…</div>
        ) : (
          videoTracks.map((track) => <VideoTrackView key={getTrackKey(track)} track={track} />)
        )}
      </div>
      <div className="video-participant__identity">{participant.identity}{isLocal ? ' (You)' : ''}</div>
    </div>
  );
};

export default VideoParticipant;
