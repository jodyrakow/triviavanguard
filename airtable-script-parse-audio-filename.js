// Get the input configuration from the trigger
let inputConfig = input.config();

// Get the Audio table
let table = base.getTable("Audio");

// Fetch the record that triggered the automation
let record = await table.selectRecordAsync(inputConfig.recordId);

// Get the Type field value - handle if it's a select field
let typeField = record.getCellValue("Type");
let type = null;

// Extract the actual value depending on field type
if (typeField) {
    if (typeof typeField === 'string') {
        type = typeField;
    } else if (typeField.name) {
        // Single select field
        type = typeField.name;
    } else if (Array.isArray(typeField) && typeField.length > 0) {
        // Multi-select or linked record
        type = typeField[0].name;
    }
}

console.log(`Type field value: "${type}"`);

// Get the formula field value (it's a string)
let audioFileText = record.getCellValue("Audio file name - long");

console.log(`Audio file text: "${audioFileText}"`);

if (!audioFileText) {
    console.log("No value in 'Audio file name - long' field");
    return;
}

// Extract just the filename part (everything before " (http")
// Example: "The Purple People Eater - Sheb Wooley.mp3 (https://...)"
let match = audioFileText.match(/^(.+?\.mp3)\s*\(/i);
let filename = null;

if (match) {
    filename = match[1].trim();
} else {
    // Fallback: maybe there's no URL, just the filename
    filename = audioFileText.replace(/\.mp3.*$/i, '.mp3');
}

console.log(`Extracted filename: "${filename}"`);

if (!filename) {
    console.log("ERROR: Could not extract filename");
    return;
}

// Remove the .mp3 extension
let nameWithoutExtension = filename.replace(/\.mp3$/i, '');

console.log(`Name without extension: "${nameWithoutExtension}"`);

// Process based on Type
if (type === "song") {
    // Split by " - " to separate title and artist
    let parts = nameWithoutExtension.split(' - ');

    if (parts.length >= 2) {
        let title = parts[0].trim();
        let artist = parts.slice(1).join(' - ').trim();

        console.log(`Parsed - Title: "${title}", Artist: "${artist}"`);

        // Update the record with the parsed values
        await table.updateRecordAsync(inputConfig.recordId, {
            "Title": title,
            "Artist": artist,
            "Audio name": nameWithoutExtension
        });

        console.log(`✓ Successfully updated record (song)`);
    } else {
        console.log(`Could not parse filename: "${filename}" (no " - " separator found)`);
    }
} else {
    // For non-song types, just use the filename
    console.log(`Type is "${type}", not "song". Using filename as Audio name.`);

    await table.updateRecordAsync(inputConfig.recordId, {
        "Audio name": nameWithoutExtension
    });

    console.log(`✓ Successfully updated record (non-song)`);
}
