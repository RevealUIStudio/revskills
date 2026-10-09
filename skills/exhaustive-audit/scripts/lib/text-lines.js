"use strict";

/**
 * Line count shared with manifest-build.js.
 * A trailing LF does not add an extra line. Empty input is 0.
 */
function countLines(buf) {
  if (!buf || buf.length === 0) return 0;
  let n = 1;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 10) n++;
  }
  if (buf[buf.length - 1] === 10) n--;
  if (n < 1) n = 1;
  return n;
}

module.exports = { countLines };
