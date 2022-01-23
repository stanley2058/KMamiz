export default class Normalizer {
  static Numbers(input: number[], strategy: (input: number[]) => number[]) {
    return strategy(input);
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
     * Divide by max value
     * @param input
     * @returns Array of number between 0 and 1
     */
    FixedRatio(input: number[]) {
      const max = Math.max(...input);
      if (max === 0) return input;
      return input.map((value) => value / max);
    },
  };
}
