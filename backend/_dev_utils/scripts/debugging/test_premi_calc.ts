// Test apakah premi_brondol masuk ke dynamicPremiList
const totals = {
    premi_brondol: 3780000,
    premi_pruning: 45385850,
    premi_kinerja: 2359545,
    premi_tiket: 2192107,
    premi_insentif_panen: 1584350,
    premi_angkut: 146995,
    premi_circle_raking: 15408000,
    premi_tbs: 4065691,
    total_premi: 74922538,
};

const premiTitleMap = {
    premi_brondol: 'PREMI BRONDOL',
    premi_pruning: 'PREMI PRUNING',
};

const excludePatterns = ['premi_pph', 'premi_koreksi', 'total_premi'];
const dynamicPremiList: any[] = [];

for (const [key, value] of Object.entries(totals)) {
    if (key.startsWith('premi_') && (value as number) > 0) {
        if (excludePatterns.includes(key)) continue;
        const header = premiTitleMap[key] || key.replace('premi_', '').toUpperCase();
        dynamicPremiList.push({
            header: header,
            total: value
        });
    }
}

console.log('dynamicPremiList:');
dynamicPremiList.forEach(item => {
    console.log(`  ${item.header}: ${item.total.toLocaleString('id-ID')}`);
});

const totalPremi = dynamicPremiList.reduce((sum, item) => sum + (item.total || 0), 0);
console.log(`\ntotalPremi from dynamicPremiList: ${totalPremi.toLocaleString('id-ID')}`);
console.log(`total_premi from totals: ${totals.total_premi.toLocaleString('id-ID')}`);
console.log(`Difference: ${(totals.total_premi - totalPremi).toLocaleString('id-ID')}`);

const brondolInDynamic = dynamicPremiList.find(item => 
    item.header.toLowerCase().includes('brondol')
);
console.log(`\nbrondol in dynamicPremiList: ${brondolInDynamic ? 'YES' : 'NO'}`);
