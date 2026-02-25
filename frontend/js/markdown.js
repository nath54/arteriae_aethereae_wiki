/**
 * Simple Markdown Parser for Arteriae Aethereae
 * Converts a subset of Markdown (bold, italic, links, images, newlines) to HTML.
 * Includes custom syntax for linking to internal entities: `[Name](type:id)`.
 *
 * HOOK POINT (New Markdown Rules): Add new regex replacements here
 * (e.g., custom tags for headers, lists, blockquotes, or spoilers).
 */
// Simple markdown parsing to HTML
window.parseMarkdown = function (mdText) {

    // If the text is empty, return an empty string
    if (!mdText) return "";

    // html will be the variable where will we transform the markdown until it is good
    let html = mdText;

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Headers (from # to ######)
    html = html.replace(/^###### (.*$)/gim, '<h6 style="margin-top: 0px;">$1</h6>');
    html = html.replace(/^##### (.*$)/gim, '<h5 style="margin-top: 0px;">$1</h5>');
    html = html.replace(/^#### (.*$)/gim, '<h4 style="margin-top: 0px;">$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3 style="margin-top: 0px;">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="margin-top: 0px;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="margin-top: 0px;">$1</h1>');

    // Horizontal Rule
    html = html.replace(/^\s*[-*_]{3,}\s*$/gim, '<hr>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Links formats
    // Explicit Name Link: [Name](entityType:entityId) -> e.g., [Aeron](character:char_aeron)
    html = html.replace(/\[(.*?)\]\((.*?):(.*?)\)/g, '<a href="#$2:$3" data-type="$2" data-id="$3">$1</a>');

    // Auto-resolved Link: [entityType:entityId] -> e.g., [character:char_aeron]
    html = html.replace(/\[(character|place|event|doc|map|documents|characters|places|events|maps):([^\]]+)\]/gi, function (match, type, id) {

        // Get the category
        let category = type.toLowerCase();

        // Pluralize/normalize if needed
        if (category === 'doc') category = 'documents';
        if (category === 'character') category = 'characters';
        if (category === 'place') category = 'places';
        if (category === 'event') category = 'events';
        if (category === 'map') category = 'maps';

        // use the id as the name, but we will try to find the entity name in the manifest
        let entityName = id;

        // Get the entity name from the manifest
        if (window.db && window.db.manifest && window.db.manifest[category]) {

            // Get the entity
            const entity = window.db.manifest[category][id];

            // If the entity is found, use the name
            if (entity && entity.name) {
                entityName = entity.name;
            }
        }

        // Single type name for data-type (singular mostly used in UI hash)
        let singleType = category.endsWith('s') ? category.slice(0, -1) : category;

        // Special case for documents
        if (category === 'documents') singleType = 'doc';

        // Return the link
        return `<a href="#${singleType}:${id}" data-type="${singleType}" data-id="${id}">${entityName}</a>`;
    });

    // Normal Web Links
    html = html.replace(/\[(.*?)\]\((http.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Images
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');

    // Unordered Lists
    html = html.replace(/^\s*[\-\*]\s+(.*)$/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, ''); // Join consecutive lists

    // Ensure each member of a list has a space before it
    html = html.replace(/<ul>/g, '<br>\n<ul>');

    // Blockquotes
    html = html.replace(/^\>\s+(.*)$/gim, '<blockquote>$1</blockquote>');
    html = html.replace(/<\/blockquote>\s*<blockquote>/g, '<br>'); // Join consecutive blockquotes

    // Transformation into Paragraphs
    // 1. Convert double newlines (or more) into paragraph boundaries
    html = html.replace(/\n\s*\n/g, '</p><p>');

    // 2. Wrap the whole content in p tags
    html = '<p>' + html + '</p>';

    // 3. "Unwrap" block-level elements from their <p> tags
    // This targets cases like <p><h1>...</h1></p> and makes them valid <h1>...</h1>
    const blockTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'pre', 'blockquote', 'hr', 'br'];
    blockTags.forEach(tag => {
        // Remove <p> from start of block tags (handling the user's potential <br> before some tags)
        const startRegex = new RegExp(`<p>(\\s*<br>)?(\\s*<${tag}>)`, 'gi');
        html = html.replace(startRegex, '$1$2');

        // Remove </p> from end of block tags
        const endRegex = new RegExp(`(</${tag}>|<${tag}[^>]*/>)\\s*</p>`, 'gi');
        html = html.replace(endRegex, '$1');
    });

    // 4. Handle remaining single newlines as line breaks
    html = html.replace(/\n/g, '<br>');

    // Add a <br> between all couple of closing / opening tags that don't have <br> between them
    html = html.replace(/<\/(\w+)><(\w+)>/g, '</$1><br><$2>');

    // Ensure we keep the document clean and without too much spaces
    while (html.includes('<br><br>')) {
        html = html.replace(/<br><br>/g, '<br>');
    }

    // Clean up empty paragraphs that might have been created
    html = html.replace(/<p>\s*<\/p>/g, '');

    // Trim the document
    html = html.trim();

    // Ensure the document doesn't starts nor finish with spaces
    while (html.startsWith('<br>')) {
        html = html.slice(4);
    }
    while (html.endsWith('<br>')) {
        html = html.slice(0, -4);
    }

    console.log(html);

    // Return the final html parsed document from markdown
    return html;
};
