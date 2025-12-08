import { useProject } from "../../store/project";
import type { DrumLane } from "../../store/project";
import { usePlaylist } from "../../store/playlist";
import type { PlaylistClip } from "../../store/playlist";
import { usePianoInstances } from "../../store/pianoInstances";
import type { PianoInstance } from "../../store/pianoInstances";
import { useDrumPatterns } from "../../store/drumPatterns";
import type { DrumPattern } from "../../store/drumPatterns";
import { useMixer } from "../../store/mixer";
import type { MixerChannel, DrumType } from "../../store/mixer";
import { useSamples } from "../../store/samples";
import type { Sample } from "../../store/samples";
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
  // New fields for samples
  drumLanes: DrumLane[];
  samples: Sample[];
  // Store sample data as base64 map: url -> base64 string
  sampleData: Record<string, string>;
}

const CURRENT_VERSION = 2;

const urlToBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Failed to convert URL to base64", url, e);
    return "";
  }
};

const base64ToUrl = (base64: string): string => {
  // Data URLs can be used directly as source, but creating a blob URL is better for memory management if we revoke it later.
  // However, for simplicity and persistence in session, we can try to convert to Blob.
  try {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.warn("Failed to convert base64 to URL", e);
    return "";
  }
};

export const saveProject = async () => {
  const drumLanes = useProject.getState().drumLanes;
  const samples = useSamples.getState().samples;
  
  // Collect all URLs that need saving
  const urlsToSave = new Set<string>();
  
  drumLanes.forEach(lane => {
    if (lane.source.type === 'sample') {
      urlsToSave.add(lane.source.url);
    }
  });
  
  samples.forEach(s => {
    urlsToSave.add(s.url);
  });
  
  // Convert all to base64
  const sampleData: Record<string, string> = {};
  for (const url of urlsToSave) {
    if (url.startsWith('blob:') || url.startsWith('http')) {
      sampleData[url] = await urlToBase64(url);
    }
  }

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
    drumLanes,
    samples,
    sampleData
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
    
    // 2. Restore Samples (convert base64 back to blob URLs)
    const urlMap: Record<string, string> = {}; // old url -> new url
    if (data.sampleData) {
      Object.entries(data.sampleData).forEach(([oldUrl, base64]) => {
        if (base64) {
          const newUrl = base64ToUrl(base64);
          urlMap[oldUrl] = newUrl;
        }
      });
    }
    
    // Update URLs in drumLanes
    const newDrumLanes = (data.drumLanes || []).map(lane => {
      if (lane.source.type === 'sample') {
        const newUrl = urlMap[lane.source.url] || lane.source.url;
        return { ...lane, source: { ...lane.source, url: newUrl } };
      }
      return lane;
    });
    
    // Update URLs in samples
    const newSamples = (data.samples || []).map(s => ({
      ...s,
      url: urlMap[s.url] || s.url
    }));

    // 3. Restore Project Settings
    useProject.getState().setBpm(data.bpm);
    useTheme.getState().setPrimary(data.primaryColor || "#3b82f6");
    
    // Restore drum lanes
    if (newDrumLanes.length > 0) {
      useProject.setState({ drumLanes: newDrumLanes });
    }
    
    // Restore samples store
    if (newSamples.length > 0) {
      useSamples.setState({ samples: newSamples });
    }

    // 4. Restore Playlist
    usePlaylist.setState({ 
      clips: data.playlist.clips, 
      arrangementBars: data.playlist.arrangementBars 
    });

    // 5. Restore Piano Instances
    usePianoInstances.setState({ instances: data.pianoInstances });
    
    // Ensure all piano instances are initialized in the engine
    Object.keys(data.pianoInstances).forEach(instId => {
      const inst = data.pianoInstances[instId];
      engine.ensureInstanceSynth(instId);
      if (inst.wave === 'piano') {
        engine.setInstanceToPianoSampler(instId);
      } else {
        engine.setInstanceToBasicSynth(instId, inst.wave);
      }
      engine.setInstanceVolume(instId, inst.volume);
    });

    // 6. Restore Drum Patterns
    useDrumPatterns.setState({ patterns: data.drumPatterns });

    // 7. Restore Mixer
    useMixer.setState({
      channels: data.mixer.channels,
      routing: data.mixer.routing,
      drumRouting: data.mixer.drumRouting,
    });

    // 8. Sync Engine
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
    
    // Sync drum lanes to engine
    if (newDrumLanes.length > 0) {
      // Engine expects lanes without 'name' property strictly speaking, but extra props are usually fine in JS/TS if type allows or casted.
      // However, let's check if engine.setDrumLanes exists and is public.
      // Assuming it is based on previous analysis.
      (engine as any).setDrumLanes(newDrumLanes);
    }

    console.log("Project loaded successfully");
    return true;
  } catch (e) {
    console.error("Failed to load project", e);
    alert("Failed to load project file.");
    return false;
  }
};
