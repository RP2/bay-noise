import type { ShowsData, ScoredShow } from "../types.js";

export const SAMPLE_SHOWS: ShowsData = {
  updated: "2026-07-20",
  shows: [
    {
      date: "2026-07-25",
      day: "Sat Jul 25",
      venues: [
        {
          name: "Bottom of the Hill, S.F.",
          city: "San Francisco",
          address: null,
          artists: [
            { name: "Sad Snack", genres: ["punk", "indie"], spotifyUrl: "https://open.spotify.com/artist/7KtN9nQaFrGOwyKyF59bA9" },
            { name: "Foolish Relics", genres: ["punk"] },
          ],
          extra: "9pm · $15",
          time: "9pm",
          price: "$15",
          age: null,
        },
        {
          name: "August Hall, S.F.",
          city: "San Francisco",
          address: null,
          artists: [
            { name: "Cab", genres: ["indie rock"] },
            { name: "Jady", genres: ["electronic"] },
          ],
          extra: "7:30pm · $39.30",
          time: "7:30pm",
          price: "$39.30",
          age: "5+",
        },
      ],
    },
    {
      date: "2026-07-26",
      day: "Sun Jul 26",
      venues: [
        {
          name: "924 Gilman Street, Berkeley",
          city: "Berkeley",
          address: null,
          artists: [
            { name: "Spray", genres: ["hardcore punk"] },
            { name: "Torch", genres: ["metal"] },
            { name: "Open Wound", genres: ["punk"] },
          ],
          extra: "a/a · 7pm/8pm · $10",
          time: "7pm/8pm",
          price: "$10",
          age: "a/a",
        },
      ],
    },
    {
      date: "2026-08-01",
      day: "Sat Aug 1",
      venues: [
        {
          name: "The New Parish, Oakland",
          city: "Oakland",
          address: null,
          artists: [
            { name: "Helado Negro", genres: ["indie", "electronic"], spotifyUrl: "https://open.spotify.com/artist/5qoJgyq3gFLuhCbMBiWjBp" },
          ],
          extra: "8pm · $25",
          time: "8pm",
          price: "$25",
          age: null,
        },
      ],
    },
    {
      date: "2026-08-15",
      day: "Sat Aug 15",
      venues: [
        {
          name: "The Temple",
          city: null,
          address: null,
          artists: [
            { name: "Dust Collector", genres: ["noise", "experimental"] },
          ],
          extra: "10pm",
          time: "10pm",
          price: null,
          age: null,
        },
      ],
    },
  ],
};

/** Minimal data with no shows */
export const EMPTY_SHOWS: ShowsData = {
  updated: "2026-07-20",
  shows: [],
};

/** Pre-scored shows (flattened from SAMPLE_SHOWS) for filter tests */
export const SAMPLE_SCORED_SHOWS: ScoredShow[] = [
  {
    date: "2026-07-25",
    day: "Sat Jul 25",
    venueName: "Bottom of the Hill, S.F.",
    city: "San Francisco",
    address: null,
    artists: [
      { name: "Sad Snack", genres: ["punk", "indie"], spotifyUrl: "https://open.spotify.com/artist/7KtN9nQaFrGOwyKyF59bA9" },
      { name: "Foolish Relics", genres: ["punk"] },
    ],
    extra: "9pm · $15",
    time: "9pm",
    price: "$15",
    age: null,
    score: 1, // only Open Wound (punk) matches; Spray (hardcore punk → hardcore) and Torch (metal) don't
  },
  {
    date: "2026-07-25",
    day: "Sat Jul 25",
    venueName: "August Hall, S.F.",
    city: "San Francisco",
    address: null,
    artists: [
      { name: "Cab", genres: ["indie rock"] },
      { name: "Jady", genres: ["electronic"] },
    ],
    extra: "7:30pm · $39.30",
    time: "7:30pm",
    price: "$39.30",
    age: "5+",
    score: 0, // no match with punk
  },
  {
    date: "2026-07-26",
    day: "Sun Jul 26",
    venueName: "924 Gilman Street, Berkeley",
    city: "Berkeley",
    address: null,
    artists: [
      { name: "Spray", genres: ["hardcore punk"] },
      { name: "Torch", genres: ["metal"] },
      { name: "Open Wound", genres: ["punk"] },
    ],
    extra: "a/a · 7pm/8pm · $10",
    time: "7pm/8pm",
    price: "$10",
    age: "a/a",
    // spray: hardcore punk → hardcore, not punk (no match)
    // torch: metal (no match)
    // open wound: punk (match)
    score: 1,
  },
  {
    date: "2026-08-01",
    day: "Sat Aug 1",
    venueName: "The New Parish, Oakland",
    city: "Oakland",
    address: null,
    artists: [
      { name: "Helado Negro", genres: ["indie", "electronic"] },
    ],
    extra: "8pm · $25",
    time: "8pm",
    price: "$25",
    age: null,
    score: 0, // no match with punk
  },
  {
    date: "2026-08-15",
    day: "Sat Aug 15",
    venueName: "The Temple",
    city: null,
    address: null,
    artists: [
      { name: "Dust Collector", genres: ["noise", "experimental"] },
    ],
    extra: "10pm",
    time: "10pm",
    price: null,
    age: null,
    score: 0, // no match with punk
  },
];
