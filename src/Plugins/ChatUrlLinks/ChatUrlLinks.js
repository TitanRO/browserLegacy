/**
 * ChatUrlLinks Plugin (TitanRO)
 *
 * Renders <URL>label<INFO>url</INFO></URL> in chat as a link opening the URL in a new tab, as clients from 2018-10-24
 * open it in the default browser. The server writes this tag with clif_format_url (e.g. the quickstart plugin's
 * @quickinvite link); without the plugin the chat shows the raw tags.
 *
 * It wraps ChatBox.messageToHTML (received lines, whispers, the whisper window) and ChatBox.addText (which renders a
 * line as HTML only when it holds an item link), so ChatBox itself is unchanged. Players can type the tag too: only
 * http(s) URLs become links, and the link's title shows where it goes; any other link shows its label as text.
 *
 * Config.local.js: plugins: { ChatUrlLinks: 'ChatUrlLinks/ChatUrlLinks' }
 *
 * @author Trojal
 */

import ChatBox from 'UI/Components/ChatBox/ChatBox.js';

const URL_TAG = /(<URL>.*?<\/URL>)/i;
const URL_PARTS = /^<URL>([\s\S]*?)<INFO>([\s\S]*?)<\/INFO><\/URL>$/i;

/**
 * HTML for one <URL>...</URL> tag. <INFO> may add ",width,height" (older clients' in-game browser size); it is dropped.
 *
 * @param {string} tag
 * @returns {string}
 */
export function urlLinkToHTML(tag) {
	const match = URL_PARTS.exec(tag);
	if (!match) {
		return ChatBox.escapeHTML(tag);
	}
	const url = match[2].replace(/,\d+,\d+$/, '').trim();
	if (!/^https?:\/\/\S+$/i.test(url)) {
		return ChatBox.escapeHTML(match[1]);
	}
	const href = ChatBox.escapeHTML(url);
	return (
		`<a href="${href}" title="${href}" target="_blank" rel="noopener noreferrer" class="url-link" ` +
		`style="color:#8CC8FF; text-decoration:underline; cursor:pointer;">${ChatBox.escapeHTML(match[1])}</a>`
	);
}

export default function Init() {
	const messageToHTML = ChatBox.messageToHTML;
	const addText = ChatBox.addText;

	// The rest of the line (text, item links, colour codes) still goes through ChatBox's own rendering
	ChatBox.messageToHTML = function messageToHTMLWithUrls(text) {
		return text
			.replace(/\^[0-9A-Fa-f]{6}/g, '')
			.split(URL_TAG)
			.map((part, i) => (i % 2 ? urlLinkToHTML(part) : messageToHTML.call(this, part)))
			.join('');
	};

	ChatBox.addText = function addTextWithUrls(text, colorType, filterType, color, override) {
		if (!override && typeof text === 'string' && URL_TAG.test(text)) {
			text = ChatBox.messageToHTML(text);
			override = true;
		}
		return addText.call(this, text, colorType, filterType, color, override);
	};

	return true;
}
