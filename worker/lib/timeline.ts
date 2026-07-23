import type {
  TimelineCoverInput,
  TimelinePhoto,
  TimelineResponse,
} from '../../shared/contracts';
import type { Env, OwnerIdentity } from '../env';
import { ValidationError } from './validation';

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export interface TimelinePhotoRow {
  memoryId: string;
  memoryTitle: string;
  memoryDate: string;
  memoryLocation: string;
  memoryCreatedAt: string;
  assetId: string;
  filename: string;
  sortOrder: number;
}

interface TimelinePhotoDatabaseRow {
  memory_id: string;
  memory_title: string;
  memory_date: string;
  memory_location: string;
  memory_created_at: string;
  asset_id: string;
  filename: string;
  sort_order: number;
}

interface ExplicitCoverDatabaseRow extends TimelinePhotoDatabaseRow {
  period_type: 'year' | 'month';
  period_key: string;
}

interface EligibleTimelineCoverRow {
  memory_id: string;
  memory_date: string;
}

export async function listTimeline(env: Env): Promise<TimelineResponse> {
  const [photosResult, coversResult] = await Promise.all([
    env.DB.prepare(`
      SELECT
        m.id AS memory_id,
        m.title AS memory_title,
        m.taken_at AS memory_date,
        m.location AS memory_location,
        m.created_at AS memory_created_at,
        a.id AS asset_id,
        a.original_filename AS filename,
        a.sort_order
      FROM memories m
      INNER JOIN media_assets a ON a.memory_id = m.id
      WHERE m.status = 'published'
        AND a.visibility = 'public'
        AND a.media_type = 'image'
    `).all<TimelinePhotoDatabaseRow>(),
    env.DB.prepare(`
      SELECT
        c.period_type,
        c.period_key,
        m.id AS memory_id,
        m.title AS memory_title,
        m.taken_at AS memory_date,
        m.location AS memory_location,
        m.created_at AS memory_created_at,
        a.id AS asset_id,
        a.original_filename AS filename,
        a.sort_order
      FROM timeline_covers c
      INNER JOIN memories m ON m.id = c.memory_id
      INNER JOIN media_assets a ON a.id = c.asset_id AND a.memory_id = m.id
      WHERE m.status = 'published'
        AND a.visibility = 'public'
        AND a.media_type = 'image'
    `).all<ExplicitCoverDatabaseRow>(),
  ]);

  const photos = photosResult.results.map(toPhotoRow);
  const explicitCovers = new Map(
    coversResult.results.map((row) => [
      `${row.period_type}:${row.period_key}`,
      toPhotoRow(row),
    ]),
  );
  const years = new Map<string, Map<string, TimelinePhotoRow[]>>();

  for (const photo of photos) {
    const year = photo.memoryDate.slice(0, 4);
    const month = photo.memoryDate.slice(0, 7);
    const months = years.get(year) ?? new Map<string, TimelinePhotoRow[]>();
    const monthPhotos = months.get(month) ?? [];
    monthPhotos.push(photo);
    months.set(month, monthPhotos);
    years.set(year, months);
  }

  return {
    years: [...years.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([year, months]) => {
        const yearPhotos = [...months.values()].flat();
        return {
          key: year,
          label: year,
          photoCount: yearPhotos.length,
          cover: selectTimelineCover(
            yearPhotos,
            explicitCovers.get(`year:${year}`) ?? null,
          ),
          months: [...months.entries()]
            .sort(([left], [right]) => right.localeCompare(left))
            .map(([month, monthPhotos]) => ({
              key: month,
              year,
              month: Number(month.slice(5, 7)),
              label: MONTH_LABELS[Number(month.slice(5, 7)) - 1]!,
              photoCount: monthPhotos.length,
              cover: selectTimelineCover(
                monthPhotos,
                explicitCovers.get(`month:${month}`) ?? null,
              ),
            })),
        };
      }),
  };
}

export async function setTimelineCover(
  env: Env,
  owner: OwnerIdentity,
  input: TimelineCoverInput,
): Promise<TimelineCoverInput> {
  const selected = await env.DB.prepare(`
    SELECT
      a.memory_id,
      m.taken_at AS memory_date
    FROM media_assets a
    INNER JOIN memories m ON m.id = a.memory_id
    WHERE a.id = ?
      AND a.media_type = 'image'
      AND a.visibility = 'public'
      AND m.status = 'published'
    LIMIT 1
  `).bind(input.assetId).first<EligibleTimelineCoverRow>();

  if (!selected || !matchesTimelinePeriod(
    selected.memory_date,
    input.periodType,
    input.periodKey,
  )) {
    throw new ValidationError(
      'Timeline cover must be a public image from a published memory in the selected period.',
    );
  }

  await env.DB.prepare(`
    INSERT INTO timeline_covers (
      id, period_type, period_key, memory_id, asset_id, created_by
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(period_type, period_key) DO UPDATE SET
      memory_id = excluded.memory_id,
      asset_id = excluded.asset_id,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    crypto.randomUUID(),
    input.periodType,
    input.periodKey,
    selected.memory_id,
    input.assetId,
    owner.userId,
  ).run();

  return input;
}

export async function clearTimelineCover(
  env: Env,
  periodType: TimelineCoverInput['periodType'],
  periodKey: string,
): Promise<void> {
  await env.DB.prepare(`
    DELETE FROM timeline_covers
    WHERE period_type = ? AND period_key = ?
  `).bind(periodType, periodKey).run();
}

export function selectTimelineCover(
  photos: TimelinePhotoRow[],
  explicitCover: TimelinePhotoRow | null,
): TimelinePhoto {
  const selected = explicitCover ?? [...photos].sort(compareTimelinePhotos)[0];
  if (!selected) throw new Error('Timeline period must contain an eligible photo.');

  return {
    memoryId: selected.memoryId,
    memoryTitle: selected.memoryTitle,
    memoryDate: selected.memoryDate,
    memoryLocation: selected.memoryLocation,
    assetId: selected.assetId,
    previewUrl: `/api/assets/${selected.assetId}/preview`,
    thumbnailUrl: `/api/assets/${selected.assetId}/thumbnail`,
    filename: selected.filename,
    isExplicitCover: explicitCover !== null,
  };
}

function compareTimelinePhotos(left: TimelinePhotoRow, right: TimelinePhotoRow): number {
  return right.memoryDate.localeCompare(left.memoryDate)
    || right.memoryCreatedAt.localeCompare(left.memoryCreatedAt)
    || left.sortOrder - right.sortOrder
    || left.assetId.localeCompare(right.assetId);
}

function toPhotoRow(row: TimelinePhotoDatabaseRow): TimelinePhotoRow {
  return {
    memoryId: row.memory_id,
    memoryTitle: row.memory_title,
    memoryDate: row.memory_date,
    memoryLocation: row.memory_location,
    memoryCreatedAt: row.memory_created_at,
    assetId: row.asset_id,
    filename: row.filename,
    sortOrder: row.sort_order,
  };
}

function matchesTimelinePeriod(
  date: string,
  periodType: TimelineCoverInput['periodType'],
  periodKey: string,
): boolean {
  return periodType === 'year'
    ? date.slice(0, 4) === periodKey
    : date.slice(0, 7) === periodKey;
}
