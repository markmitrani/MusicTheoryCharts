import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { LessonWindow } from './LessonWindow';

afterEach(cleanup);

function setup(slide = 0) {
  const onSlide = vi.fn();
  const onClose = vi.fn();
  render(
    <LessonWindow label="Test" slideCount={3} slide={slide} onSlide={onSlide} onClose={onClose}>
      <p>content</p>
    </LessonWindow>,
  );
  return { onSlide, onClose };
}

describe('LessonWindow', () => {
  it('hides ← on the first slide and → on the last', () => {
    setup(0);
    expect(screen.queryByLabelText('Previous slide')).toBeNull();
    expect(screen.getByLabelText('Next slide')).toBeTruthy();
    cleanup();
    setup(2);
    expect(screen.getByLabelText('Previous slide')).toBeTruthy();
    expect(screen.queryByLabelText('Next slide')).toBeNull();
  });

  it('navigates by arrow button, dot and keyboard', () => {
    const { onSlide } = setup(1);
    fireEvent.click(screen.getByLabelText('Next slide'));
    expect(onSlide).toHaveBeenLastCalledWith(2);
    fireEvent.click(screen.getByLabelText('Slide 1'));
    expect(onSlide).toHaveBeenLastCalledWith(0);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    });
    expect(onSlide).toHaveBeenLastCalledWith(0);
  });

  it('closes on Esc', () => {
    const { onClose } = setup();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalled();
  });
});
