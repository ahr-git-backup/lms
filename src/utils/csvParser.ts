
// Basic CSV Parser
export const parseCSV = (csvText: string) => {
  const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i];
    // Handle quotes: Split by comma but respect quotes
    const values: string[] = [];
    let currentVal = '';
    let insideQuote = false;

    for (const char of currentLine) {
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        values.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim());

    if (values.length > 0) {
      const obj: any = {};
      headers.forEach((header, index) => {
        // Strip quotes if they exist around the value
        let val = values[index] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1);
        }
        // Handle "" as escaped quote inside quoted string (basic handling)
        val = val.replace(/""/g, '"');
        obj[header] = val;
      });
      result.push(obj);
    }
  }
  return result;
};
