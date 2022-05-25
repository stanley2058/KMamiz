import Utils from "./Utils";

export default class Normalizer {
  static Numbers(
    input: number[],
    strategy: (input: number[], ...args: any) => number[],
    ...args: any
  ) {
    return strategy(input, ...args);
  }
  static readonly Strategy = {
    /**
     * Format to [0.1 ~ 1]
     * @param input
     * @returns Array of number between 0.1 and 1
     */
    BetweenFixedNumber(input: number[]) {
      const baseLine = 0.1;
      const ratio = 1 - baseLine;
      const max = Math.max(...input);
      const min = Math.min(...input);
      if (max - min === 0) return input;
      return input.map(
        (value) => ((value - min) / (max - min)) * ratio + baseLine
      );
    },
    /**
     * Sigmoid function
     * @param input
     * @returns Array of number between 0 and 1
     */
    Sigmoid(input: number[]) {
      return input.map((value) => 1 / (1 + Math.exp(-value)));
    },
    /**
     * Adjusted sigmoid function, scales [0-Inf] into [0-1]
     *
     * y = 1 / (1 + e^(-z*(x - 1.5)))
     * @param input
     * @returns Array of number between 0 and 1
     */
    SigmoidAdj(input: number[]) {
      // e^(0.5*z) = 3; z ~= 2.19722457733621935
      const z = 2.19722457733621935;
      return input.map((value) =>
        Utils.ToPrecise(1 / (1 + Math.exp(-z * (value - 1.5))))
      );
    },
    /**
     * Divide by max value
     * @param input
     * @returns Array of number between 0 and 1
     */
    FixedRatio(input: number[]) {
      const max = Math.max(...input);
      if (max === 0) return input;
      return input.map((value) => value / max);
    },
    /**
     * Normalized with fixed ratio and scale linearly to fit in [minimum ~ 1]
     * @param input
     * @param minimum number < 1, default: 0.1
     * @returns Array of number between minimum and 1
     */
    Linear(input: number[], minimum: number = 0.1) {
      if (minimum >= 1) return input;
      return Normalizer.Strategy.FixedRatio(input).map(
        (n) => n * (1 - minimum) + minimum
      );
    },
  };
}
