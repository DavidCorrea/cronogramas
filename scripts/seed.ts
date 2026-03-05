/**
 * Large realistic seed: 50 users, 35 groups (10 solo, 10 jazz trios, 10 rock bands, 5 orchestras).
 *
 * - Slugs derived from group/artist names (slugify). Solo artist names inspired by popular Latin artists (slightly altered).
 * - Specified user (--user=UUID) + 49 seed users. Random ownership; specified user owns some groups, rest owned by others.
 * - Collaborators on a subset of groups; specified user is collaborator on at least one group they don't own.
 * - Schedule status: random draft/committed per schedule. User and member holidays (random). Varied availability.
 *
 * Optional: --seed=N for reproducible randomness.
 * Run: npm run seed -- --user=UUID   or   SEED_OWNER_ID=UUID npm run seed
 */

import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Normalize for slug: lowercase, replace spaces/dash with hyphen, strip accents. */
function slugify(name: string): string {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s–—]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return n || "grupo";
}

function parseOwnerId(): string {
  const argv = process.argv.slice(2);
  for (const arg of argv) {
    if (arg.startsWith("--user=")) {
      const id = arg.slice("--user=".length).trim();
      if (id) return id;
    }
  }
  if (argv[0] && !argv[0].startsWith("-")) {
    const id = argv[0].trim();
    if (id) return id;
  }
  const env = process.env.SEED_OWNER_ID?.trim();
  if (env) return env;
  console.error("Owner user ID required. Pass it via:");
  console.error("  --user=UUID");
  console.error("  SEED_OWNER_ID=UUID");
  console.error("  or as first argument: npx tsx scripts/seed.ts <UUID>");
  process.exit(1);
}

