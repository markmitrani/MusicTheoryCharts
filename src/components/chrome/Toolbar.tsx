'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useCanvas, canvasStore } from '@/lib/canvas-store/store';
import { uiTick } from '@/lib/playback/playback';
import type { Tool } from '@/lib/canvas-store/types';
import { SelectIcon, MoveIcon, FrameIcon, UploadIcon, LayersIcon, PlusIcon } from './icons';
import styles from './Toolbar.module.scss';

interface ToolDef {
  id: Tool | 'add';
  label: string;
  icon: React.ReactNode;
}

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', icon: <SelectIcon /> },
  { id: 'move', label: 'Move', icon: <MoveIcon /> },
  { id: 'frame', label: 'Section', icon: <FrameIcon /> },
  { id: 'upload', label: 'Upload', icon: <UploadIcon /> },
  { id: 'layers', label: 'Layers', icon: <LayersIcon /> },
  { id: 'add', label: 'Add new', icon: <PlusIcon /> },
];

interface ToolbarProps {
  onAddNew: () => void;
  onUpload: () => void;
}

export function Toolbar({ onAddNew, onUpload }: ToolbarProps) {
  const tool = useCanvas((s) => s.tool);
  const barRef = useRef<HTMLDivElement>(null);

  const press = (target: HTMLElement) => {
    gsap.fromTo(target, { scale: 0.88 }, { scale: 1, duration: 0.45, ease: 'back.out(2.5)' });
  };

  const handleClick = (def: ToolDef, e: React.MouseEvent<HTMLButtonElement>) => {
    press(e.currentTarget);
    uiTick(TOOLS.findIndex((t) => t.id === def.id));
    if (def.id === 'add') {
      onAddNew();
      return;
    }
    if (def.id === 'upload') {
      onUpload();
      return;
    }
    canvasStore.getState().setTool(def.id);
  };

  return (
    <div ref={barRef} className={styles.bar} role="toolbar" aria-label="Canvas tools">
      {TOOLS.map((def) => (
        <button
          key={def.id}
          className={styles.tool}
          data-active={tool === def.id || undefined}
          data-round={def.id === 'add' || undefined}
          aria-label={def.label}
          title={def.label}
          onClick={(e) => handleClick(def, e)}
        >
          {def.icon}
        </button>
      ))}
    </div>
  );
}
