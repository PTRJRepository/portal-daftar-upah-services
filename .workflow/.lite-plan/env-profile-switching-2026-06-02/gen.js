const fs=require("fs");
const out=require("path").resolve(__dirname,"exploration-dependencies.json");
const d={task:"env-profile-switching",branch:"server-fix-1",date:"2026-06-02",mode:"dependency-map",status:"complete"};
fs.writeFileSync(out,JSON.stringify(d,null,2));
console.log("written "+out);
