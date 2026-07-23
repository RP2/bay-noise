/** The full data file loaded from shows.json */
export interface ShowsData {
  updated: string; // ISO date
  shows: ShowDay[];
}

/** A single day with events */
export interface ShowDay {
  date: string; // YYYY-MM-DD
  day: string; // "Sat Jul 25"
  venues: VenueEvent[];
}

/** A venue with its artists for that day */
export interface VenueEvent {
  name: string; // "Bottom of the Hill, S.F."
  city: string | null; // "San Francisco" | null (if unparseable)
  artists: Artist[];
  extra: string; // Display string: "9pm · $15"
  time: string | null; // Extracted by pipeline: "9pm"
  price: string | null; // Extracted by pipeline: "$15"
  age: string | null; // Extracted by pipeline: "all ages", "21+", etc.
}

/** An artist/band */
export interface Artist {
  name: string;
  genres: string[]; // ["punk", "indie"]
  spotifyUrl?: string;
}

/** User genre preferences (stored in localStorage) */
export interface UserPrefs {
  preferredGenres: string[];
  onboarded: boolean;
}

/** A show card ready for rendering (flattened + scored) */
export interface ScoredShow {
  date: string;
  day: string;
  venueName: string;
  city: string | null;
  artists: Artist[];
  extra: string;
  time: string | null;
  price: string | null;
  age: string | null;
  score: number; // genre match score (0 = no match)
}

/** App-level filter state (lives in app.tsx) */
export interface FilterState {
  query: string; // free-text search
  venue: string | null; // active venue filter (null = none)
  artist: string | null; // active artist filter (null = none)
  city: string | null; // active city filter (null = none)
  showAll: boolean; // bypass genre-scoring fold
}
