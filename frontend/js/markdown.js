// Simple markdown parsing to HTML
window.parseMarkdown = function (mdText) {
    if (!mdText) return "";

    // Bold
    let html = mdText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Links formats
    // Link to entity: [Name](entityType:entityId) -> e.g., [Aeron](character:char_aeron)
    html = html.replace(/\[(.*?)\]\((.*?):(.*?)\)/g, '<a href="#$2:$3" data-type="$2" data-id="$3">$1</a>');

    // Normal Web Links
    html = html.replace(/\[(.*?)\]\((http.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Images
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');

    // Newlines to br
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');

    return html;
};
