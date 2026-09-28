/* MAKROskop embeds: fits each <iframe data-makroskop-embed> to the height its page reports.
 * Optional; without it the iframe keeps the height in the embed code. Safe to include more than once. */
(function () {
	if (window.__makroskopResize) return;
	window.__makroskopResize = true;
	window.addEventListener('message', function (event) {
		var data = event.data;
		if (!data || data.type !== 'makroskop:height' || typeof data.height !== 'number' || !isFinite(data.height)) return;
		var frames = document.querySelectorAll('iframe[data-makroskop-embed]');
		for (var i = 0; i < frames.length; i++) {
			var frame = frames[i];
			if (frame.contentWindow !== event.source) continue;
			var origin;
			try {
				origin = new URL(frame.src).origin;
			} catch (e) {
				continue;
			}
			if (origin !== event.origin) continue;
			frame.style.height = Math.max(200, Math.min(1200, Math.round(data.height))) + 'px';
		}
	});
	// An embed that loaded before this script posted its height to no one: ask each one again.
	var frames = document.querySelectorAll('iframe[data-makroskop-embed]');
	for (var i = 0; i < frames.length; i++) {
		try {
			frames[i].contentWindow.postMessage({ type: 'makroskop:ping' }, new URL(frames[i].src).origin);
		} catch (e) {}
	}
})();
