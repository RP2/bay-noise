import type { ScoredShow, Artist } from "../lib/types.js";
import { GenrePill } from "./genre-pill.js";
import { AddToCalendar } from "./add-to-calendar.js";

interface ShowCardProps {
  show: ScoredShow;
  onVenueClick?: (venue: string) => void;
  onArtistClick?: (artist: string) => void;
}

/** Stable venue object for AddToCalendar — avoids unnecessary re-renders. */
function venueFromShow(show: ScoredShow) {
  return {
    name: show.venueName,
    city: show.city,
    artists: show.artists,
    extra: show.extra,
    time: show.time,
    price: show.price,
    age: show.age,
  };
}

export function ShowCard({ show, onVenueClick, onArtistClick }: ShowCardProps) {
  return (
    <div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      {/* Venue name and city */}
      <div class="mb-2">
        <button
          type="button"
          class="text-left font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
          onClick={() => onVenueClick?.(show.venueName)}
        >
          {show.venueName}
        </button>
        {show.city && (
          <span class="ml-1 text-sm text-gray-500 dark:text-gray-400">
            {show.city}
          </span>
        )}
      </div>

      {/* Event info: time, price, age */}
      {show.extra && (
        <p class="mb-3 text-sm text-gray-600 dark:text-gray-400">
          {show.extra}
        </p>
      )}

      {/* Artists list */}
      <ul class="mb-3 space-y-1">
        {show.artists.map((artist, i) => (
          <li key={i}>
            <ArtistRow artist={artist} onArtistClick={onArtistClick} />
          </li>
        ))}
      </ul>

      {/* Actions row */}
      <div class="flex items-center gap-3">
        <AddToCalendar date={show.date} venue={venueFromShow(show)} />
      </div>
    </div>
  );
}

interface ArtistRowProps {
  artist: Artist;
  onArtistClick?: (artist: string) => void;
}

function ArtistRow({ artist, onArtistClick }: ArtistRowProps) {
  return (
    <div class="flex flex-wrap items-center gap-1">
      <button
        type="button"
        class="text-sm font-medium text-gray-900 hover:text-blue-700 dark:text-gray-100 dark:hover:text-blue-400"
        onClick={() => onArtistClick?.(artist.name)}
      >
        {artist.name}
      </button>
      {artist.spotifyUrl && (
        <a
          href={artist.spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
          title="Open in Spotify"
        >
          &#9835; Spotify
        </a>
      )}
      <div class="flex flex-wrap gap-1">
        {[...new Set(artist.genres)].slice(0, 2).map((g, gi) => (
          <GenrePill key={`${artist.name}-${g}-${gi}`} name={g} />
        ))}
      </div>
    </div>
  );
}
