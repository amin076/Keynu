import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir){
  const out=[];
  for(const name of readdirSync(dir)){
    const full=join(dir,name);
    const st=statSync(full);
    if(st.isDirectory()) out.push(...walk(full));
    else if(full.endsWith('.ts')) out.push(full);
  }
  return out;
}

const patterns=[
  '.execute(',
  'runtime.execute(',
  'new Runtime(',
  'Runtime(',
  'execute(task',
  'execute(kap',
  'execute(payload',
  'kap.payload'
];

for(const file of walk('src')){
  const lines=readFileSync(file,'utf8').split(/\r?\n/);
  let printed=false;
  lines.forEach((line,index)=>{
    if(patterns.some(p=>line.includes(p))){
      if(!printed){
        console.log('\n===== '+file+' =====');
        printed=true;
      }
      const start=Math.max(0,index-3);
      const end=Math.min(lines.length,index+4);
      for(let i=start;i<end;i++){
        console.log(String(i+1).padStart(4,' ')+' | '+lines[i]);
      }
      console.log('');
    }
  });
}