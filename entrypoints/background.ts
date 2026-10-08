// Listens for events. The brain and backend.
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
  });

  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'PING') sendResponse({ ok: true });
  });
});