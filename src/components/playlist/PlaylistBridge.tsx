import { useEffect } from 'react';
import usePlaylist from '../../store/playlist';
import { usePianoInstances } from '../../store/pianoInstances';
import { useDrumPatterns } from '../../store/drumPatterns';
import { engine } from '../../audio/engine';

export default function PlaylistBridge() {
  const clips = usePlaylist(s => s.clips);
  const arrangementBars = usePlaylist(s => s.arrangementBars);
  // We need to subscribe to instances so that if notes change, we rebuild the arrangement
  const instances = usePianoInstances(s => s.instances);
  const drumPatterns = useDrumPatterns(s => s.patterns);

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
  }, [clips, arrangementBars, instances, drumPatterns]);

  return null;
}
