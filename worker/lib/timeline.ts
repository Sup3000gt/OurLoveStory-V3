import type {
  TimelinePhoto,
  TimelineResponse,
} from '../../shared/contracts';
import type { Env } from '../env';

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
