const now = Date.now();

const station = (id, name, lat, lon, mechanical, electric, freeDocks, capacity, age = 42) => ({
  provider_id: "biki",
  station_id: id,
  name,
  location: { latitude: lat, longitude: lon },
  bikes: { mechanical, electric },
  free_docks: freeDocks,
  capacity,
  occupancy_percent: capacity ? Math.round(((capacity - freeDocks) / capacity) * 10000) / 100 : null,
  status: "active",
  observed_at: new Date(now - age * 1000).toISOString(),
  collected_at: new Date(now - (age - 4) * 1000).toISOString(),
  data_age_seconds: age,
  is_stale: age > 600,
});

export const fixtureStations = [
  station("1", "Fuente Dorada", 41.6523, -4.7245, 11, 5, 14, 30),
  station("2", "Plaza España", 41.6508, -4.724, 4, 1, 25, 30),
  station("3", "Campo Grande", 41.6458, -4.7286, 18, 7, 9, 40),
  station("4", "Universidad", 41.6592, -4.7134, 2, 0, 31, 35),
  station("5", "Estación del Norte", 41.6425, -4.7271, 10, 3, 12, 30),
];

export const fixtureHistory = (stationId, from, to, granularity) => {
  const start = new Date(from);
  const end = new Date(to);
  const step = granularity === "day" ? 24 * 3600_000 : 3600_000;
  const points = [];
  for (let time = start.getTime(); time < end.getTime(); time += step) {
    const phase = Math.abs(Math.sin(time / (step * 2.9)));
    const capacity = 30;
    const mechanical = Math.round(4 + phase * 12);
    const electric = Math.round(1 + phase * 5);
    const freeDocks = Math.max(0, capacity - mechanical - electric);
    points.push({
      timestamp: new Date(time).toISOString(),
      mechanical,
      electric,
      free_docks: freeDocks,
      capacity,
      occupancy_percent: Math.round(((capacity - freeDocks) / capacity) * 10000) / 100,
      observations: 1,
    });
  }
  return { station_id: stationId, provider_id: "biki", from, to, granularity, points };
};

export const fixtureSummary = (stationId, from, to) => ({
  station_id: stationId,
  provider_id: "biki",
  from,
  to,
  observations: 24,
  occupancy: { average_percent: 48.2, minimum_percent: 16.7, maximum_percent: 76.7, minimum_at: from, maximum_at: to },
  bikes: { mechanical_average: 10.4, electric_average: 3.7, free_docks_average: 16.1, total_bikes_average: 14.1 },
  composition: { mechanical_percent: 43.8, electric_percent: 15.5, free_docks_percent: 40.7 },
  first_observed_at: from,
  last_observed_at: to,
  missing_buckets: 2,
});
