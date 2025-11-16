import { useEffect } from 'react';
import usePlaylist from '../../store/playlist';
import { engine } from '../../audio/engine';

export default function PlaylistBridge() {
  const clips = usePlaylist(s => s.clips);
  const arrangementBars = usePlaylist(s => s.arrangementBars);
  // Accessing instances here is not required for engine rebuild; clips carry sourceId

  useEffect(() => {
    // Keep engine's arrangement length and clip schedule in sync with playlist
    try {
      const anyEngine: any = engine as any;
      if (typeof anyEngine.setArrangementLengthBars === 'function') {
        anyEngine.setArrangementLengthBars(arrangementBars);
      } else {
        // Fallback for older/hot-stale engine module: set internal field directly
        anyEngine.arrangementLengthSubsteps = Math.max(48, Math.round(arrangementBars * 48));
      }
      if (typeof anyEngine.rebuildArrangementFromPlaylist === 'function') {
        anyEngine.rebuildArrangementFromPlaylist(clips);
      }
    } catch (e) {
      console.error('PlaylistBridge engine sync failed', e);
    }
  }, [clips, arrangementBars]);

  return null;
}
