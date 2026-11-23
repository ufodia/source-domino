import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

async function getDownload(page,button){
  const wait=page.waitForEvent('download');
  await button.click();
  const download=await wait;
  return {download,content:await readFile(await download.path(),'utf8')};
}

test('long documents show a short shared passage with its evidence',async({page})=>{
  const passage='The careful investigation found that every quoted source deserved a second independent';
  const left=Array.from({length:150},(_,i)=>`alpha${i} uniqueleft${i} uncommonleft${i}`).join(' ');
  const right=Array.from({length:150},(_,i)=>`beta${i} uniqueright${i} uncommonright${i}`).join(' ');
  const sources=[{id:'a',title:'First article',url:'https://first.example/',content:`${left} ${passage}`},{id:'b',title:'Second article',url:'https://second.example/',content:`${right} ${passage}`}];
  await page.goto('/');await page.locator('#import-open').click();
  await page.locator('#import-text').fill(JSON.stringify({sources}));await page.locator('#import-apply').click();
  await expect(page.locator('#family-count')).toHaveText('1');
  await expect(page.locator('#inspector-content')).toContainText('Shared 12-word passage (normalized)');
  await expect(page.locator('#inspector-content')).toContainText(passage.toLowerCase());
  await expect(page.locator('#inspector-content')).toContainText('Unique five-word phrase coverage:');
  await expect(page.locator('#inspector-content')).toContainText('This link is triggered by a shared 12-word passage');
  const exported=await getDownload(page,page.locator('#export'));
  expect(JSON.parse(exported.content).edges[0]).toMatchObject({basis:'passage',evidence:passage.toLowerCase()});
});

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

for(const closeMode of ['button','escape'])test(`closing a pending corpus import with ${closeMode} preserves the newer demo`,async({page})=>{
  await page.addInitScript(()=>{
    const original=File.prototype.text;
    File.prototype.text=async function(){
      if(this.name==='delayed.json')await new Promise(resolve=>{window.releaseImport=resolve;});
      const text=await original.call(this);window.importReadFinished=true;return text;
    };
  });
  await page.goto('/');await page.locator('#import-open').click();
  const sources=[1,2].map(i=>({id:`old-${i}`,url:`https://old.example/${i}`,title:`Old source ${i}`,content:'A pending corpus must not overwrite newer work.'}));
  await page.locator('#import-file').setInputFiles({name:'delayed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({sources}))});
  await expect.poll(()=>page.evaluate(()=>typeof window.releaseImport)).toBe('function');
  if(closeMode==='escape')await page.keyboard.press('Escape');
  else await page.getByRole('button',{name:'Close corpus import'}).click();
  await page.locator('#demo').click();
  await page.evaluate(()=>window.releaseImport());
  await expect.poll(()=>page.evaluate(()=>window.importReadFinished)).toBe(true);
  await expect(page.locator('#source-count')).toHaveText('6');
  await expect(page.locator('#corpus-label')).toHaveText('SYNTHETIC DEMO');
});


test('keyboard source selection retains focus and corpus dialogs have names',async({page})=>{
  await page.goto('/');
  const node=page.locator('#graph .map-node').nth(1);
  const source=await node.getAttribute('data-source');
  await node.focus();await page.keyboard.press('Enter');
  await expect(page.locator(`#graph .map-node[data-source="${source}"]`)).toBeFocused();
  const row=page.locator('.source-info').nth(2);
  const rowSource=await row.getAttribute('data-source');
  await row.focus();await page.keyboard.press('Enter');
  await expect(page.locator(`.source-info[data-source="${rowSource}"]`)).toBeFocused();
  await page.locator('#import-open').focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:'Bring your own corpus',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#import-open')).toBeFocused();
  await page.locator('#add').focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:'Add source',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#add')).toBeFocused();
});
