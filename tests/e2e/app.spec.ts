import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('가상 감상문 → 판정 → 프로파일 → 문장별 판정 → 판정 기준', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('샘플 모드')).toBeVisible();
  await page.getByRole('tab', { name: '판정 기준(온톨로지)' }).click();
  await expect(page.getByTestId('criteria')).toContainText('Indicator_지각_형식요소');
  await expect(page.getByTestId('criteria')).toContainText('Purves 100');
  await expect(page.getByTestId('criteria')).toContainText('오프닝 피구 장면에서 카메라는');

  await page.getByRole('button', { name: 'B', exact: true }).click();
  await expect(page.getByText('4문장으로 나뉩니다')).toBeVisible();
  await page.getByRole('button', { name: '판정하기' }).click();
  await expect(page.getByRole('heading', { name: '가상 감상문 B' })).toBeVisible();
  await expect(page.getByTestId('drawer-지각')).toHaveAttribute('data-open', 'true');
  await expect(page.getByTestId('quote-stats')).toContainText('문장에 없음 0');
  await page.screenshot({ path: 'test-results/01-profile.png', fullPage: true });
  const [png] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PNG' }).click()]);
  expect(readFileSync((await png.path())!).subarray(1, 4).toString()).toBe('PNG');

  await page.getByRole('tab', { name: '문장별 판정' }).click();
  await expect(page.getByTestId('row-S1').getByText('지각', { exact: true })).toBeVisible();
  await expect(page.getByTestId('row-S1').locator('mark')).toHaveText('카메라');
  await page.screenshot({ path: 'test-results/02-sentences.png', fullPage: true });

  // 다른 감상문 하나 더 — 열지 않은 서랍과 발문
  await page.getByRole('button', { name: 'A', exact: true }).click();
  await page.getByRole('button', { name: '판정하기' }).click();
  await expect(page.getByRole('heading', { name: '가상 감상문 A' })).toBeVisible();
  await expect(page.getByTestId('drawer-지각')).toHaveAttribute('data-open', 'false');
  await expect(page.getByTestId('next-prompts')).toContainText('오프닝 피구 장면에서 카메라는');
  await expect(page.getByRole('list', { name: '저장된 감상문' }).getByRole('listitem')).toHaveCount(2);
});

test('사람 판정 → 일치도(κ) → 두 평정자 합의 → 연구 자료 내보내기·가져오기', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'C', exact: true }).click();
  await page.getByRole('button', { name: '판정하기' }).click();
  await expect(page.getByRole('heading', { name: '가상 감상문 C' })).toBeVisible();

  await page.getByRole('tab', { name: '일치도' }).click();
  await expect(page.getByTestId('agreement')).toContainText('아직 사람 판정이 없습니다');

  // 연구자 판정: AI 판정이 가려진 채로
  await page.getByRole('tab', { name: '사람 판정' }).click();
  await expect(page.getByRole('columnheader', { name: 'AI' })).toHaveCount(0);
  const mine = ['해석', '해석', '해석', '향유·참여', '향유·참여'];
  for (let i = 0; i < mine.length; i++) await page.getByLabel(`S${i + 1} 주 차원`).selectOption(mine[i]);
  await page.getByLabel('S2 보조 차원').selectOption('이해');
  await expect(page.getByText('‘연구자’ 판정 5/5문장')).toBeVisible();
  await page.screenshot({ path: 'test-results/03-rating.png', fullPage: true });

  await page.getByRole('tab', { name: '일치도' }).click();
  await expect(page.getByTestId('observed')).toBeVisible();
  await expect(page.getByTestId('kappa')).toBeVisible();

  // 둘째 평정자
  await page.getByRole('tab', { name: '사람 판정' }).click();
  await page.getByLabel('새 평정자 이름').fill('교사 B');
  await page.getByRole('button', { name: '더하기' }).click();
  await expect(page.getByLabel('평정자', { exact: true })).toHaveValue('교사 B');
  const theirs = ['해석', '이해', '해석', '향유·참여', '향유·참여'];
  for (let i = 0; i < theirs.length; i++) await page.getByLabel(`S${i + 1} 주 차원`).selectOption(theirs[i]);
  await page.getByRole('tab', { name: '일치도' }).click();
  await page.getByLabel('비교 A').selectOption('연구자');
  await page.getByLabel('비교 B').selectOption('교사 B');
  await expect(page.getByTestId('observed')).toHaveText('80%');
  await page.getByLabel('비교 A').selectOption('AI(Gemini)');
  await page.getByLabel('비교 B').selectOption('사람 합의');
  await expect(page.getByTestId('agreement')).toContainText('비교한 문장');
  await expect(page.getByTestId('agreement').getByText('4', { exact: true }).first()).toBeVisible(); // 합의된 4문장
  await page.screenshot({ path: 'test-results/04-agreement.png', fullPage: true });

  // 내보내기 → 지우기 → 가져오기
  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'JSON 내보내기' }).click()]);
  const data = JSON.parse(readFileSync((await json.path())!, 'utf8'));
  expect(data.essays[0].ratings['교사 B'].S2.primary).toBe('이해');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV (엑셀)' }).click()]);
  expect(readFileSync((await csv.path())!, 'utf8')).toContain('교사 B 주 차원');
  await page.getByRole('button', { name: '가상 감상문 C 지우기' }).click();
  await expect(page.getByRole('heading', { name: '가상 감상문 C' })).toHaveCount(0);
  await page.getByLabel('연구 자료 가져오기').setInputFiles((await json.path())!);
  await expect(page.getByText('가져오기: 새 감상문 1편')).toBeVisible();
  await page.getByRole('button', { name: '가상 감상문 C', exact: true }).click();
  await page.getByRole('tab', { name: '사람 판정' }).click();
  await page.getByLabel('평정자', { exact: true }).selectOption('교사 B');
  await expect(page.getByLabel('S2 주 차원')).toHaveValue('이해');
});
