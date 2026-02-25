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
    if (!mdText) return "";

    let html = mdText;

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Headers (from # to ######)
    html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
    html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

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
        let category = type.toLowerCase();
        // Pluralize/normalize if needed
        if (category === 'doc') category = 'documents';
        if (category === 'character') category = 'characters';
        if (category === 'place') category = 'places';
        if (category === 'event') category = 'events';
        if (category === 'map') category = 'maps';

        let entityName = id; // Fallback to ID if not found
        if (window.db && window.db.manifest && window.db.manifest[category]) {
            const entity = window.db.manifest[category][id];
            if (entity && entity.name) {
                entityName = entity.name;
            }
        }

        // Single type name for data-type (singular mostly used in UI hash)
        let singleType = category.endsWith('s') ? category.slice(0, -1) : category;
        if (category === 'documents') singleType = 'doc';

        return `<a href="#${singleType}:${id}" data-type="${singleType}" data-id="${id}">${entityName}</a>`;
    });

    // Normal Web Links
    html = html.replace(/\[(.*?)\]\((http.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Images
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');

    // Unordered Lists
    html = html.replace(/^\s*[\-\*]\s+(.*)$/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, ''); // Join consecutive lists

    // Blockquotes
    html = html.replace(/^\>\s+(.*)$/gim, '<blockquote>$1</blockquote>');
    html = html.replace(/<\/blockquote>\s*<blockquote>/g, '<br>'); // Join consecutive blockquotes

    // Newlines to br (only if not inside a block element)
    // First, let's handle double newlines as paragraphs if they aren't near tags
    html = html.replace(/\n\s*\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');

    return html;
};
