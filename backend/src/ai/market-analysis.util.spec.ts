import { describe, expect, it } from '@jest/globals';
import { calculateWeightedSupplyMetrics } from './market-analysis.util';

describe('calculateWeightedSupplyMetrics', () => {
  it('combines BPS and internal production indices using fixed 80/20 weights', () => {
    const result = calculateWeightedSupplyMetrics(
      [
        { year: 2023, value: 100 },
        { year: 2024, value: 120 },
      ],
      40,
      100,
    );

    expect(result?.bps_production_index).toBe(1.2);
    expect(result?.internal_production_index).toBe(0.8);
    expect(result?.weighted_supply_index).toBeCloseTo(1.12);
    expect(result?.weighted_supply_change_percentage).toBeCloseTo(12);
    expect(result?.bps_weight).toBe(0.8);
    expect(result?.internal_weight).toBe(0.2);
  });

  it('rejects missing history and invalid internal area', () => {
    expect(calculateWeightedSupplyMetrics([{ year: 2024, value: 100 }], 50, 100)).toBeNull();
    expect(
      calculateWeightedSupplyMetrics(
        [
          { year: 2023, value: 100 },
          { year: 2024, value: 120 },
        ],
        50,
        0,
      ),
    ).toBeNull();
  });
});