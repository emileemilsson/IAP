// Simple replacement for the json2csv module which was a big chunk of the final bundle size
export function simplejson2csv(data : any[], fields: { label: string, value? : (v:any) => string | any }[]) {
    const escape = (val: any) => '"' + String(val).replace(/"/g, '""') + '"';

    let csv = fields.map(f => escape(f.label)).join(',');
    for(let row of data) {
        const toValue =  (val:any) => row[val];
        let rowData = [];
        for(let field of fields) {
            rowData.push(escape(field.value ? field.value(row) : toValue(row)));
        }

        csv += '\r\n' + rowData.join(',');
    }

    return csv;
}
