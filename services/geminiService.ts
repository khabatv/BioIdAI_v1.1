import { GoogleGenAI, Type } from "@google/genai";
import { EntityResolutionResponse, ApiProvider, OntologyType } from "../types";

// --- Resolution Implementation ---

const getResolutionClient = (apiKey?: string) => {
    // In Vite/Vercel, environment variables for the client must be prefixed with VITE_
    // We check both for maximum compatibility across environments
    const key = apiKey || (import.meta as any).env.VITE_API_KEY || (typeof process !== 'undefined' ? process.env.API_KEY : undefined);
    
    if (!key) {
        throw new Error("API key is not provided. Please set it in the settings or environment variables (VITE_API_KEY).");
    }
    return new GoogleGenAI({ apiKey: key });
};

const getResponseSchema = (ontology: OntologyType) => {
    const properties: any = {
        corrected_name: { type: Type.STRING, description: "The spell-corrected name of the entity." },
        entity_type: { type: Type.STRING, description: "The determined type: 'chemical', 'protein', 'gene', or 'unknown'." },
        synonyms: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of common synonyms." },
        resolved_name: { type: Type.STRING, description: "The most common or official name for the entity." },
        validation_issues: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of issues if entity cannot be found or identified." },
        pathways: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of biological pathways this entity is involved in." },
        biological_function: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of biological functions of this entity." },
        cellular_component: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of cellular components where this entity is found." },
        identifiers: {
            type: Type.OBJECT,
            properties: {
                "PubChem CID": { type: Type.STRING, nullable: true },
                "ChEMBL ID": { type: Type.STRING, nullable: true },
                "KEGG": { type: Type.STRING, nullable: true },
                "UniProt": { type: Type.STRING, nullable: true },
                "RefSeq": { type: Type.STRING, nullable: true },
                "Ensembl": { type: Type.STRING, nullable: true },
                "InterPro": { type: Type.STRING, nullable: true },
                "InChIKey": { type: Type.STRING, nullable: true },
                "SMILES": { type: Type.STRING, nullable: true },
                "Ontology ID": { type: Type.STRING, nullable: true },
                "Ontology Term": { type: Type.STRING, nullable: true },
            },
        },
        links: {
            type: Type.OBJECT,
            properties: {
                "PubChem Link": { type: Type.STRING, nullable: true },
                "ChEMBL Link": { type: Type.STRING, nullable: true },
                "KEGG Link": { type: Type.STRING, nullable: true },
                "UniProt Link": { type: Type.STRING, nullable: true },
                "RefSeq Link": { type: Type.STRING, nullable: true },
                "Ensembl Link": { type: Type.STRING, nullable: true },
                "InterPro Link": { type: Type.STRING, nullable: true },
            },
        }
    };

    const required = ["corrected_name", "entity_type", "synonyms", "resolved_name", "validation_issues", "pathways", "biological_function", "cellular_component", "identifiers", "links"];

    if (ontology !== 'None') {
        properties['ontology_id'] = { type: Type.STRING, nullable: true, description: `The primary ID from the ${ontology} database (e.g., GO:0008150, CHEBI:16236).` };
        properties['ontology_term'] = { type: Type.STRING, nullable: true, description: `The corresponding term name from ${ontology}.` };
        required.push('ontology_id', 'ontology_term');
    }
    
    return {
        type: Type.OBJECT,
        properties,
        required
    };
};

