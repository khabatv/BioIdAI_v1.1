import { EntityResult } from '../types';

export const generateAndDownloadCsv = (data: EntityResult[], filename: string): void => {
  if (data.length === 0) {
    console.warn("No data to generate CSV.");
    return;
  }

  const hasOntology = data.some(r => r["Ontology Term"] || r["Ontology ID"]);

  const headers: (keyof EntityResult)[] = [
    "Input Entity", "Refined Entity Name", "Entity Type", "Resolved Name", "Validation Issues",
    "Pathways", "Function", "Cellular Component",
    ...(hasOntology ? ["Ontology ID", "Ontology Term"] as (keyof EntityResult)[] : []),
    "PubChem CID", "ChEMBL ID", "KEGG", "UniProt", "RefSeq", "Ensembl", "InterPro",
    "InChIKey", "SMILES",
    "PubChem Link", "ChEMBL Link", "KEGG Link", "UniProt Link", "RefSeq Link", "Ensembl Link", "InterPro Link",
    "Processing Time (s)"
  ];

  const csvRows: string[] = [];
  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header] ?? ''; // Use nullish coalescing for undefined/null
      const escaped = ('' + value).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
