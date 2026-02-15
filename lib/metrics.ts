// Minimal in-memory metrics collector
const metrics = {};
export function getMetrics(ns) {
  return {
    count: (name) => {
      metrics[`${ns}:${name}`] = (metrics[`${ns}:${name}`] || 0) + 1;
    },
    observe: (name, value) => {
      if (!metrics[`${ns}:${name}`]) metrics[`${ns}:${name}`] = [];
      metrics[`${ns}:${name}`].push(value);
    },
    get: (name) => metrics[`${ns}:${name}`],
  };
}
