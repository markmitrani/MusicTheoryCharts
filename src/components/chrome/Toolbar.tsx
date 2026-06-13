'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useCanvas, canvasStore } from '@/lib/canvas-store/store';
import { uiTick } from '@/lib/playback/playback';
import type { Tool } from '@/lib/canvas-store/types';
import {
  SelectIcon,
  MoveIcon,
  FrameIcon,
  UploadIcon,
  LayersIcon,
  PlusIcon,
  BringToFrontIcon,
  BringForwardIcon,
  SendBackwardIcon,
  SendToBackIcon,
} from './icons';
import styles from './Toolbar.module.scss';

interface ToolDef {
  id: Tool;
  label: string;
  icon: React.ReactNode;
}

const MODE_TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', icon: <SelectIcon /> },
  { id: 'move', label: 'Move', icon: <MoveIcon /> },
  { id: 'frame', label: 'Section', icon: <FrameIcon /> },
  { id: 'upload', label: 'Upload', icon: <UploadIcon /> },
];

type ZAction = 'front' | 'forward' | 'backward' | 'back';

const Z_ACTIONS: Array<{ id: ZAction; label: string; icon: React.ReactNode }> = [
  { id: 'front', label: 'Bring to front', icon: <BringToFrontIcon width={17} height={17} /> },
  { id: 'forward', label: 'Bring forward', icon: <BringForwardIcon width={17} height={17} /> },
  { id: 'backward', label: 'Send backward', icon: <SendBackwardIcon width={17} height={17} /> },
  { id: 'back', label: 'Send to back', icon: <SendToBackIcon width={17} height={17} /> },
];

interface ToolbarProps {
  onAddNew: () => void;
  onUpload: () => void;
}

export function Toolbar({ onAddNew, onUpload }: ToolbarProps) {
  const tool = useCanvas((s) => s.tool);
  const hasSelection = useCanvas((s) => s.selection.size > 0);
  const barRef = useRef<HTMLDivElement>(null);
  const [layersOpen, setLayersOpen] = useState(false);

  useEffect(() => {
    if (!layersOpen) return;
    const close = () => setLayersOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [layersOpen]);

  const press = (target: HTMLElement) => {
    gsap.fromTo(target, { scale: 0.88 }, { scale: 1, duration: 0.45, ease: 'back.out(2.5)' });
  };

  const handleMode = (def: ToolDef, e: React.MouseEvent<HTMLButtonElement>) => {
    press(e.currentTarget);
    uiTick(MODE_TOOLS.findIndex((t) => t.id === def.id) + 1);
    if (def.id === 'upload') {
      onUpload();
      return;
    }
    canvasStore.getState().setTool(def.id);
  };

  // Apply a z-order action to every selected element.
  const applyZ = (action: ZAction) => {
    const s = canvasStore.getState();
    const ids = [...s.selection];
    const fn = {
      front: s.bringToFront,
      forward: s.bringForward,
      backward: s.sendBackward,
      back: s.sendToBack,
    }[action];
    ids.forEach((id) => fn(id));
  };

  return (
    <div ref={barRef} className={styles.bar} role="toolbar" aria-label="Canvas tools">
      {MODE_TOOLS.map((def) => (
        <button
          key={def.id}
          className={styles.tool}
          data-active={tool === def.id || undefined}
          aria-label={def.label}
          title={def.label}
          onClick={(e) => handleMode(def, e)}
        >
          {def.icon}
        </button>
      ))}

      <div className={styles.layersWrap}>
        <button
          className={styles.tool}
          data-active={layersOpen || undefined}
          aria-label="Layers"
          aria-expanded={layersOpen}
          title="Layers (z-order)"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            press(e.currentTarget);
            setLayersOpen((v) => !v);
          }}
        >
          <LayersIcon />
        </button>
        {layersOpen && (
          <div className={styles.layersMenu} role="menu" onPointerDown={(e) => e.stopPropagation()}>
            {!hasSelection && <p className={styles.hint}>Select an element first</p>}
            {Z_ACTIONS.map((a) => (
              <button
                key={a.id}
                className={styles.layersItem}
                role="menuitem"
                disabled={!hasSelection}
                onClick={() => applyZ(a.id)}
              >
                {a.icon}
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        className={styles.tool}
        data-round
        aria-label="Add new"
        title="Add new"
        onClick={(e) => {
          press(e.currentTarget);
          uiTick(5);
          onAddNew();
        }}
      >
        <PlusIcon />
      </button>
    </div>
  );
}
