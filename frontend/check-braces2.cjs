const fs=require('fs');
const t=fs.readFileSync('src/components/CustomPayrollTable.jsx','utf8');
const lines=t.split('\n');
let depth=0, paren=0, bracket=0;
for(let i=2737;i<2858;i++){
  const line=lines[i]||'';
  let stripped=line;
  stripped=stripped.replace(/'(?:\\.|[^'\\])*'/g,"''");
  stripped=stripped.replace(/"(?:\\.|[^"\\])*"/g,'""');
  stripped=stripped.replace(/`(?:\\.|[^`\\])*`/g,'``');
  const cIdx=stripped.indexOf('//');
  if(cIdx>=0) stripped=stripped.slice(0,cIdx);
  for(let j=0;j<stripped.length;j++){
    const c=stripped[j];
    if(c==='{')depth++;
    else if(c==='}')depth--;
    else if(c==='(')paren++;
    else if(c===')')paren--;
    else if(c==='[')bracket++;
    else if(c===']')bracket--;
    if(bracket<0){
      console.log('Bracket went negative at line',i+1,'col',j+1,'"',line,'"');
      process.exit(0);
    }
  }
}
console.log('end 2857: depth=',depth,'paren=',paren,'bracket=',bracket);
