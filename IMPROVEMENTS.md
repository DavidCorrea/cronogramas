# Improvements

Quality concerns noticed during work but out of scope at the time.

## Performance

### All 23 translation namespaces are sent to the client on every page

`src/app/layout.tsx` passes the whole `messages/es.json` (21.6 KB raw, ~6 KB
gzipped) to `NextIntlClientProvider`, so it is serialized into the RSC payload
of every route even though each page uses a handful of namespaces.

Left alone deliberately: 34 client components read translations across 12
routes, `NextIntlClientProvider` sits in the root layout shared by all of
them, and a namespace missed while subsetting surfaces as a broken
translation rather than a build error. The saving (~6 KB gzipped per
navigation) did not justify that risk without a per-route namespace map.

Worth revisiting if the message file grows substantially, ideally by deriving
the namespace list per route rather than maintaining it by hand.

### Admin lists scan whole tables

`loadAdminUsers` and `loadAdminGroups` (`src/lib/data-access.ts`) select every
user and run three unbounded `count()` aggregates over `members`, `schedules`
and `recurring_events`. Fine at the current size (50 users, 35 groups) and the
page is admin-only, but nothing bounds them as the data grows — they need
pagination before that matters.

### `revalidate` on the public schedule page has no effect

`src/app/(public)/[slug]/cronograma/[year]/[month]/page.tsx` sets `revalidate = 300`,
but the route renders dynamically (confirmed as `ƒ` in the build output)
because the root layout reads request headers via next-intl. The page shell is
therefore re-rendered per request; what actually provides the caching is the
`unstable_cache` wrapper in `src/lib/public-schedule.ts`.

This is not a correctness problem, but the `revalidate` export reads as if the
page were ISR when it is not. Making it genuinely static would mean moving the
locale provider out of the root layout so the public route does not depend on
request headers.

### Two effects derive state from props on the schedules page

`SchedulesPageClient` (`src/app/(app)/[slug]/config/schedules/`) seeds `orderedRoles`
and `selectedMonths` in `useEffect`, which costs a guaranteed second render on
mount. They were left as they are because the effects also re-sync when the
roles change and feed the unsaved-reorder tracking, so converting them to
`useState` initializers risks resetting a user's in-progress role ordering for
a saving of one render.
