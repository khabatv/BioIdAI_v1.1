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
        Expert research assistant: Exhaustive search for biological/chemical entity.
        Entity: "${originalName}" | Hint: "${entityTypeHint}" | Context: "${backgroundInfo || 'None'}"
        
        Actions:
        1. Correct spelling, brainstorm synonyms/abbreviations.
        2. Search: PubChem, ChEMBL, KEGG, UniProt, RefSeq, Ensembl, InterPro.
        3. Find: Pathways, Function, Cellular Component.
        4. ${ontologyInstruction}
        5. Provide IDs and direct URLs for UniProt, RefSeq, Ensembl, InterPro.
        6. If not found, set 'validation_issues' to "Exhaustive search failed".
        
        JSON ONLY.
        `;
    }
    return `
    Expert chemist/biologist: Analyze entity, find identifiers and biological data.
    Entity: "${originalName}" | Hint: "${entityTypeHint}" | Context: "${backgroundInfo || 'None'}"
    
    Actions:
    1. Correct spelling, determine type (chemical/protein/gene).
    2. Find synonyms.
    3. Search: PubChem, ChEMBL, KEGG, UniProt, RefSeq, Ensembl, InterPro.
    4. Provide IDs and direct URLs for UniProt, RefSeq, Ensembl, InterPro.
    5. Find: Pathways, Function, Cellular Component.
    6. ${ontologyInstruction}
    7. If not found, set 'validation_issues' to "No definitive IDs found".
    
    JSON ONLY.
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
