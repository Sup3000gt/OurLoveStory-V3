import { describe, expect, it } from 'vitest';
import { resolveInitialLanguage, translate } from './translations';

describe('resolveInitialLanguage', () => {
  it('uses a stored language before the browser language', () => {
    expect(resolveInitialLanguage('en', 'zh-CN')).toBe('en');
    expect(resolveInitialLanguage('zh', 'en-US')).toBe('zh');
  });

  it('defaults Chinese browsers to Chinese and others to English', () => {
    expect(resolveInitialLanguage(null, 'zh-CN')).toBe('zh');
    expect(resolveInitialLanguage(null, 'en-US')).toBe('en');
  });
});

describe('translate', () => {
  it('returns natural Chinese interface copy', () => {
    expect(translate('zh', 'studio.publish')).toBe('保存这段回忆');
  });

  it('uses natural copy for destructive confirmation', () => {
    expect(translate('zh', 'detail.deleteConfirm')).toBe(
      '确定删除这张照片或视频吗？\n删除后无法恢复。',
    );
  });

  it('interpolates values in both languages', () => {
    expect(
      translate('zh', 'memory.assetSummary', { publicCount: 3, privateCount: 7 }),
    ).toBe('3 张公开 · 7 张仅我们可见');
    expect(
      translate('en', 'memory.assetSummary', { publicCount: 3, privateCount: 7 }),
    ).toBe('3 public · 7 private');
  });
});
