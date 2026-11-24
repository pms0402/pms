import {chromium,webkit} from 'playwright';
export const engine=process.env.BROWSER_ENGINE||'chromium';
export async function launchBrowser(){return engine==='webkit'?webkit.launch(process.env.WEBKIT_PATH?{executablePath:process.env.WEBKIT_PATH}:{}):chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});}
export async function launchPersistentContext(dir,options){return engine==='webkit'?webkit.launchPersistentContext(dir,{...options,...(process.env.WEBKIT_PATH?{executablePath:process.env.WEBKIT_PATH}:{})}):chromium.launchPersistentContext(dir,{...options,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});}
