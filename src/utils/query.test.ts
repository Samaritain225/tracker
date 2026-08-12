import { isQueryLoading } from './query';

describe('isQueryLoading', () => {
  it('reports loading before the first result arrives', () => {
    expect(isQueryLoading(undefined, undefined)).toBe(true);
  });

  it('reports loaded once the query has resolved', () => {
    expect(isQueryLoading(new Date(), undefined)).toBe(false);
  });

  it('reports loaded when the query resolved with no rows', () => {
    // The regression this guards: an empty result set is truthy, so a
    // data-based check would call this "loaded" from the first render and
    // let consumers initialize their state from nothing.
    expect(isQueryLoading(new Date(), undefined)).toBe(false);
  });

  it('stops loading when the query errors', () => {
    expect(isQueryLoading(undefined, new Error('boom'))).toBe(false);
  });
});
