import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { numeral } from '@/lib/theory/cadence';
import { FractalScene } from './FractalScene';
import { moveLights } from './lights';

afterEach(cleanup);

const labelFor = (pc: number) => ({ main: numeral(pc) });
const litText = (container: HTMLElement) => container.querySelector('[data-lit]')?.textContent ?? null;

describe('FractalScene playback lights', () => {
  it('lights each node of a move in turn, back to the centre', () => {
    const steps = moveLights([], 'in', ['dominant', 'dominant']);
    const seen = steps.map((playing) => {
      const { container } = render(<FractalScene walk={[]} dir="in" labelFor={labelFor} playing={playing} />);
      const text = litText(container);
      cleanup();
      return text;
    });
    expect(seen).toEqual(['II', 'V', 'I']);
  });

  it('dims everything off the playing path, like hover', () => {
    const [first] = moveLights([], 'in', ['dominant', 'dominant']);
    const { container } = render(<FractalScene walk={[]} dir="in" labelFor={labelFor} playing={first} />);
    const opacityOf = (text: string) =>
      Number([...container.querySelectorAll('g[opacity]')].find((g) => g.querySelector('text')?.textContent === text)?.getAttribute('opacity'));
    expect(opacityOf('V')).toBe(1);
    expect(opacityOf('IV')).toBeLessThan(0.3);
  });

  it('lights nothing when nothing plays', () => {
    const { container } = render(<FractalScene walk={[]} dir="in" labelFor={labelFor} />);
    expect(litText(container)).toBeNull();
  });
});
