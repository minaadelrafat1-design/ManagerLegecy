/** Configuration for board/fan confidence systems. Tunable in future phases.
 * Keep lightweight and serializable so it can be moved into `GameState` if
 * needed later. */
export const FAN_CONFIDENCE_WEIGHTS = {
  results: 0.35,
  rival: 0.12,
  style: 0.15,
  transfers: 0.12,
  identity: 0.06,
  stars: 0.2,
};

export const FAN_SENSITIVITY_BASE = 0.05; // min smoothing alpha

export const BOARD_CONFIDENCE_WEIGHTS = {
  results: 0.3,
  objectives: 0.2,
  finances: 0.15,
  managerCredit: 0.15,
  development: 0.1,
};

export const BOARD_PATIENCE_ALPHA_BASE = 0.02; // base alpha

export default {};
