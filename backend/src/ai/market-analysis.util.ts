export interface ProductionObservation {
  year: number;
  value: number;
}

export interface WeightedSupplyMetrics {
  bps_latest_year: number;
  bps_production_index: number;
  internal_production_index: number;
  weighted_supply_index: number;
  weighted_supply_change_percentage: number;
  bps_weight: 0.8;
  internal_weight: 0.2;
}

const BASE_INTERNAL_YIELD_KG_PER_M2 = 0.5;

export function calculateWeightedSupplyMetrics(
  productionByYear: ProductionObservation[],
  internalEstimatedYieldKg: number,
  internalAreaM2: number,
): WeightedSupplyMetrics | null {
  const observations = [...productionByYear].sort((left, right) => left.year - right.year);
  if (
    observations.length < 2 ||
    internalAreaM2 <= 0 ||
    internalEstimatedYieldKg < 0
  ) {
    return null;
  }

  const latest = observations.at(-1)!;
  const previous = observations.slice(0, -1).slice(-3);
  const bpsReference =
    previous.reduce((total, observation) => total + observation.value, 0) /
    previous.length;
  const internalReference = internalAreaM2 * BASE_INTERNAL_YIELD_KG_PER_M2;
  if (bpsReference <= 0 || internalReference <= 0) return null;

  const bpsProductionIndex = latest.value / bpsReference;
  const internalProductionIndex = internalEstimatedYieldKg / internalReference;
  const weightedSupplyIndex =
    bpsProductionIndex * 0.8 + internalProductionIndex * 0.2;

  return {
    bps_latest_year: latest.year,
    bps_production_index: bpsProductionIndex,
    internal_production_index: internalProductionIndex,
    weighted_supply_index: weightedSupplyIndex,
    weighted_supply_change_percentage: (weightedSupplyIndex - 1) * 100,
    bps_weight: 0.8,
    internal_weight: 0.2,
  };
}