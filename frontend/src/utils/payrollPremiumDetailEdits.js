export function serializePremiumMetadata(metadataJson) {
    if (!metadataJson) return undefined;
    return typeof metadataJson === 'string' ? metadataJson : JSON.stringify(metadataJson);
}

export function buildPremiumDetailEdit({ existingEdit, editBase, metadataJson, amountToSave }) {
    const source = existingEdit || editBase;
    if (!source) return null;

    return {
        ...source,
        value: Number(amountToSave) || 0,
        metadata_json: serializePremiumMetadata(metadataJson)
    };
}
