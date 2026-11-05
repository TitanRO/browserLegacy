/**
 * ChatUrlLinks Plugin (TitanRO)
 *
 * Renders <URL>label<INFO>url</INFO></URL> in chat and NPC dialogs as a link that copies the URL to the clipboard when clicked and
 * shows "Link copied!" above it for a moment. The server writes this tag with clif_format_url, e.g. the quickstart plugin's
 * @quickinvite link and dialog, which a player wants to paste somewhere else; the game windows can't copy text.
 * Clients from 2018-10-24 open the same link in the default browser from NPC dialogs. Without the plugin the tags show
 * as text.
 *
 * It wraps ChatBox.messageToHTML (received lines, whispers, the whisper window), ChatBox.addText (which renders a
 * line as HTML only when it holds an item link) and NpcBox.setText, so those components themselves are unchanged. Players can type the tag too: only
 * http(s) URLs become links, and the link's title shows the URL; any other link shows its label as text.
 *
 * Config.local.js: plugins: { ChatUrlLinks: 'ChatUrlLinks/ChatUrlLinks' }
 *
 * @author Trojal
 */

import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import NpcBox from 'UI/Components/NpcBox/NpcBox.js';

const URL_TAG = /(<URL>.*?<\/URL>)/i;
const URL_PARTS = /^<URL>([\s\S]*?)<INFO>([\s\S]*?)<\/INFO><\/URL>$/i;

/**
 * HTML for one <URL>...</URL> tag. <INFO> may add ",width,height" (older clients' in-game browser size); it is dropped.
 * The <a> has no href, so clicking it never navigates; the chat already keeps clicks on links from moving the player.
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
	const attr = ChatBox.escapeHTML(url);
	return (
		`<a data-url="${attr}" title="${attr} (click to copy)" class="url-link" ` +
		`style="color:#8CC8FF; text-decoration:underline; cursor:pointer;">${ChatBox.escapeHTML(match[1])}</a>`
	);
}

/**
 * Copies text to the clipboard: the Clipboard API where the page may use it (https), else a hidden textarea.
 *
 * @param {string} text
 * @returns {Promise<void>}
 */
export function copyText(text) {
	if (navigator.clipboard && window.isSecureContext) {
		return navigator.clipboard.writeText(text);
	}
	return new Promise((resolve, reject) => {
		const area = document.createElement('textarea');
		area.value = text;
		area.setAttribute('readonly', '');
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.appendChild(area);
		area.select();
		const ok = document.execCommand('copy');
		area.remove();
		if (ok) {
			resolve();
		} else {
			reject(new Error('copy failed'));
		}
	});
}

// Under the game cursor (.cursor, 9999), which the game draws over every element
const TOOLTIP_STYLE = `
.url-link-copied { position: fixed; z-index: 9000; transform: translate(-50%, -100%); padding: 2px 8px;
	font-size: 12px; line-height: 16px; white-space: nowrap; pointer-events: none; color: #fff;
	background: rgba(20, 30, 45, 0.9); border: 1px solid #8c9db7; border-radius: 3px;
	box-shadow: 1px 2px 4px rgba(0, 0, 0, 0.4); transition: opacity 0.3s; }
.url-link-copied--hidden { opacity: 0; }
`;
const TOOLTIP_MS = 1200;
let tooltip = null;
let tooltipTimer = 0;

/**
 * Shows "Link copied!" just above the link for a moment.
 *
 * @param {Element} link
 */
export function showCopiedTooltip(link) {
	if (!tooltip) {
		const style = document.createElement('style');
		style.textContent = TOOLTIP_STYLE;
		document.head.appendChild(style);
		tooltip = document.createElement('div');
		tooltip.className = 'url-link-copied';
		tooltip.textContent = 'Link copied!';
	}
	const box = link.getBoundingClientRect();
	tooltip.style.left = `${box.left + box.width / 2}px`;
	tooltip.style.top = `${box.top - 4}px`;
	tooltip.classList.remove('url-link-copied--hidden');
	document.body.appendChild(tooltip);
	clearTimeout(tooltipTimer);
	tooltipTimer = setTimeout(() => {
		tooltip.classList.add('url-link-copied--hidden');
		tooltipTimer = setTimeout(() => tooltip.remove(), 300);
	}, TOOLTIP_MS);
}

function onClick(event) {
	const link = event
		.composedPath()
		.find(node => node instanceof Element && node.classList.contains('url-link') && node.dataset.url);
	if (!link) {
		return;
	}
	event.preventDefault();
	const url = link.dataset.url;
	copyText(url)
		.then(() => showCopiedTooltip(link))
		.catch(() => ChatBox.addText(`Couldn't copy the link: ${url}`, ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG));
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

	// NPC dialog text is inserted as HTML after NpcBox converts its own tags (items, navigation, colours), so the
	// <URL> tags are swapped for the link first; the rest of the text is left as NpcBox expects it
	const setText = NpcBox.setText;
	NpcBox.setText = function setTextWithUrls(text, gid) {
		if (typeof text === 'string' && URL_TAG.test(text)) {
			text = text
				.split(URL_TAG)
				.map((part, i) => (i % 2 ? urlLinkToHTML(part) : part))
				.join('');
		}
		return setText.call(this, text, gid);
	};

	document.addEventListener('click', onClick);

	return true;
}
