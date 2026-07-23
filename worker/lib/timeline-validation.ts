import {
  requiredRecord,
  requiredString,
  ValidationError,
} from './validation';
import type {
  TimelineCoverInput,
  TimelinePeriodType,
} from '../../shared/contracts';

const YEAR_KEY = /^\d{4}$/;
const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export { ValidationError };

export function parseTimelineCoverInput(
  value: unknown,
): TimelineCoverInput {
  const record = requiredRecord(value, 'Timeline cover data');
  const periodType = record.periodType;
  if (periodType !== 'year' && periodType !== 'month') {
    throw new ValidationError(
      'Period type must be year or month.',
    );
  }

  if (typeof record.periodKey !== 'string') {
    throw new ValidationError('Period key is required.');
  }
  const periodKey = record.periodKey;
  if (
    (periodType === 'year' && !YEAR_KEY.test(periodKey))
    || (periodType === 'month' && !MONTH_KEY.test(periodKey))
  ) {
    throw new ValidationError(
      periodType === 'year'
        ? 'Year period key must use YYYY format.'
        : 'Month period key must use YYYY-MM format with a month from 01 to 12.',
    );
  }

  return {
    periodType: periodType as TimelinePeriodType,
    periodKey,
    assetId: requiredString(record.assetId, 'Asset id', 255),
  };
}
