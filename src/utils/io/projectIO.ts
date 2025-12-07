import { useProject } from "../../store/project";
import { usePlaylist } from "../../store/playlist";
import type { PlaylistClip } from "../../store/playlist";
import { usePianoInstances } from "../../store/pianoInstances";
import type { PianoInstance } from "../../store/pianoInstances";
import { useDrumPatterns } from "../../store/drumPatterns";
import type { DrumPattern } from "../../store/drumPatterns";
import { useMixer } from "../../store/mixer";
import type { MixerChannel, DrumType } from "../../store/mixer";
import { useTheme } from "../../store/theme";
import { engine } from "../../audio/engine";

export interface ProjectData {
  version: number;
  timestamp: number;
  bpm: number;
  primaryColor: string;
  playlist: {
    clips: PlaylistClip[];
    arrangementBars: number;
  };
  pianoInstances: Record<string, PianoInstance>;
  drumPatterns: Record<string, DrumPattern>;
  mixer: {
    channels: MixerChannel[];
    routing: Record<string, number>;
    drumRouting: Record<DrumType, number>;
  };
}

const CURRENT_VERSION = 1;

export const saveProject = () => {
  const projectData: ProjectData = {
    version: CURRENT_VERSION,
    timestamp: Date.now(),
    bpm: useProject.getState().bpm,
    primaryColor: useTheme.getState().primary,
    playlist: {
      clips: usePlaylist.getState().clips,
      arrangementBars: usePlaylist.getState().arrangementBars,
    },
    pianoInstances: usePianoInstances.getState().instances,
    drumPatterns: useDrumPatterns.getState().patterns,
    mixer: {
      channels: useMixer.getState().channels,
      routing: useMixer.getState().routing,
      drumRouting: useMixer.getState().drumRouting,
    },
  };

  const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `project-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const loadProject = async (file: File) => {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as ProjectData;

    if (!data.version || data.version > CURRENT_VERSION) {
      console.warn("Unknown project version");
    }

    // 1. Stop audio
    engine.stop();

    // 2. Restore Project Settings
    useProject.getState().setBpm(data.bpm);
    useTheme.getState().setPrimary(data.primaryColor || "#3b82f6");

    // 3. Restore Playlist
    usePlaylist.setState({ 
      clips: data.playlist.clips, 
      arrangementBars: data.playlist.arrangementBars 
    });

    // 4. Restore Piano Instances
    usePianoInstances.setState({ instances: data.pianoInstances });

    // 5. Restore Drum Patterns
    useDrumPatterns.setState({ patterns: data.drumPatterns });

    // 6. Restore Mixer
    useMixer.setState({
      channels: data.mixer.channels,
      routing: data.mixer.routing,
      drumRouting: data.mixer.drumRouting,
    });

    // 7. Sync Engine
    engine.setTempo(data.bpm);
    
    // Re-initialize mixer in engine
    data.mixer.channels.forEach(ch => {
      engine.setMixerChannel(ch.id, ch.volume, ch.pan, ch.muted, ch.solo);
    });

    // Update routing in engine
    Object.entries(data.mixer.routing).forEach(([patternId, channelId]) => {
      engine.setPatternRouting(patternId, channelId);
    });
    
    if (data.mixer.drumRouting) {
      Object.entries(data.mixer.drumRouting).forEach(([drum, channelId]) => {
        engine.setDrumRouting(drum as DrumType, channelId);
      });
    }
    
    // Update drum patterns in engine
    Object.values(data.drumPatterns).forEach(pat => {
      engine.setDrumPattern(pat.id, pat.rows);
    });

    console.log("Project loaded successfully");
    return true;
  } catch (e) {
    console.error("Failed to load project", e);
    alert("Failed to load project file.");
    return false;
  }
};
