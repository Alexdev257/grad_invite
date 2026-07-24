import puppeteer from "puppeteer-core";
const CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const b=await puppeteer.launch({executablePath:CH,headless:"new",args:["--no-sandbox","--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist","--window-size=1440,900"]});
const p=await b.newPage(); await p.setViewport({width:1440,height:900});
await p.goto("http://localhost:3000/?name=Nguy%E1%BB%85n%20V%C4%83n%20An&stage=diploma",{waitUntil:"domcontentloaded",timeout:60000});
let ok=false;
for(let i=0;i<200;i++){
  const has=await p.evaluate(()=>document.querySelector('.diploma')?.classList.contains('show'));
  if(has){ ok=true; break; }
  await new Promise(r=>setTimeout(r,150));
}
if(ok){
  await new Promise(r=>setTimeout(r,1400)); // chờ phóng xong (transform 0.9s)
  const rect=await p.evaluate(()=>{const d=document.querySelector('.diploma');const r=d.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),op:getComputedStyle(d).opacity};});
  await p.screenshot({path:"/tmp/grad_shots/diploma_full.png"});
  console.log("captured", JSON.stringify(rect));
} else console.log("show class never appeared");
await b.close();
