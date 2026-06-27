// builder script
const fs=require("fs");
const path=require("path");
const base=__dirname;
const target=path.join(base,"exploration-dependencies.json");
let d=JSON.parse(fs.readFileSync(target,"utf8"));
d.updated=true;
fs.writeFileSync(target,JSON.stringify(d,null,2));
console.log("OK");
