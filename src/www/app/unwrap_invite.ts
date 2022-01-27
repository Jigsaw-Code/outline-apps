// If s is a URL whose fragment contains a Shadowsocks URL then return that Shadowsocks URL,
// otherwise return s.
export function unwrapInvite(s: string): string {
  try {
    const url = new URL(s);
    if (url.hash) {
      const decodedFragment = decodeURIComponent(url.hash);

      // Search in the fragment for ss:// for two reasons:
      //  - URL.hash includes the leading # (what).
      //  - When a user opens invite.html#ENCODEDSSURL in their browser, the website (currently)
      //    redirects to invite.html#/en/invite/ENCODEDSSURL. Since copying that redirected URL
      //    seems like a reasonable thing to do, let's support those URLs too.
      const possibleShadowsocksUrl = decodedFragment.substring(decodedFragment.indexOf('ss://'));

      if (new URL(possibleShadowsocksUrl).protocol === 'ss:') {
        return possibleShadowsocksUrl;
      }
    }
  } catch (e) {
    // Something wasn't a URL, or it couldn't be decoded - no problem, people put all kinds of
    // unexpected things in the clipboard.
  }
  return s;
}