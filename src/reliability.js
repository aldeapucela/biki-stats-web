// Una estación no puede tener más bicis que capacidad: si pasa, la lectura es imposible (por ejemplo, la estación
// temporal 104 del estadio Zorrilla llegó a dar 396 mecánicas + 396 eléctricas con capacidad 1). Medido el 3-nov-2026
// sobre las 104 estaciones: en 103 las bicis más los huecos libres están entre el 90 % y el 100 % de la capacidad.
export function isImpossibleReading(station) {
  const { mechanical, electric } = station.bikes ?? {};
  const capacity = station.capacity;
  return capacity != null && (mechanical || 0) + (electric || 0) > capacity;
}

// Quita las cifras de una lectura imposible y la marca, para que nada (mapa, lista, destino, ruta) las use.
export function withoutImpossibleReading(station) {
  if (!isImpossibleReading(station)) return station;
  return { ...station, bikes: { mechanical: null, electric: null }, free_docks: null, occupancy_percent: null, unreliable: true };
}

export const withoutImpossibleReadings = (response) =>
  Array.isArray(response?.data) ? { ...response, data: response.data.map(withoutImpossibleReading) } : response;
