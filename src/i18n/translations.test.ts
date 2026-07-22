import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  resolveInitialLanguage,
  translate,
} from './translations';

describe('resolveInitialLanguage', () => {
  it('uses a stored language before the browser language', () => {
    expect(
      resolveInitialLanguage(
        'en',
        'zh-CN',
      ),
    ).toBe('en');

    expect(
      resolveInitialLanguage(
        'zh',
        'en-US',
      ),
    ).toBe('zh');
  });

  it('defaults Chinese browsers to Chinese and others to English', () => {
    expect(
      resolveInitialLanguage(
        null,
        'zh-CN',
      ),
    ).toBe('zh');

    expect(
      resolveInitialLanguage(
        null,
        'en-US',
      ),
    ).toBe('en');
  });
});

describe('translate', () => {
  it('returns natural Chinese interface copy', () => {
    expect(
      translate(
        'zh',
        'studio.publish',
      ),
    ).toBe('保存这段回忆');
  });

  it('uses natural copy for destructive confirmation', () => {
    expect(
      translate(
        'zh',
        'detail.deleteConfirm',
      ),
    ).toBe(
      '确定删除这张照片或视频吗？\n删除后无法恢复。',
    );
  });

  it('uses natural retry copy for unstable mobile connections', () => {
    expect(
      translate(
        'zh',
        'studio.retryingUpload',
        {
          filename:
            'IMG_1001.JPG',
          retry: 2,
          maxRetries: 3,
        },
      ),
    ).toBe(
      '网络有点不稳，正在重试 IMG_1001.JPG（2/3）…',
    );
  });

  it('interpolates values in both languages', () => {
    expect(
      translate(
        'zh',
        'memory.assetSummary',
        {
          publicCount: 3,
          privateCount: 7,
        },
      ),
    ).toBe(
      '3 张公开 · 7 张仅我们可见',
    );

    expect(
      translate(
        'en',
        'memory.assetSummary',
        {
          publicCount: 3,
          privateCount: 7,
        },
      ),
    ).toBe(
      '3 public · 7 private',
    );
  });

  it('translates the complete Phase 2B workflow and statuses', () => {
    expect(
      translate(
        'en',
        'upload.activeSessions',
      ),
    ).toBe(
      'Unfinished photo uploads',
    );

    expect(
      translate(
        'zh',
        'upload.activeSessions',
      ),
    ).toBe(
      '还没完成的照片上传',
    );

    expect(
      translate(
        'en',
        'upload.progressCount',
        {
          completed: 4,
          total: 10,
        },
      ),
    ).toBe(
      '4/10 complete',
    );

    expect(
      translate(
        'zh',
        'upload.progressCount',
        {
          completed: 4,
          total: 10,
        },
      ),
    ).toBe(
      '已完成 4/10',
    );

    expect(
      translate(
        'en',
        'upload.reviewStatusPending',
      ),
    ).toBe('Pending');

    expect(
      translate(
        'zh',
        'upload.reviewStatusFailed',
      ),
    ).toBe('上传失败');

    expect(
      translate(
        'en',
        'upload.abandonConfirm',
      ),
    ).toContain('\n');
  });

  it('translates optimized image controls in both languages', () => {
    expect(translate('en', 'image.unavailable')).toBe('This image is unavailable.');
    expect(translate('en', 'image.retry')).toBe('Retry');
    expect(translate('en', 'image.close')).toBe('Close image');
    expect(translate('en', 'image.previous')).toBe('Previous image');
    expect(translate('en', 'image.next')).toBe('Next image');
    expect(translate('zh', 'image.retry')).toBe('重试');
  });
});
