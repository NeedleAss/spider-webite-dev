// Run through playwright-cli run-code (see tools/run_browser_check.py).
async (page) => {
 const browser=page.context().browser();
 const context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:'output/playwright/v6/console-recording',size:{width:1440,height:960}}});
 const p=await context.newPage();await p.goto('http://127.0.0.1:8765/?transport=mock&video=canvas');
 await p.waitForTimeout(1500);await p.locator('#modeBar [data-mode="MANUAL"]').click();await p.waitForTimeout(1500);
 const pad=await p.locator('#joystick').boundingBox();await p.mouse.move(pad.x+pad.width/2,pad.y+pad.height/2);await p.mouse.down();await p.mouse.move(pad.x+pad.width/2,pad.y+pad.height*.22,{steps:12});await p.waitForTimeout(2000);await p.mouse.up();
 await p.waitForTimeout(1700);await p.locator('#rotR').dispatchEvent('pointerdown',{pointerId:2});await p.waitForTimeout(1000);await p.locator('#rotR').dispatchEvent('pointerup',{pointerId:2});
 await p.waitForTimeout(2200);await p.locator('#modeBar [data-mode="IDLE"]').click();await p.waitForTimeout(2500);
 const path=await p.video().path();await context.close();return {path};
}
