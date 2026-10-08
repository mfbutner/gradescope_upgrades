// Runs on Gradescope pages when they're opened.
export default defineContentScript({
  matches: ['https://*.gradescope.com/*'],
  main() {
    console.log('Content script loaded on', location.href);
    browser.runtime.sendMessage({ type: 'PING' }).then(console.log);
  },
});