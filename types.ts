
export type EntityType = "Auto" | "Chemical" | "Protein" | "Gene";
export type OntologyType = "None" | "Gene Ontology" | "ChEBI" | "MeSH";

export type ApiProvider = 
  | "Gemini" 
  | "OpenAI" 
  | "Groq" 
  | "Anthropic" 
  | "Cohere" 
  | "Mistral AI"
  | "Perplexity"
  | "Together AI";

export interface EntityResult {
  "Input Entity": string;
  "Refined Entity Name": string;
  "Entity Type": string;
  "Resolved Name": string;
  "Validation Issues": string;
  "Pathways"?: string;
  "Function"?: string;
  "Cellular Component"?: string;
  "Ontology ID"?: string;
  "Ontology Term"?: string;
  "PubChem CID"?: string;
  "ChEMBL ID"?: string;
  "KEGG"?: string;
  "UniProt"?: string;
  "RefSeq"?: string;
  "Ensembl"?: string;
  "InterPro"?: string;
  "InChIKey"?: string;
  "SMILES"?: string;
  "PubChem Link"?: string;
  "ChEMBL Link"?: string;
  "KEGG Link"?: string;
  "UniProt Link"?: string;
  "RefSeq Link"?: string;
  "Ensembl Link"?: string;
  "InterPro Link"?: string;
  "Processing Time (s)"?: number;
}

export interface EntityResolutionResponse {
  corrected_name: string;
  entity_type: 'chemical' | 'protein' | 'gene' | 'unknown';
  synonyms: string[];
  resolved_name: string;
  validation_issues: string[];
  pathways: string[];
  biological_function: string[];
  cellular_component: string[];
  ontology_id?: string;
  ontology_term?: string;
  identifiers: {
    "PubChem CID"?: string;
    "ChEMBL ID"?: string;
    "KEGG"?: string;
    "UniProt"?: string;
    "RefSeq"?: string;
    "Ensembl"?: string;
    "InterPro"?: string;
    "InChIKey"?: string;
    "SMILES"?: string;
  };
  links: {
    "PubChem Link"?: string;
    "ChEMBL Link"?: string;
    "KEGG Link"?: string;
    "UniProt Link"?: string;
    "RefSeq Link"?: string;
    "Ensembl Link"?: string;
    "InterPro Link"?: string;
  };
}

export interface SessionState {
  entityList: string[];
  entityType: EntityType;
  backgroundInfo: string;
  ontology: OntologyType;
  results: EntityResult[];
  logs: string[];
  analysisPhase: string;
  apiProvider: ApiProvider;
  enableOntology: boolean;
  textAreaContent: string;
  fileName: string;
}
