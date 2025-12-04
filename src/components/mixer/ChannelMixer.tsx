// src/components/mixer/ChannelMixer.tsx
// FL Studio-style mixer with horizontal scrolling channel strips
import React, { useEffect, useRef } from "react";
import { useTheme } from "../../store/theme";
import { useMixer } from "../../store/mixer";
import { usePianoInstances } from "../../store/pianoInstances";
import { useDrumPatterns } from "../../store/drumPatterns";
import { engine } from "../../audio/engine";

interface ChannelStripProps {
  channelId: number;
  isMaster?: boolean;
}

const ChannelStrip: React.FC<ChannelStripProps> = ({ channelId, isMaster }) => {
  const primary = useTheme(s => s.primary);
  const channel = useMixer(s => s.channels.find(c => c.id === channelId)!);
  const setVolume = useMixer(s => s.setVolume);
  const setPan = useMixer(s => s.setPan);
  const setMuted = useMixer(s => s.setMuted);
  const setSolo = useMixer(s => s.setSolo);
  const routing = useMixer(s => s.routing);
  
  // Find what patterns are routed to this channel
  const routedPatterns = Object.entries(routing)
    .filter(([_, chId]) => chId === channelId)
    .map(([patId]) => patId);

  // Sync volume/pan to engine when changed
  useEffect(() => {
    engine.setMixerChannel(channelId, channel.volume, channel.pan, channel.muted, channel.solo);
  }, [channelId, channel.volume, channel.pan, channel.muted, channel.solo]);

  const meterRef = useRef<HTMLDivElement>(null);
  const meterLevel = useRef(0);

  // Animate meter (simplified - just shows volume level for now)
  useEffect(() => {
    let animId: number;
    const animate = () => {
      // Get actual level from engine if available, otherwise simulate
      const targetLevel = channel.muted ? 0 : channel.volume * 0.7;
      meterLevel.current += (targetLevel - meterLevel.current) * 0.1;
      if (meterRef.current) {
        const pct = Math.min(100, meterLevel.current * 100);
        meterRef.current.style.height = `${pct}%`;
      }
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, [channel.volume, channel.muted]);

  return (
    <div style={{
      width: isMaster ? 80 : 64,
      minWidth: isMaster ? 80 : 64,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: isMaster ? '#1a2744' : '#0f172a',
      borderRight: `1px solid ${primary}22`,
      padding: '8px 4px',
      boxSizing: 'border-box',
      gap: 4,
    }}>
      {/* Channel number / name */}
      <div style={{ 
        fontSize: 10, 
        textAlign: 'center', 
        color: isMaster ? primary : '#94a3b8',
        fontWeight: isMaster ? 700 : 400,
        marginBottom: 2,
      }}>
        {isMaster ? 'MASTER' : channelId}
      </div>
      
      {/* Routed patterns indicator */}
      {!isMaster && (
        <div style={{ 
          fontSize: 8, 
          textAlign: 'center', 
          color: '#64748b',
          height: 14,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {routedPatterns.length > 0 ? routedPatterns.join(', ') : '—'}
        </div>
      )}

      {/* Pan knob */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{ 
          width: 32, 
          height: 32, 
          borderRadius: '50%', 
          background: '#1e293b', 
          border: `2px solid ${primary}44`,
          position: 'relative',
          cursor: 'pointer',
        }}
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startPan = channel.pan;
            const onMove = (ev: MouseEvent) => {
              const dx = ev.clientX - startX;
              const newPan = Math.max(-1, Math.min(1, startPan + dx / 50));
              setPan(channelId, newPan);
            };
            const onUp = () => {
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
          onDoubleClick={() => setPan(channelId, 0)}
          title={`Pan: ${channel.pan < -0.01 ? Math.round(-channel.pan * 100) + 'L' : channel.pan > 0.01 ? Math.round(channel.pan * 100) + 'R' : 'C'}`}
        >
          {/* Pan indicator line */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 2,
            height: 12,
            background: primary,
            transformOrigin: 'center bottom',
            transform: `translate(-50%, -100%) rotate(${channel.pan * 135}deg)`,
          }} />
        </div>
        <div style={{ fontSize: 8, color: '#64748b' }}>
          {channel.pan < -0.01 ? `${Math.round(-channel.pan * 100)}L` : channel.pan > 0.01 ? `${Math.round(channel.pan * 100)}R` : 'C'}
        </div>
      </div>

      {/* Meter + Fader area */}
      <div style={{ flex: 1, display: 'flex', gap: 4, minHeight: 0 }}>
        {/* Meter */}
        <div style={{
          width: 12,
          flex: 1,
          background: '#0a0f1a',
          border: '1px solid #1e293b',
          borderRadius: 2,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div 
            ref={meterRef}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: `linear-gradient(to top, ${primary}, ${primary}aa, #22c55e)`,
              transition: 'height 50ms',
            }} 
          />
          {/* Meter scale marks */}
          {[0.25, 0.5, 0.75].map(p => (
            <div key={p} style={{
              position: 'absolute',
              bottom: `${p * 100}%`,
              left: 0,
              right: 0,
              height: 1,
              background: '#334155',
            }} />
          ))}
        </div>

        {/* Fader */}
        <div style={{
          width: 20,
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <input
            type="range"
            min={0}
            max={1.25}
            step={0.01}
            value={channel.volume}
            onChange={(e) => setVolume(channelId, Number(e.target.value))}
            onDoubleClick={() => setVolume(channelId, 0.8)}
            style={{
              width: '100%',
              height: '100%',
              WebkitAppearance: 'slider-vertical',
              writingMode: 'vertical-lr',
              direction: 'rtl',
              accentColor: primary,
              cursor: 'pointer',
            } as React.CSSProperties}
            title={`Volume: ${Math.round(channel.volume * 100)}%`}
          />
        </div>
      </div>

      {/* Volume readout */}
      <div style={{ 
        fontSize: 9, 
        textAlign: 'center', 
        color: channel.volume > 1 ? '#f97316' : '#94a3b8',
        fontFamily: 'monospace',
      }}>
        {channel.volume > 1 ? '+' : ''}{Math.round((channel.volume - 0.8) * 100 / 0.8 * 10) / 10}dB
      </div>

      {/* Mute / Solo buttons */}
      <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        <button
          onClick={() => setMuted(channelId, !channel.muted)}
          style={{
            width: 22,
            height: 18,
            fontSize: 9,
            fontWeight: 600,
            border: 'none',
            borderRadius: 3,
            background: channel.muted ? '#ef4444' : '#334155',
            color: channel.muted ? '#fff' : '#94a3b8',
            cursor: 'pointer',
          }}
          title="Mute"
        >
          M
        </button>
        {!isMaster && (
          <button
            onClick={() => setSolo(channelId, !channel.solo)}
            style={{
              width: 22,
              height: 18,
              fontSize: 9,
              fontWeight: 600,
              border: 'none',
              borderRadius: 3,
              background: channel.solo ? '#eab308' : '#334155',
              color: channel.solo ? '#000' : '#94a3b8',
              cursor: 'pointer',
            }}
            title="Solo"
          >
            S
          </button>
        )}
      </div>
    </div>
  );
};

// Routing selector for patterns and drums
const RoutingPanel: React.FC = () => {
  const primary = useTheme(s => s.primary);
  const pianoInstances = usePianoInstances(s => s.instances);
  const drumPatterns = useDrumPatterns(s => s.patterns);
  const routing = useMixer(s => s.routing);
  const setRouting = useMixer(s => s.setRouting);
  const drumRouting = useMixer(s => s.drumRouting);
  const setDrumRouting = useMixer(s => s.setDrumRouting);
  const channels = useMixer(s => s.channels);

  const pianoPatterns = Object.keys(pianoInstances).map(id => ({ id, label: `🎹 ${id}` }));
  const hasDrums = Object.keys(drumPatterns).length > 0;

  const selectStyle = {
    padding: '2px 4px',
    fontSize: 10,
    background: '#1e293b',
    border: `1px solid ${primary}44`,
    color: '#e2e8f0',
    borderRadius: 4,
  };

  return (
    <div style={{ 
      padding: 8, 
      borderBottom: `1px solid ${primary}22`,
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      alignItems: 'center',
    }}>
      {/* Piano/Synth routing */}
      {pianoPatterns.length > 0 && (
        <>
          <span style={{ fontSize: 10, color: '#64748b' }}>Synths:</span>
          {pianoPatterns.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 10, color: '#cbd5e1' }}>{p.label}</span>
              <span style={{ fontSize: 9, color: '#475569' }}>→</span>
              <select
                value={routing[p.id] ?? 0}
                onChange={(e) => {
                  const chId = Number(e.target.value);
                  setRouting(p.id, chId);
                  engine.setPatternRouting(p.id, chId);
                }}
                style={selectStyle}
              >
                <option value={0}>Master</option>
                {channels.filter(c => c.id > 0).map(c => (
                  <option key={c.id} value={c.id}>Ins {c.id}</option>
                ))}
              </select>
            </div>
          ))}
        </>
      )}
      
      {/* Drum routing - always show if there are drum patterns */}
      {hasDrums && (
        <>
          <div style={{ width: 1, height: 16, background: '#334155', margin: '0 4px' }} />
          <span style={{ fontSize: 10, color: '#64748b' }}>Drums:</span>
          {(['kick', 'snare', 'hat'] as const).map(drum => (
            <div key={drum} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 10, color: '#cbd5e1' }}>
                {drum === 'kick' ? '🥁' : drum === 'snare' ? '🪘' : '🎩'} {drum}
              </span>
              <span style={{ fontSize: 9, color: '#475569' }}>→</span>
              <select
                value={drumRouting[drum] ?? 0}
                onChange={(e) => {
                  const chId = Number(e.target.value);
                  setDrumRouting(drum, chId);
                  engine.setDrumRouting(drum, chId);
                }}
                style={selectStyle}
              >
                <option value={0}>Master</option>
                {channels.filter(c => c.id > 0).map(c => (
                  <option key={c.id} value={c.id}>Ins {c.id}</option>
                ))}
              </select>
            </div>
          ))}
        </>
      )}
      
      {pianoPatterns.length === 0 && !hasDrums && (
        <span style={{ fontSize: 11, color: '#64748b' }}>
          No patterns yet. Create patterns in the Playlist.
        </span>
      )}
    </div>
  );
};

const Mixer: React.FC = () => {
  const primary = useTheme(s => s.primary);
  const channels = useMixer(s => s.channels);

  // Initialize engine mixer channels on mount
  useEffect(() => {
    engine.initMixer();
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      background: '#0b1220',
    }}>
      {/* Routing panel */}
      <RoutingPanel />
      
      {/* Channel strips */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        overflowX: 'auto', 
        overflowY: 'hidden',
        borderTop: `1px solid ${primary}22`,
      }}>
        {/* Insert channels 1-15 */}
        {channels.filter(c => c.id > 0).map(channel => (
          <ChannelStrip key={channel.id} channelId={channel.id} />
        ))}
        {/* Master channel (last, wider) */}
        <ChannelStrip channelId={0} isMaster />
      </div>
    </div>
  );
};

export default Mixer;
