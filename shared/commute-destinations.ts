import london from './london.json' with {type: 'json'};
import {universities} from '../src/universities.ts';

type Kind = 'University' | 'Area' | 'Landmark';
type Point = {name: string; lat: number; lng: number; aliases?: string[]};
export type CommutePlace = Point & {id: string; kind: Kind};

const searchable = (value: string) => value.toLowerCase().normalize('NFKD')
  .replace(/\p{M}/gu, '').replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const aliases: Record<string, string[]> = {
  'UCL · Bloomsbury': ['University College London', '伦敦大学学院'],
  'London School of Economics · Lincoln’s Inn Fields': ['LSE', 'London School of Economics and Political Science', '伦敦政治经济学院'],
  'Imperial College London · South Kensington': ['Imperial', '帝国理工学院'],
  'King’s College London · Strand': ['KCL', '伦敦国王学院'],
  'University of the Arts London · Central Saint Martins': ['UAL', 'CSM', '伦敦艺术大学', '中央圣马丁'],
  'Canary Wharf': ['金丝雀码头'],
  'King’s Cross': ['国王十字'],
  'Tower Bridge': ['伦敦塔桥'],
  'British Museum': ['大英博物馆'],
};

function destinations(points: Point[], kind: Kind): CommutePlace[] {
  return points.map(point => ({
    ...point,
    aliases: [...point.aliases ?? [], ...aliases[point.name] ?? []],
    id: kind.toLowerCase() + '-' + searchable(point.name).replaceAll(' ', '-'),
    kind,
  }));
}

export const commutePlaces = [
  ...destinations(universities, 'University'),
  ...destinations(london.areas, 'Area'),
  ...destinations(london.landmarks, 'Landmark'),
];
const placesById = new Map(commutePlaces.map(place => [place.id, place]));
const popular = ['Canary Wharf', 'King’s Cross', 'UCL · Bloomsbury', 'London School of Economics · Lincoln’s Inn Fields', 'British Museum', 'Tower Bridge'];
const indexed = commutePlaces.map(place => ({
  place, name: searchable(place.name), aliases: (place.aliases ?? []).map(searchable),
}));

export function commutePlace(id: unknown) {
  return typeof id === 'string' ? placesById.get(id) : undefined;
}

export function commutePlaceSuggestions(query: string) {
  const terms = searchable(query);
  if (!terms) return popular.flatMap(name => commutePlaces.filter(place => place.name === name));
  const words = terms.split(' ');
  return indexed.map(({place, name, aliases: names}) => {
    const candidates = [name, ...names];
    const score = candidates.includes(terms) ? 0 : candidates.some(value => value.startsWith(terms)) ? 1
      : candidates.some(value => words.every(word => value.includes(word))) ? 2 : 3;
    return {place, score};
  }).filter(result => result.score < 3)
    .sort((a, b) => a.score - b.score || a.place.name.localeCompare(b.place.name))
    .slice(0, 7).map(result => result.place);
}

export function fullCommutePostcode(value: unknown) {
  if (typeof value !== 'string') return null;
  const raw = value.trim().toUpperCase().replace(/\s/g, '');
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(raw) ? raw.slice(0, -3) + ' ' + raw.slice(-3) : null;
}
