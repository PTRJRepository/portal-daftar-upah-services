export function serializePremiumMetadata(metadataJson) {
    if (!metadataJson) return undefined;
    return typeof metadataJson === 'string' ? metadataJson : JSON.stringify(metadataJson);
}

export function buildPremiumDetailEdit({ existingEdit, editBase, metadataJson, amountToSave }) {
    const source = existingEdit || editBase;
    if (!source) return null;

    const nextEdit = {
        ...source,
        value: Number(amountToSave) || 0
    };

    const serializedMetadata = serializePremiumMetadata(metadataJson);
    if (serializedMetadata !== undefined) {
        nextEdit.metadata_json = serializedMetadata;
    } else if (existingEdit?.metadata_json) {
        nextEdit.metadata_json = existingEdit.metadata_json;
    }

    return nextEdit;
}