const callResolutionModel = async (prompt: string, apiKey: string | undefined, ontology: OntologyType, enableOntology: boolean): Promise<EntityResolutionResponse> => {
     try {
        const ai = getResolutionClient(apiKey);
        // Use Pro model only if ontology is enabled for higher accuracy, otherwise use Flash for speed
        const modelName = enableOntology ? 'gemini-3.1-pro-preview' : 'gemini-3-flash-preview';
        
        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: getResponseSchema(ontology),
                // Only use grounding if ontology is enabled, as it adds significant latency
                tools: enableOntology ? [{ googleSearch: {} }] : undefined
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as EntityResolutionResponse;
    } catch (error) {
        console.error("Error calling resolution model:", error);
        throw new Error(`Failed to get data from resolution model. Check console for details. Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
}

// --- Generic API Service ---

const createPrompt = (
    originalName: string,
    entityTypeHint: string,
    backgroundInfo: string,
    ontology: OntologyType,
    isDeepSearch: boolean,
    enableOntology: boolean
): string => {
    const ontologyInstruction = (ontology !== 'None' && enableOntology)
        ? `Additionally, find its corresponding term and ID from the ${ontology} database. You MUST provide the ${ontology} ID (in the 'ontology_id' field) and the official Term name (in the 'ontology_term' field). This is a critical requirement.`
        : 'Do not search for ontology terms or IDs.';
    
    if (isDeepSearch) {
        return `
        You are an expert research assistant performing a deep, exhaustive search for a biological or chemical entity. A previous quick search failed to find it. You must now try harder, using alternative search strategies.

        You MUST respond ONLY with a valid JSON object that conforms to the provided schema.

        Entity Name to Analyze: "${originalName}"
        User Provided Type Hint: "${entityTypeHint}"
        Additional Background Context: "${backgroundInfo || 'None provided.'}"

        Perform the following actions with maximum effort:
        1. The name "${originalName}" might be misspelled, an obscure synonym, or an abbreviation. Brainstorm and search for alternative spellings and related terms.
        2. Search across a WIDE range of databases. Do not give up easily. 
           - For chemicals: PubChem, ChEMBL, KEGG, DrugBank.
           - For proteins/genes/transcripts: UniProt, RefSeq, Ensembl, InterPro, NCBI Gene, HGNC.
        3. Find its biological pathways (e.g., "Glycolysis").
        4. Describe its biological function (e.g., "Enzyme catalysis").
        5. Identify its cellular component/location (e.g., "Mitochondrion").
        6. ${ontologyInstruction}
        7. Retrieve any standard identifiers and direct links you can find. For UniProt, RefSeq, Ensembl, and InterPro, provide both the ID and the direct URL link.
        8. If, after an exhaustive search, you still cannot find anything, populate 'validation_issues' with "Exhaustive search failed to find a match". Otherwise, provide as much information as you discovered.
        9. Ensure all identifiers are cross-referenced and validated against multiple sources where possible.

        Return your findings in the specified JSON format.
        `;
    }
    return `
    You are an expert chemist and biologist acting as a data aggregation service. Your task is to analyze a given entity name, correct it, and find its identifiers, pathways, function, and cellular location from scientific databases.

    You MUST respond ONLY with a valid JSON object that conforms to the provided schema. Do not include any explanatory text, markdown formatting, or anything outside the JSON object.

    Entity Name to Analyze: "${originalName}"
    User Provided Type Hint: "${entityTypeHint}"
    Additional Background Context: "${backgroundInfo || 'None provided.'}"

    Based on the entity name and context, perform the following actions:
    1. Correct any spelling errors in the entity name.
    2. Determine the entity's type (e.g., 'chemical', 'protein', 'gene'). Prioritize the user's hint but correct it if it's clearly wrong.
    3. Find common synonyms for the corrected name.
    4. Search relevant databases:
       - Chemicals: PubChem, ChEMBL, KEGG.
       - Proteins/Genes: UniProt, RefSeq, Ensembl, InterPro, NCBI Gene.
    5. Retrieve standard identifiers and direct links. For biological entities, you MUST prioritize finding UniProt, RefSeq, Ensembl, and InterPro IDs and their corresponding direct links.
    6. Find its biological pathways (e.g., "Glycolysis", "MAPK signaling pathway").
    7. Describe its biological function (e.g., "Enzyme catalysis", "Transcription factor").
    8. Identify its cellular component/location (e.g., "Mitochondrion", "Nucleus", "Cytoplasm").
    9. ${ontologyInstruction}
    10. If you cannot find the entity, populate 'validation_issues' with a descriptive message like "No definitive IDs found in any database". Otherwise, leave it as an empty array and fill the other fields.
    11. Ensure all data is sourced from high-quality, peer-reviewed databases and cross-validated.

    Return your findings in the specified JSON format.
    `;
};


export const fetchEntityInfo = async (
    provider: ApiProvider,
    apiKey: string,
    originalName: string,
    entityTypeHint: string,
    backgroundInfo: string,
    ontology: OntologyType,
    isDeepSearch: boolean,
    enableOntology: boolean
): Promise<EntityResolutionResponse> => {
    const schema = getResponseSchema(ontology);
    let finalPrompt = createPrompt(originalName, entityTypeHint, backgroundInfo, ontology, isDeepSearch, enableOntology);

    if (provider === "Gemini") {
        return callResolutionModel(finalPrompt, apiKey, ontology, enableOntology);
    }

    // For other providers, we must explicitly include the schema in the prompt
    finalPrompt += `\n\nYour response MUST be a JSON object following this schema:\n${JSON.stringify(schema, null, 2)}`;

    // Call backend proxy for other providers
    try {
        const response = await fetch("/api/ai/proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                provider,
                apiKey,
                prompt: finalPrompt,
                responseSchema: schema
            }),
        });

        const responseText = await response.text();
        
        if (!response.ok) {
            let errorMessage = `Server error: ${response.status}`;
            try {
                const errorData = JSON.parse(responseText);
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                // If not JSON, use the raw text or status
                errorMessage = responseText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        try {
            return JSON.parse(responseText) as EntityResolutionResponse;
        } catch (e) {
            console.error("Failed to parse response JSON:", responseText);
            throw new Error("The server returned an invalid response format. Please try again.");
        }
    } catch (error) {
        console.error(`Error calling ${provider} via proxy:`, error);
        throw error;
    }
};
