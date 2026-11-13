import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

async function getDownload(page,button){
  const wait=page.waitForEvent('download');
  await button.click();
  const download=await wait;
  return {download,content:await readFile(await download.path(),'utf8')};
}

test('local workbench: analysis, evidence, export and responsive layout',async({page},testInfo)=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const done=[];
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang','en');
      await expect(page.locator('#source-count')).toHaveText('6');expect(Number(await page.locator('#citation-count').textContent())).toBeGreaterThan(0);
      const nodeCount=await page.locator('.map-node').count();await page.locator('#collapse').click();expect(await page.locator('.map-node').count()).toBeLessThan(nodeCount);await page.locator('#collapse').click();
      const exported=await getDownload(page,page.locator('#export'));const report=JSON.parse(exported.content);expect(report.sources).toHaveLength(6);
      await page.locator('#import-open').click();const invalid=structuredClone(report);invalid.sources[0].url='javascript:alert(1)';await page.locator('#import-text').fill(JSON.stringify(invalid));await page.locator('#import-apply').click();await expect(page.locator('#import-error')).toContainText('HTTP');
      await page.locator('#import-text').fill(exported.content);await page.locator('#import-apply').click();await expect(page.locator('#message')).toContainText('Imported 6');
      await page.locator('#demo').click();done.push('Six-source citation and overlap graph','Wording-family collapse','Real JSON report roundtrip','Unsafe source URL rejected');
  await page.screenshot({path:testInfo.outputPath('desktop.png'),fullPage:false});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:testInfo.outputPath('mobile.png'),fullPage:false});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);
  expect(errors).toEqual([]);
});
