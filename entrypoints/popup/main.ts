document.getElementById('btn')!.addEventListener('click', async () => {
  await browser.storage.local.set({ clicked: Date.now() });
  console.log(await browser.storage.local.get('clicked'));
});