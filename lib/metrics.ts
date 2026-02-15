// Minimal in-memory metrics collector
type MetricsStore = Record<string, number | number[]>;
const metrics: MetricsStore = {};

export function getMetrics(ns: string) {
  return {
    count: (name: string) => {
      const key = `${ns}:${name}`;
      metrics[key] = (typeof metrics[key] === 'number' ? (metrics[key] as number) : 0) + 1;
    },
    observe: (name: string, value: number) => {
      const key = `${ns}:${name}`;
      if (!Array.isArray(metrics[key])) metrics[key] = [];
      (metrics[key] as number[]).push(value);
    },
    get: (name: string) => metrics[`${ns}:${name}`],
  };
}
