import type { ScoredShow, Artist } from "../lib/types.js";
import { AddToCalendar } from "./add-to-calendar.js";

interface ShowCardProps {
  show: ScoredShow;
  onVenueClick?: (venue: string) => void;
  onArtistClick?: (artist: string) => void;
  onGenreClick?: (genre: string) => void;
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

export function ShowCard({ show, onVenueClick, onArtistClick, onGenreClick }: ShowCardProps) {
  // Deduplicate genres across all artists, flatten to a unique set
    // Raw deduplicated genres from all artists, sorted alphabetically
    const displayedGenres = [...new Set(show.artists.flatMap((a) => a.genres))].sort();

  return (
    <div class="border border-neutral-200 bg-white p-4 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
      {/* Venue name and city */}
      <div class="mb-2">
        <button
          type="button"
          class="cursor-pointer text-left font-semibold underline-offset-2 hover:underline"
          onClick={() => onVenueClick?.(show.venueName)}
        >
          {show.venueName}
        </button>
        {show.city && (
          <span class="ml-1 text-sm text-neutral-500 dark:text-neutral-400">
            {show.city}
          </span>
        )}
      </div>

      {/* Genres (mapped to broad categories) + event info */}
      <p class="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
        {show.extra && <span>{show.extra}{displayedGenres.length > 0 && <span> · </span>}</span>}
        {displayedGenres.map((g, i) => (
          <span key={g}>
            {i > 0 && <span>, </span>}
            <button
              type="button"
              onClick={() => onGenreClick?.(g)}
              class="cursor-pointer underline-offset-2 hover:underline"
            >
              {g}
            </button>
          </span>
        ))}
      </p>

      {/* Artists list */}
      <ul class="mb-2 space-y-1">
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
        class="cursor-pointer text-sm font-medium underline-offset-2 hover:underline"
        onClick={() => onArtistClick?.(artist.name)}
      >
        {artist.name}
      </button>
      {artist.spotifyUrl && (
        <a
          href={artist.spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-neutral-500 underline underline-offset-2 hover:text-black dark:hover:text-white"
          title="Open in Spotify"
        >
          &#9835; Spotify
        </a>
      )}
    </div>
  );
}