function parseSeed(): number {
  const argv = process.argv.slice(2);
  for (const arg of argv) {
    if (arg.startsWith("--seed=")) {
      const n = parseInt(arg.slice("--seed=".length).trim(), 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

/** Seeded PRNG (mulberry32) for reproducible randomness. */
function createRng(seed: number) {
  return function next(): number {
    seed = (seed + 0x6d2b79f5) | 0; // mulberry32
    const t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    return ((t + (t ^ (t >>> 7))) >>> 0) / 4294967296;
  };
}

/** Solo artist display names (inspired by popular Latin artists, slightly altered). */
const SOLO_ARTIST_NAMES: string[] = [
  "Rosalía Vega – Cantautora",
  "Benito Martínez – Solo",
  "Luna García – Artista",
  "José Álvarez – Reggaeton",
  "Carolina Gómez – Urbano",
  "Valentina Mebarak – Pop",
  "Carmen Rosales – Flamenco",
  "El Conejo – Trap",
  "Karina López – Cantante",
  "Balvin Martínez – Electrónico",
];

/** Jazz trio names. */
const JAZZ_TRIO_NAMES: string[] = [
  "Trío Jazz Los Andes",
  "Trío Norte",
  "Trío del Río",
  "Trío Luna Llena",
  "Trío Café con Leche",
  "Trío Noche Buena",
  "Trío Azul",
  "Trío Cielo",
  "Trío Sabor",
  "Trío Callejero",
];

/** Rock band names. */
const ROCK_BAND_NAMES: string[] = [
  "Los Leones del Sur",
  "Roca Negra",
  "Calle Sin Salida",
  "Los Hijos del Sol",
  "Noche y Día",
  "La Resistencia",
  "Viento Sur",
  "Los Descalzos",
  "Fuego Lento",
  "El Último Tren",
];

/** Orchestra names. */
const ORCHESTRA_NAMES: string[] = [
  "Orquesta Filarmónica de la Ciudad",
  "Orquesta Sinfónica del Valle",
  "Orquesta de Cámara del Este",
  "Orquesta Filarmónica Juvenil",
  "Orquesta Sinfónica Metropolitana",
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Use .env or .env.local.");
    process.exit(1);
  }

  const OWNER_USER_ID = parseOwnerId();
  const SEED_RNG = parseSeed();
  console.log("Seed owner user ID:", OWNER_USER_ID);
  if (SEED_RNG !== 0) console.log("RNG seed:", SEED_RNG);

  const rng = createRng(SEED_RNG);

  const { db } = await import("../src/lib/db");
  const {
    groups,
    groupCollaborators,
    users,
    weekdays,
    recurringEvents,
    exclusiveGroups,
    roles,
    members,
    memberRoles,
    memberAvailability,
    holidays,
    eventRolePriorities,
    schedules,
    scheduleDate,
    scheduleDateAssignments,
  } = await import("../src/db/schema");
  const { loadScheduleConfig, getPreviousAssignments } = await import("../src/lib/schedule-helpers");
  const { getScheduleDates, getDayNameFromDateString } = await import("../src/lib/dates");
  const { generateSchedule } = await import("../src/lib/scheduler");
  const { logScheduleAction } = await import("../src/lib/audit-log");
  const { eq, and } = await import("drizzle-orm");

  const ownerExists = (await db.select({ id: users.id }).from(users).where(eq(users.id, OWNER_USER_ID)))[0];
  if (!ownerExists) {
    console.warn(`User ${OWNER_USER_ID} not found. Groups will be created but you may not see them until this user exists.`);
  }

  // 49 seed users (fixed UUIDs and emails). userPool = [specified user, ...49] for ownership/collaborators.
  const SEED_USER_COUNT = 49;
  const seedUsers: Array<{ id: string; email: string; name: string }> = [];
  const firstNames = ["Luis", "Ana", "Leo", "Diana", "Martín", "Sandra", "Pedro", "Fernanda", "Lucas", "María", "Carlos", "Elena", "Miguel", "Patricia", "Ricardo", "Sofía", "Javier", "Laura", "Francisco", "Gloria", "Héctor", "Inés", "José", "Lucía", "Manuel", "Nuria", "Óscar", "Rosa", "Sergio", "Teresa", "Adriana", "Bruno", "Claudia", "David", "Eva", "Felipe", "Marina", "Nicolás", "Olga", "Pablo", "Raquel", "Alberto", "Berta", "Iván", "Julia", "Kevin", "Lorena", "Ximena", "Yago"];
  const lastNames = ["Bass", "Drums", "Méndez", "Cruz", "Ríos", "López", "Sánchez", "Vega", "Mora", "García", "López", "Martínez", "Hernández", "Gómez", "Vargas", "Castro", "Torres", "Díaz", "Reyes", "Mendoza", "Silva", "Vega", "Campos", "Ortega", "Ríos", "Delgado", "Cruz", "Marín", "Peña", "León", "Navarro", "Jiménez", "Ferrer", "Pascual", "Santana", "Iglesias", "Cortés", "Ponce", "Ramírez", "Escobar", "Blanco", "Rivas", "Quintana", "Barrera", "Cárdenas", "Duarte", "Esquivel", "Quintero", "Rangel"];
  for (let i = 0; i < SEED_USER_COUNT; i++) {
    const n = i + 1;
    const id = `a1b2c3d4-${String(n).padStart(4, "0")}-4000-8000-${String(n).padStart(12, "0")}`;
    const email = `seed-${String(n).padStart(3, "0")}@seed.example.com`;
    const name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
    seedUsers.push({ id, email, name });
  }
  for (const u of seedUsers) {
    const exists = (await db.select({ id: users.id }).from(users).where(eq(users.email, u.email)))[0];
    if (!exists) {
      await db.insert(users).values({ id: u.id, email: u.email, name: u.name });
      console.log("Created seed user:", u.email);
    }
  }
  const userPool: string[] = [OWNER_USER_ID, ...seedUsers.map((u) => u.id)];
  const seedUserIdByEmail = new Map(seedUsers.map((u) => [u.email, u.id]));

  const weekdayRows = await db.select().from(weekdays).orderBy(weekdays.displayOrder);
  const nameToWeekdayId = new Map(weekdayRows.map((w) => [w.name, w.id]));

  const existingSlugs = new Set((await db.select({ slug: groups.slug }).from(groups)).map((r) => r.slug ?? ""));
  function ensureUniqueSlug(baseName: string): string {
    const base = slugify(baseName);
    let slug = base;
    let n = 2;
    while (existingSlugs.has(slug)) {
      slug = `${base}-${n}`;
      n += 1;
    }
    existingSlugs.add(slug);
    return slug;
  }

  const now = new Date();
  const startYear = now.getUTCFullYear();
  const startMonth = now.getUTCMonth() + 1;

  function scheduleMonths(count: number): { month: number; year: number }[] {
    const out: { month: number; year: number }[] = [];
    for (let i = 0; i < count; i++) {
      let m = startMonth + i;
      let y = startYear;
      while (m > 12) {
        m -= 12;
        y += 1;
      }
      out.push({ month: m, year: y });
    }
    return out;
  }

  type EventSpec = { day: string; type: "assignable" | "for_everyone"; label: string; start: string; end: string };
  type RoleSpec = { name: string; requiredCount?: number; exclusiveGroupName?: string };
  type AvailabilityBlock = { start: string; end: string };
  type MemberSpec = {
    name: string;
    /** Creator's member: use OWNER_USER_ID (only for the member that represents the logged-in owner). */
    userId?: string;
    /** Link to a seed user by email (for simulating multiple users across groups). */
    seedUserEmail?: string;
    roleNames: string[];
    /** weekday name -> blocks (or full day if omitted) */
    availability?: Record<string, AvailabilityBlock[]>;
  };

  async function createGroup(opts: {
    name: string;
    slug: string;
    ownerId: string;
    specifiedUserId: string;
    getScheduleStatus: () => "draft" | "committed";
    events: EventSpec[];
    roles: RoleSpec[];
    members: MemberSpec[];
    exclusiveGroupNames?: string[];
    memberHolidays?: Array<{ memberIndex: number; start: string; end: string; description: string }>;
    userHolidays?: Array<{ start: string; end: string; description: string }>;
    monthsToCreate: number;
    maxOwnerSlotsPerMonth?: number;
  }) {
    const existing = (await db.select().from(groups).where(eq(groups.slug, opts.slug)))[0];
    if (existing) {
      console.log(`Group slug '${opts.slug}' already exists. Skipping.`);
      return null;
    }

    const [group] = await db
      .insert(groups)
      .values({ name: opts.name, slug: opts.slug, ownerId: opts.ownerId })
      .returning();
    if (!group) throw new Error(`Failed to create group ${opts.slug}`);
    const groupId = group.id;
    console.log("Created group:", group.name, "slug:", opts.slug);

    const exclusiveById = new Map<string, number>();
    if (opts.exclusiveGroupNames?.length) {
      for (const name of opts.exclusiveGroupNames) {
        const [ex] = await db.insert(exclusiveGroups).values({ name, groupId }).returning({ id: exclusiveGroups.id });
        if (ex) exclusiveById.set(name, ex.id);
      }
    }

    const recurringTypeByDay: Record<string, { type: string; label: string; recurringEventId: number; startTimeUtc: string; endTimeUtc: string }> = {};
    for (const ev of opts.events) {
      const weekdayId = nameToWeekdayId.get(ev.day);
      if (weekdayId == null) throw new Error(`Weekday not found: ${ev.day}`);
      const [inserted] = await db
        .insert(recurringEvents)
        .values({
          weekdayId,
          active: true,
          type: ev.type,
          label: ev.label,
          startTimeUtc: ev.start,
          endTimeUtc: ev.end,
          groupId,
        })
        .returning();
      if (inserted) {
        recurringTypeByDay[ev.day] = {
          type: ev.type,
          label: ev.label,
          recurringEventId: inserted.id,
          startTimeUtc: ev.start,
          endTimeUtc: ev.end,
        };
      }
    }

    const createdRoles: { id: number; name: string }[] = [];
    for (let i = 0; i < opts.roles.length; i++) {
      const r = opts.roles[i];
      const exclusiveGroupId = r.exclusiveGroupName ? exclusiveById.get(r.exclusiveGroupName) ?? null : null;
      const [row] = await db
        .insert(roles)
        .values({
          name: r.name,
          requiredCount: r.requiredCount ?? 1,
          displayOrder: i,
          groupId,
          exclusiveGroupId: exclusiveGroupId ?? undefined,
        })
        .returning({ id: roles.id, name: roles.name });
      if (row) createdRoles.push(row);
    }
    const roleIdByName = new Map(createdRoles.map((r) => [r.name, r.id]));

    const createdMembers: { id: number; name: string }[] = [];
    for (const m of opts.members) {
      const linkedUserId = m.userId ?? (m.seedUserEmail ? seedUserIdByEmail.get(m.seedUserEmail) ?? null : null);
      const [row] = await db
        .insert(members)
        .values({
          name: m.name,
          groupId,
          userId: linkedUserId,
        })
        .returning({ id: members.id, name: members.name });
      if (row) createdMembers.push(row);
    }

    for (const m of opts.members) {
      const member = createdMembers.find((c) => c.name === m.name);
      if (!member) continue;
      for (const roleName of m.roleNames) {
        const roleId = roleIdByName.get(roleName);
        if (roleId) await db.insert(memberRoles).values({ memberId: member.id, roleId });
      }
    }

    const defaultBlocks: Record<string, AvailabilityBlock[]> = {
      Lunes: [{ start: "00:00", end: "23:59" }],
      Martes: [{ start: "00:00", end: "23:59" }],
      Miércoles: [{ start: "00:00", end: "23:59" }],
      Jueves: [{ start: "00:00", end: "23:59" }],
      Viernes: [{ start: "00:00", end: "23:59" }],
      Sábado: [{ start: "00:00", end: "23:59" }],
      Domingo: [{ start: "00:00", end: "23:59" }],
    };
    for (let i = 0; i < opts.members.length; i++) {
      const m = opts.members[i];
      const member = createdMembers[i];
      if (!member) continue;
      const blocksByDay = m.availability ?? defaultBlocks;
      for (const [dayName, blocks] of Object.entries(blocksByDay)) {
        const weekdayId = nameToWeekdayId.get(dayName);
        if (weekdayId == null) continue;
        for (const block of blocks) {
          await db.insert(memberAvailability).values({
            memberId: member.id,
            weekdayId,
            startTimeUtc: block.start,
            endTimeUtc: block.end,
          });
        }
      }
    }

    if (opts.userHolidays) {
      for (const h of opts.userHolidays) {
        await db.insert(holidays).values({
          userId: opts.specifiedUserId,
          startDate: h.start,
          endDate: h.end,
          description: h.description,
        });
      }
    }
    if (opts.memberHolidays) {
      for (const h of opts.memberHolidays) {
        const member = createdMembers[h.memberIndex];
        if (member) {
          await db.insert(holidays).values({
            memberId: member.id,
            startDate: h.start,
            endDate: h.end,
            description: h.description,
          });
        }
      }
    }

    const assignableEventIds = Object.values(recurringTypeByDay)
      .filter((c) => c.type === "assignable")
      .map((c) => c.recurringEventId);
    for (const evId of assignableEventIds) {
      for (let i = 0; i < createdRoles.length; i++) {
        await db.insert(eventRolePriorities).values({
          recurringEventId: evId,
          roleId: createdRoles[i].id,
          priority: i,
        });
      }
    }

    const config = await loadScheduleConfig(groupId);
    let previousAssignments = await getPreviousAssignments(groupId);
    const ownerMemberIndex = opts.members.findIndex((m) => m.userId === opts.specifiedUserId);
    const ownerMember = ownerMemberIndex >= 0 ? createdMembers[ownerMemberIndex] : undefined;
    const ownerRoleIds = ownerMember
      ? new Set(
          (await db.select({ roleId: memberRoles.roleId }).from(memberRoles).where(eq(memberRoles.memberId, ownerMember.id))).map((r) => r.roleId)
        )
      : new Set<number>();
    const maxOwnerSlots = opts.maxOwnerSlotsPerMonth ?? 3;

    for (const { month, year } of scheduleMonths(opts.monthsToCreate)) {
      const existingSchedule = (await db
        .select()
        .from(schedules)
        .where(and(eq(schedules.groupId, groupId), eq(schedules.month, month), eq(schedules.year, year))))[0];
      if (existingSchedule) continue;

      const dates = getScheduleDates(month, year, config.activeDayNames);
      if (dates.length === 0) continue;

      const assignableDates = dates.filter(
        (d) => config.recurringTypeByDay[getDayNameFromDateString(d)]?.type === "assignable"
      );

      const result = generateSchedule({
        dates: assignableDates,
        roles: config.roleDefinitions,
        members: config.memberInfos,
        previousAssignments,
        dayRolePriorities: Object.keys(config.dayRolePriorityMap).length > 0 ? config.dayRolePriorityMap : undefined,
        dayEventTimeWindow: Object.keys(config.dayEventTimeWindow).length > 0 ? config.dayEventTimeWindow : undefined,
      });

      const [schedule] = await db
        .insert(schedules)
        .values({ month, year, status: opts.getScheduleStatus(), groupId })
        .returning();
      if (!schedule) continue;

      const dateIds = new Map<string, number>();
      for (const date of dates) {
        const dayName = getDayNameFromDateString(date);
        const info = config.recurringTypeByDay[dayName] ?? {
          type: "assignable",
          label: "Evento",
          recurringEventId: undefined,
          startTimeUtc: "00:00",
          endTimeUtc: "23:59",
        };
        const type = String(info.type).toLowerCase() === "for_everyone" ? "for_everyone" : "assignable";
        const [inserted] = await db
          .insert(scheduleDate)
          .values({
            scheduleId: schedule.id,
            date,
            type,
            label: info.label ?? null,
            note: null,
            startTimeUtc: info.startTimeUtc ?? "00:00",
            endTimeUtc: info.endTimeUtc ?? "23:59",
            recurringEventId: info.recurringEventId ?? null,
          })
          .returning({ id: scheduleDate.id });
        dateIds.set(date, inserted.id);
      }

      // Reserve assignment slots for the owner first so they get assigned; then fill the rest from the scheduler.
      const ownerSlotsToReserve = ownerMember ? Math.min(maxOwnerSlots, assignableDates.length) : 0;
      const ownerAssignments: { date: string; roleId: number; memberId: number }[] = [];
      if (ownerMember && ownerRoleIds.size > 0) {
        const ownerRoleIdList = [...ownerRoleIds];
        for (let i = 0; i < ownerSlotsToReserve; i++) {
          const date = assignableDates[i];
          if (!date) break;
          const roleId = ownerRoleIdList[i % ownerRoleIdList.length];
          ownerAssignments.push({ date, roleId, memberId: ownerMember.id });
        }
      }
      const ownerSlotKeys = new Set(ownerAssignments.map((a) => `${a.date}:${a.roleId}`));
      const remainingFromScheduler = result.assignments.filter((a) => {
        const key = `${a.date}:${a.roleId}`;
        if (ownerSlotKeys.has(key)) {
          ownerSlotKeys.delete(key);
          return false;
        }
        return true;
      });
      const allAssignments = [...ownerAssignments, ...remainingFromScheduler];

      for (const a of allAssignments) {
        const scheduleDateId = dateIds.get(a.date);
        if (!scheduleDateId) continue;
        await db.insert(scheduleDateAssignments).values({
          scheduleDateId,
          roleId: a.roleId,
          memberId: a.memberId,
        });
      }

      await logScheduleAction(
        schedule.id,
        opts.ownerId,
        "created",
        `Cronograma generado para ${MONTH_NAMES[month - 1]} ${year} (seed)`
      );
      previousAssignments = [...previousAssignments, ...allAssignments];
    }
    console.log("  ", opts.slug, "done.");
    return { slug: opts.slug, groupId, ownerId: opts.ownerId };
  }

  // User holidays: ~70% of users get 0–2 ranges; specified user gets at least 1.
  const HOLIDAY_RANGES = [
    { start: "2026-07-01", end: "2026-07-14", description: "Vacaciones" },
    { start: "2026-08-10", end: "2026-08-20", description: "Vacaciones" },
    { start: "2026-12-23", end: "2026-12-31", description: "Navidad" },
    { start: "2026-04-01", end: "2026-04-07", description: "Semana Santa" },
    { start: "2026-09-15", end: "2026-09-22", description: "Ausencia" },
  ];
  for (const userId of userPool) {
    const count = userId === OWNER_USER_ID ? (rng() < 0.5 ? 2 : 1) : (rng() < 0.7 ? (rng() < 0.5 ? 1 : 2) : 0);
    for (let i = 0; i < count; i++) {
      const h = HOLIDAY_RANGES[Math.floor(rng() * HOLIDAY_RANGES.length)];
      await db.insert(holidays).values({ userId, startDate: h.start, endDate: h.end, description: h.description });
    }
  }

  const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const fullDay = Object.fromEntries(WEEKDAYS.map((d) => [d, [{ start: "00:00", end: "23:59" }]]));
  const eveningOnly: Record<string, AvailabilityBlock[]> = {
    Lunes: [{ start: "18:00", end: "22:00" }],
    Martes: [{ start: "18:00", end: "22:00" }],
    Miércoles: [{ start: "18:00", end: "22:00" }],
    Jueves: [{ start: "18:00", end: "22:00" }],
    Viernes: [{ start: "18:00", end: "22:00" }],
    Sábado: [{ start: "10:00", end: "20:00" }],
    Domingo: [{ start: "10:00", end: "20:00" }],
  };
  const weekendOnly: Record<string, AvailabilityBlock[]> = {
    Sábado: [{ start: "10:00", end: "22:00" }],
    Domingo: [{ start: "10:00", end: "20:00" }],
  };
  const weekdaysOnly: Record<string, AvailabilityBlock[]> = {
    Lunes: [{ start: "19:00", end: "23:00" }],
    Miércoles: [{ start: "19:00", end: "23:00" }],
    Viernes: [{ start: "19:00", end: "23:00" }],
  };
  const availabilityPatterns = [fullDay, eveningOnly, weekendOnly, weekdaysOnly];

  function pickAvailability(): Record<string, AvailabilityBlock[]> {
    return availabilityPatterns[Math.floor(rng() * availabilityPatterns.length)];
  }

  function pickOwner(): string {
    return rng() < 0.3 ? OWNER_USER_ID : userPool[1 + Math.floor(rng() * SEED_USER_COUNT)];
  }

  const getScheduleStatus = (): "draft" | "committed" => (rng() < 0.5 ? "draft" : "committed");

  const createdGroups: Array<{ slug: string; groupId: number; ownerId: string }> = [];

  // —— 10 Solo artists ——
  for (let i = 0; i < 10; i++) {
    const name = SOLO_ARTIST_NAMES[i];
    const slug = ensureUniqueSlug(name);
    const ownerId = pickOwner();
    const memberName = name.split(" – ")[0] ?? name;
    const members: MemberSpec[] =
      ownerId === OWNER_USER_ID
        ? [
            {
              name: "Yo",
              userId: OWNER_USER_ID,
              roleNames: ["Artista"],
              availability: pickAvailability(),
            },
          ]
        : [
            {
              name: memberName,
              seedUserEmail: seedUsers[i % SEED_USER_COUNT].email,
              roleNames: ["Artista"],
              availability: pickAvailability(),
            },
          ];
    const days = ["Viernes", "Sábado"] as const;
    const day = days[Math.floor(rng() * 2)];
    const res = await createGroup({
      name,
      slug,
      ownerId,
      specifiedUserId: OWNER_USER_ID,
      getScheduleStatus,
      events: [{ day, type: "assignable", label: "Presentación", start: "19:00", end: "21:00" }],
      roles: [{ name: "Artista" }],
      members,
      userHolidays: ownerId === OWNER_USER_ID ? [{ start: "2026-07-01", end: "2026-07-14", description: "Vacaciones" }] : undefined,
      memberHolidays: rng() < 0.3 ? [{ memberIndex: 0, start: "2026-08-10", end: "2026-08-20", description: "Vacaciones" }] : undefined,
      monthsToCreate: 6,
      maxOwnerSlotsPerMonth: 1,
    });
    if (res) createdGroups.push(res);
  }

  // —— 10 Jazz trios ——
  const trioFirstNames = ["Luis", "Ana", "Pablo", "María", "Carlos", "Elena", "Miguel", "Laura", "José", "Sofía"];
  const trioLastNames = ["Bass", "Drums", "Keys", "García", "López", "Martínez", "Ruiz", "Díaz", "Torres", "Sánchez"];
  for (let i = 0; i < 10; i++) {
    const name = JAZZ_TRIO_NAMES[i];
    const slug = ensureUniqueSlug(name);
    const ownerId = pickOwner();
    const hasYo = ownerId === OWNER_USER_ID;
    const members: MemberSpec[] = [
      hasYo
        ? { name: "Yo", userId: OWNER_USER_ID, roleNames: ["Piano"], availability: pickAvailability() }
        : { name: `${trioFirstNames[i]} ${trioLastNames[0]}`, seedUserEmail: seedUsers[(i * 3) % SEED_USER_COUNT].email, roleNames: ["Piano"], availability: pickAvailability() },
      { name: `${trioFirstNames[(i + 1) % 10]} ${trioLastNames[1]}`, seedUserEmail: seedUsers[(i * 3 + 1) % SEED_USER_COUNT].email, roleNames: ["Contrabajo"], availability: pickAvailability() },
      { name: `${trioFirstNames[(i + 2) % 10]} ${trioLastNames[2]}`, seedUserEmail: seedUsers[(i * 3 + 2) % SEED_USER_COUNT].email, roleNames: ["Batería"], availability: pickAvailability() },
    ];
    const res = await createGroup({
      name,
      slug,
      ownerId,
      specifiedUserId: OWNER_USER_ID,
      getScheduleStatus,
      events: [
        { day: "Martes", type: "assignable", label: "Ensayo", start: "20:00", end: "22:00" },
        { day: "Jueves", type: "assignable", label: "Ensayo", start: "20:00", end: "22:00" },
      ],
      roles: [{ name: "Piano" }, { name: "Contrabajo" }, { name: "Batería" }],
      members,
      memberHolidays: rng() < 0.25 ? [{ memberIndex: Math.floor(rng() * 3), start: "2026-07-01", end: "2026-07-14", description: "Vacaciones" }] : undefined,
      monthsToCreate: 6,
      maxOwnerSlotsPerMonth: 2,
    });
    if (res) createdGroups.push(res);
  }

  // —— 10 Rock bands ——
  const rockFirstNames = ["Leo", "Sandra", "Martín", "Diana", "Pedro", "Fernanda", "Lucas", "Valeria", "Andrés", "Natalia"];
  const rockLastNames = ["Méndez", "López", "Ríos", "Cruz", "Sánchez", "Vega", "Mora", "Herrera", "Fuentes", "Rojas"];
  for (let i = 0; i < 10; i++) {
    const name = ROCK_BAND_NAMES[i];
    const slug = ensureUniqueSlug(name);
    const ownerId = pickOwner();
    const hasYo = ownerId === OWNER_USER_ID;
    const withTeclado = rng() < 0.4;
    const roles: RoleSpec[] = withTeclado
      ? [{ name: "Voz" }, { name: "Guitarra" }, { name: "Bajo" }, { name: "Batería" }, { name: "Teclado" }]
      : [{ name: "Voz" }, { name: "Guitarra" }, { name: "Bajo" }, { name: "Batería" }];
    const members: MemberSpec[] = [
      { name: `${rockFirstNames[i]} ${rockLastNames[0]}`, seedUserEmail: seedUsers[(i * 4) % SEED_USER_COUNT].email, roleNames: ["Voz"], availability: pickAvailability() },
      hasYo
        ? { name: "Yo", userId: OWNER_USER_ID, roleNames: ["Guitarra"], availability: pickAvailability() }
        : { name: `${rockFirstNames[(i + 1) % 10]} ${rockLastNames[1]}`, seedUserEmail: seedUsers[(i * 4 + 1) % SEED_USER_COUNT].email, roleNames: ["Guitarra"], availability: pickAvailability() },
      { name: `${rockFirstNames[(i + 2) % 10]} ${rockLastNames[2]}`, seedUserEmail: seedUsers[(i * 4 + 2) % SEED_USER_COUNT].email, roleNames: ["Bajo"], availability: pickAvailability() },
      { name: `${rockFirstNames[(i + 3) % 10]} ${rockLastNames[3]}`, roleNames: ["Batería"], availability: pickAvailability() },
    ];
    if (withTeclado) members.push({ name: `${rockFirstNames[(i + 4) % 10]} ${rockLastNames[4]}`, roleNames: ["Teclado"], availability: pickAvailability() });
    const res = await createGroup({
      name,
      slug,
      ownerId,
      specifiedUserId: OWNER_USER_ID,
      getScheduleStatus,
      events: [
        { day: "Miércoles", type: "assignable", label: "Ensayo", start: "19:00", end: "21:00" },
        { day: "Sábado", type: "assignable", label: "Ensayo", start: "17:00", end: "20:00" },
      ],
      roles,
      members,
      memberHolidays: rng() < 0.25 ? [{ memberIndex: Math.floor(rng() * members.length), start: "2026-08-10", end: "2026-08-20", description: "Vacaciones" }] : undefined,
      monthsToCreate: 6,
      maxOwnerSlotsPerMonth: 2,
    });
    if (res) createdGroups.push(res);
  }

  // —— 5 Orchestras ——
  const orchestraEvents: EventSpec[] = [
    { day: "Lunes", type: "assignable", label: "Ensayo cuerdas", start: "09:00", end: "12:00" },
    { day: "Martes", type: "for_everyone", label: "Reunión de junta", start: "10:00", end: "11:00" },
    { day: "Miércoles", type: "assignable", label: "Ensayo general", start: "18:00", end: "21:00" },
    { day: "Jueves", type: "assignable", label: "Ensayo general", start: "18:00", end: "21:00" },
    { day: "Viernes", type: "assignable", label: "Ensayo de concierto", start: "18:00", end: "20:00" },
    { day: "Sábado", type: "assignable", label: "Ensayo general", start: "10:00", end: "13:00" },
    { day: "Domingo", type: "assignable", label: "Concierto", start: "16:00", end: "19:00" },
  ];
  const orchestraRoles: RoleSpec[] = [
    { name: "Director", requiredCount: 1, exclusiveGroupName: "Dirección" },
    { name: "Concertino", requiredCount: 1, exclusiveGroupName: "Dirección" },
    { name: "Violín I", requiredCount: 6 },
    { name: "Violín II", requiredCount: 4 },
    { name: "Viola", requiredCount: 4 },
    { name: "Violonchelo", requiredCount: 4 },
    { name: "Contrabajo", requiredCount: 2 },
    { name: "Flauta", requiredCount: 2 },
    { name: "Clarinete", requiredCount: 2 },
    { name: "Trompeta", requiredCount: 2 },
    { name: "Percusión", requiredCount: 2 },
  ];
  const orchestraMemberNames = [
    "Ana García", "Carlos López", "Elena Martínez", "Fernando Ruiz", "Isabel Sánchez", "Javier Torres",
    "Laura Díaz", "Miguel Hernández", "Patricia Gómez", "Ricardo Vargas", "Sofía Castro", "Andrés Morales",
    "Beatriz Romero", "Daniel Soto", "Carmen Núñez", "Francisco Reyes", "Gloria Mendoza", "Héctor Silva",
    "Inés Vega", "José Campos", "Lucía Ortega", "Manuel Ríos", "Nuria Delgado", "Óscar Cruz",
    "Rosa Marín", "Sergio Peña", "Teresa León", "Adriana Navarro", "Bruno Jiménez", "Claudia Ferrer",
    "David Pascual", "Eva Santana", "Felipe Iglesias", "Marina Cortés", "Nicolás Ponce", "Olga Ramírez",
    "Pablo Escobar", "Raquel Blanco", "Alberto Rivas", "Berta Quintana", "Iván Barrera", "Julia Cárdenas",
  ];
  const orchestraBlocks: Record<string, AvailabilityBlock[]> = {
    Lunes: [{ start: "09:00", end: "12:00" }],
    Martes: [{ start: "10:00", end: "11:00" }],
    Miércoles: [{ start: "18:00", end: "21:00" }],
    Jueves: [{ start: "18:00", end: "21:00" }],
    Viernes: [{ start: "18:00", end: "20:00" }],
    Sábado: [{ start: "10:00", end: "13:00" }],
    Domingo: [{ start: "16:00", end: "19:00" }],
  };
  for (let i = 0; i < 5; i++) {
    const name = ORCHESTRA_NAMES[i];
    const slug = ensureUniqueSlug(name);
    const ownerId = pickOwner();
    const hasYo = ownerId === OWNER_USER_ID;
    const orchestraMemberSpecs: MemberSpec[] = [
      { name: "Arturo Mena", roleNames: ["Director"], availability: orchestraBlocks },
      { name: "Silvia Ramos", roleNames: ["Concertino"], availability: orchestraBlocks },
      ...orchestraMemberNames.slice(0, 6).map((n) => ({ name: n, roleNames: ["Violín I"] as string[], availability: orchestraBlocks })),
      ...orchestraMemberNames.slice(6, 10).map((n) => ({ name: n, roleNames: ["Violín II"] as string[], availability: orchestraBlocks })),
      ...orchestraMemberNames.slice(10, 14).map((n) => ({ name: n, roleNames: ["Viola"] as string[], availability: orchestraBlocks })),
      ...orchestraMemberNames.slice(14, 18).map((n) => ({ name: n, roleNames: ["Violonchelo"] as string[], availability: orchestraBlocks })),
      ...orchestraMemberNames.slice(18, 20).map((n) => ({ name: n, roleNames: ["Contrabajo"] as string[], availability: orchestraBlocks })),
      ...orchestraMemberNames.slice(20, 22).map((n) => ({ name: n, roleNames: ["Flauta"] as string[], availability: orchestraBlocks })),
      ...orchestraMemberNames.slice(22, 24).map((n) => ({ name: n, roleNames: ["Clarinete"] as string[], availability: orchestraBlocks })),
      ...orchestraMemberNames.slice(24, 26).map((n) => ({ name: n, roleNames: ["Trompeta"] as string[], availability: orchestraBlocks })),
      ...orchestraMemberNames.slice(26, 28).map((n) => ({ name: n, roleNames: ["Percusión"] as string[], availability: orchestraBlocks })),
    ];
    if (hasYo) {
      orchestraMemberSpecs.push({ name: "Yo", userId: OWNER_USER_ID, roleNames: ["Violín I", "Viola"], availability: orchestraBlocks });
    }
    const res = await createGroup({
      name,
      slug,
      ownerId,
      specifiedUserId: OWNER_USER_ID,
      getScheduleStatus,
      events: orchestraEvents,
      roles: orchestraRoles,
      members: orchestraMemberSpecs as MemberSpec[],
      exclusiveGroupNames: ["Dirección"],
      memberHolidays:
        rng() < 0.2
          ? [{ memberIndex: 2 + Math.floor(rng() * 10), start: "2026-07-01", end: "2026-07-14", description: "Vacaciones" }]
          : undefined,
      monthsToCreate: 12,
      maxOwnerSlotsPerMonth: 2,
    });
    if (res) createdGroups.push(res);
  }

  // —— Collaborators: random subset of groups get 1–2 collaborators; specified user is collaborator on at least one group they don't own.
  const groupsForCollab = createdGroups.filter((g) => g.ownerId !== OWNER_USER_ID);
  if (groupsForCollab.length > 0) {
    const target = groupsForCollab[Math.floor(rng() * groupsForCollab.length)];
    await db.insert(groupCollaborators).values({ userId: OWNER_USER_ID, groupId: target.groupId });
  }
  const numWithCollab = Math.min(createdGroups.length, 12 + Math.floor(rng() * 4));
  const shuffled = [...createdGroups].sort(() => rng() - 0.5);
  for (let i = 0; i < numWithCollab; i++) {
    const g = shuffled[i];
    if (!g) continue;
    const others = userPool.filter((u) => u !== g.ownerId);
    const nCollab = 1 + (rng() < 0.5 ? 1 : 0);
    for (let c = 0; c < nCollab; c++) {
      const uid = others[Math.floor(rng() * others.length)];
      if (!uid) continue;
      const exists = (await db.select().from(groupCollaborators).where(and(eq(groupCollaborators.groupId, g.groupId), eq(groupCollaborators.userId, uid))))[0];
      if (!exists) await db.insert(groupCollaborators).values({ userId: uid, groupId: g.groupId });
    }
  }

  console.log("Seed complete. Owner:", OWNER_USER_ID);
  console.log("Created", createdGroups.length, "groups. Slugs:", createdGroups.map((g) => g.slug).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
