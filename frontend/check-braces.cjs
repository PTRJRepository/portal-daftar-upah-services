const fs=require('fs');
const t=fs.readFileSync('src/components/CustomPayrollTable.jsx','utf8');
const lines=t.split('\n');
let depth=0, paren=0, bracket=0;
for(let i=2737;i<2858;i++){
  const line=lines[i]||'';
  let stripped=line;
  // remove strings
  stripped=stripped.replace(/'(?:\\.|[^'\\])*'/g,"''");
  stripped=stripped.replace(/"(?:\\.|[^"\\])*"/g,'""');
  stripped=stripped.replace(/`(?:\\.|[^`\\])*`/g,'``');
  // remove // comments to end of line
  const cIdx=stripped.indexOf('//');
  if(cIdx>=0) stripped=stripped.slice(0,cIdx);
  for(const c of stripped){
    if(c==='{')depth++;
    else if(c==='}')depth--;
    else if(c==='(')paren++;
    else if(c===')')paren--;
    else if(c==='[')bracket++;
    else if(c===']')bracket--;
  }
  if(depth<0 || paren<0 || bracket<0) console.log('NEGATIVE at',i+1,'d=',depth,'p=',paren,'b=',bracket);
}
console.log('end 2857: depth=',depth,'paren=',paren,'bracket=',bracket);
