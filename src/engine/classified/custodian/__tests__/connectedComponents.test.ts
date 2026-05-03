import { describe, expect, it } from 'vitest';
import { findConnectedComponents } from '../connectedComponents';
import { buildState } from '../testHelpers';
import { createMakYekConfig } from '../makYekConfig';

const MAK = createMakYekConfig();

describe('findConnectedComponents', () => {
  it('partitions isolated singletons into separate components', () => {
    const state = buildState({
      config: MAK,
      pieces: { a1: 'm', h8: 'm' },
    });
    const components = findConnectedComponents(state.pieces, 'white', 8);
    expect(components).toHaveLength(2);
  });

  it('groups two adjacent pieces as one component', () => {
    const state = buildState({
      config: MAK,
      pieces: { a1: 'm', a2: 'm' },
    });
    const components = findConnectedComponents(state.pieces, 'white', 8);
    expect(components).toHaveLength(1);
    expect(components[0]?.nodes).toHaveLength(2);
  });

  it('groups an L-shaped trio as one component', () => {
    const state = buildState({
      config: MAK,
      pieces: { a1: 'm', a2: 'm', b2: 'm' },
    });
    const components = findConnectedComponents(state.pieces, 'white', 8);
    expect(components).toHaveLength(1);
    expect(components[0]?.nodes).toHaveLength(3);
  });

  it('returns empty list when owner has no pieces', () => {
    const state = buildState({ config: MAK, pieces: { e4: 'b' } });
    const components = findConnectedComponents(state.pieces, 'white', 8);
    expect(components).toHaveLength(0);
  });

  it('separates two same-color groups divided by an opponent', () => {
    const state = buildState({
      config: MAK,
      pieces: { a1: 'm', a3: 'm', a2: 'b' },
    });
    const components = findConnectedComponents(state.pieces, 'white', 8);
    expect(components).toHaveLength(2);
  });

  it('treats diagonal-only pairs as separate components (4-neighbor only)', () => {
    const state = buildState({
      config: MAK,
      pieces: { a1: 'm', b2: 'm' },
    });
    const components = findConnectedComponents(state.pieces, 'white', 8);
    expect(components).toHaveLength(2);
  });

  it('sorts component nodes ascending', () => {
    const state = buildState({
      config: MAK,
      pieces: { a3: 'm', a2: 'm', a1: 'm' },
    });
    const components = findConnectedComponents(state.pieces, 'white', 8);
    expect(components).toHaveLength(1);
    const nodes = components[0]?.nodes.map((n) => n as unknown as number);
    expect(nodes).toEqual([...(nodes ?? [])].sort((a, b) => a - b));
  });
});
